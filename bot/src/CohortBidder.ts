import type { Accountset } from '@argonprotocol/mainchain';
import {
  type ArgonClient,
  type ArgonPrimitivesBlockSealMiningRegistration,
  ExtrinsicError,
  formatArgons,
} from '@argonprotocol/mainchain';
import { Bool, u64, Vec } from '@polkadot/types-codec';
import { History, SeatReductionReason } from './History.ts';

export class CohortBidder {
  public get clientPromise(): Promise<ArgonClient> {
    return this.accountset.client;
  }

  private unsubscribe?: () => void;
  private pendingRequest: Promise<any> | undefined;
  private retryTimeout?: NodeJS.Timeout;
  private isStopped = false;
  private needsRebid = false;
  private lastBidTime = 0;

  private millisPerTick?: number;

  private readonly myAddresses = new Set<string>();

  constructor(
    public accountset: Accountset,
    public history: History,
    public cohortStartingFrameId: number,
    public subaccounts: { index: number; isRebid: boolean; address: string }[],
    public options: {
      minBid: bigint;
      maxBid: bigint;
      maxBudget: bigint;
      bidIncrement: bigint;
      bidDelay: number;
      tipPerTransaction?: bigint;
    },
  ) {
    this.subaccounts.forEach(x => {
      this.myAddresses.add(x.address);
    });
  }

  public async start() {
    console.log(`Starting cohort ${this.cohortStartingFrameId} bidder`, {
      maxBid: formatArgons(this.options.maxBid),
      minBid: formatArgons(this.options.minBid),
      bidIncrement: formatArgons(this.options.bidIncrement),
      maxBudget: formatArgons(this.options.maxBudget),
      bidDelay: this.options.bidDelay,
      subaccounts: this.subaccounts,
    });

    const client = await this.clientPromise;
    await this.history.initCohort(this.cohortStartingFrameId, this.myAddresses);
    this.millisPerTick ??= await client.query.ticks.genesisTicker().then(x => x.tickDurationMillis.toNumber());

    this.unsubscribe = await client.queryMulti<[Vec<ArgonPrimitivesBlockSealMiningRegistration>, u64]>(
      [client.query.miningSlot.bidsForNextSlotCohort as any, client.query.miningSlot.nextFrameId as any],
      async ([bids, nextFrameId]) => {
        if (nextFrameId.toNumber() === this.cohortStartingFrameId) {
          await this.checkWinningBids(bids);
        }
      },
    );
  }

  public async stop(): Promise<void> {
    if (this.isStopped) return;
    this.isStopped = true;
    console.log('Stopping bidder for cohort', this.cohortStartingFrameId);
    clearTimeout(this.retryTimeout);
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    const client = await this.clientPromise;
    const [nextFrameId, isBiddingOpen] = await client.queryMulti<[u64, Bool]>([
      client.query.miningSlot.nextFrameId as any,
      client.query.miningSlot.isNextSlotBiddingOpen,
    ]);
    if (nextFrameId.toNumber() === this.cohortStartingFrameId && isBiddingOpen.isTrue) {
      console.log('Bidding is still open, waiting for it to close');
      await new Promise<void>(async resolve => {
        const unsub = await client.query.miningSlot.isNextSlotBiddingOpen(isOpen => {
          if (isOpen.isFalse) {
            unsub();
            resolve();
          }
        });
      });
    }
    // wait for any pending request to finish updating stats
    void (await this.pendingRequest);

    // go back to last block with this cohort
    let header = await client.rpc.chain.getHeader();
    while (true) {
      const api = await client.at(header.hash);
      const cohortStartingFrameId = await api.query.miningSlot.nextFrameId();
      if (cohortStartingFrameId.toNumber() === this.cohortStartingFrameId) {
        break;
      }
      header = await client.rpc.chain.getHeader(header.parentHash);
    }
    const api = await client.at(header.hash);
    const tick = await api.query.ticks.currentTick().then(x => x.toNumber());
    const bids = await api.query.miningSlot.bidsForNextSlotCohort();
    const blockNumber = header.number.toNumber();
    this.history.handleIncomingBids(tick, blockNumber, bids);

    console.log('Bidder stopped', {
      cohortStartingFrameId: this.cohortStartingFrameId,
      blockNumber: header.number.toNumber(),
      tick,
      bids: bids.map(x => ({
        address: x.accountId.toHuman(),
        bid: x.bid.toBigInt(),
      })),
    });
  }

  private async checkWinningBids(bids: ArgonPrimitivesBlockSealMiningRegistration[]) {
    if (this.isStopped) return;
    clearTimeout(this.retryTimeout);

    const client = await this.clientPromise;
    const bestBlock = await client.rpc.chain.getBlockHash();
    const api = await client.at(bestBlock);
    const blockNumber = await api.query.system.number().then(x => x.toNumber());
    if (this.history.lastProcessedBlockNumber >= blockNumber) {
      return;
    }
    const winningBidCount = bids.reduce(
      (acc, bid) => (this.myAddresses.has(bid.accountId.toHuman()) ? acc + 1 : acc),
      0,
    );
    const tick = await api.query.ticks.currentTick().then(x => x.toNumber());

    this.history.handleIncomingBids(tick, blockNumber, bids);

    if (this.pendingRequest) return;

    const ticksSinceLastBid = Math.floor((Date.now() - this.lastBidTime) / this.millisPerTick!);
    if (ticksSinceLastBid < this.options.bidDelay) {
      this.retryTimeout = setTimeout(() => void this.checkCurrentSeats(), this.millisPerTick!);
      return;
    }
    console.log(
      'Checking bids for cohort',
      this.cohortStartingFrameId,
      this.subaccounts.map(x => x.index),
    );

    this.needsRebid = winningBidCount < this.subaccounts.length;
    if (!this.needsRebid) return;

    const winningAddresses = new Set(bids.map(x => x.accountId.toHuman()));
    let lowestBid = -this.options.bidIncrement;
    if (bids.length) {
      for (let i = bids.length - 1; i >= 0; i--) {
        // find the lowest bid that is not us
        if (!this.myAddresses.has(bids[i].accountId.toHuman())) {
          lowestBid = bids.at(i)!.bid.toBigInt();
          break;
        }
      }
    }
    const MIN_INCREMENT = 10_000n;

    // 1. determine next bid based on current bids and settings
    let nextBid = lowestBid + this.options.bidIncrement;
    if (nextBid < this.options.minBid) {
      nextBid = this.options.minBid;
    }
    if (nextBid > this.options.maxBid) {
      nextBid = this.options.maxBid;
    }

    console.log('this.accountset.createMiningBidTx', {
      subaccounts: this.subaccounts,
      bidAmount: nextBid,
    });
    const fakeTx = await this.accountset.createMiningBidTx({
      subaccounts: this.subaccounts,
      bidAmount: nextBid,
    });
    let availableBalanceForBids = await api.query.system
      .account(this.accountset.txSubmitterPair.address)
      .then(x => x.data.free.toBigInt());

    // add our current balance used to the budget
    for (const bid of bids) {
      if (this.myAddresses.has(bid.accountId.toHuman())) {
        availableBalanceForBids += bid.bid.toBigInt();
      }
    }
    const tip = this.options.tipPerTransaction ?? 0n;
    const feeEstimate = await fakeTx.feeEstimate(tip);
    const estimatedFeePlusTip = feeEstimate + tip;

    let budgetForSeats = this.options.maxBudget - estimatedFeePlusTip;
    if (budgetForSeats > availableBalanceForBids) {
      budgetForSeats = availableBalanceForBids - estimatedFeePlusTip;
    }
    if (nextBid < lowestBid) {
      console.log(`Can't bid ${formatArgons(nextBid)}. Current lowest bid is ${formatArgons(lowestBid)}.`);
      this.history.handleSeatFluctuation(
        tick,
        blockNumber,
        winningBidCount,
        SeatReductionReason.MaxBidTooLow,
        availableBalanceForBids,
      );
      return;
    }

    if (nextBid - lowestBid < MIN_INCREMENT) {
      console.log(`Can't make any more bids for ${this.cohortStartingFrameId} with given constraints.`, {
        lowestCurrentBid: formatArgons(lowestBid),
        nextAttemptedBid: formatArgons(nextBid),
        maxBid: formatArgons(this.options.maxBid),
      });
      this.history.handleSeatFluctuation(
        tick,
        blockNumber,
        winningBidCount,
        SeatReductionReason.MaxBidTooLow,
        availableBalanceForBids,
      );
      return;
    }

    const seatsInBudget = nextBid === 0n ? this.subaccounts.length : Number(budgetForSeats / nextBid);

    let accountsToUse = [...this.subaccounts];
    // 3. if we have more seats than we can afford, we need to remove some
    if (accountsToUse.length > seatsInBudget) {
      const reason =
        availableBalanceForBids - estimatedFeePlusTip < nextBid * BigInt(seatsInBudget)
          ? SeatReductionReason.InsufficientFunds
          : SeatReductionReason.MaxBudgetTooLow;
      this.history.handleSeatFluctuation(tick, blockNumber, seatsInBudget, reason, availableBalanceForBids);
      // Sort accounts by winning bids first, then rebids, then by index
      accountsToUse.sort((a, b) => {
        const isWinningA = winningAddresses.has(a.address);
        const isWinningB = winningAddresses.has(b.address);
        if (isWinningA && !isWinningB) return -1;
        if (!isWinningA && isWinningB) return 1;

        if (a.isRebid && !b.isRebid) return -1;
        if (!a.isRebid && b.isRebid) return 1;
        return a.index - b.index;
      });
      // only keep the number of accounts we can afford
      accountsToUse.length = seatsInBudget;
    }
    if (accountsToUse.length > winningBidCount) {
      this.pendingRequest = this.submitBids(blockNumber, tick, nextBid, accountsToUse, estimatedFeePlusTip);
    }
    this.needsRebid = false;
  }

  private async submitBids(
    prevBlockNumber: number,
    prevTick: number,
    microgonsPerSeat: bigint,
    subaccounts: { address: string }[],
    estimatedFeePlusTip: bigint,
  ) {
    const client = await this.clientPromise;
    const prevLastBidTime = this.lastBidTime;
    const estimatedBlockNumber = prevBlockNumber + 1;
    const estimatedTick = prevTick + 1;
    try {
      this.lastBidTime = Date.now();
      this.history.handleBidsSubmitted(estimatedTick, estimatedBlockNumber, {
        microgonsPerSeat,
        txFeePlusTip: estimatedFeePlusTip,
        submittedCount: subaccounts.length,
      });

      const submitter = await this.accountset.createMiningBidTx({
        subaccounts,
        bidAmount: microgonsPerSeat,
      });
      const tip = this.options.tipPerTransaction ?? 0n;
      const txResult = await submitter.submit({
        tip,
        useLatestNonce: true,
      });

      let blockNumber: number | undefined;
      if (txResult.includedInBlock) {
        const api = await client.at(txResult.includedInBlock);
        blockNumber = await api.query.system.number().then(x => x.toNumber());
      }

      const tick = await client.query.ticks.currentTick().then(x => x.toNumber());
      const bidError = await txResult.inBlockPromise.then(() => undefined).catch((x: ExtrinsicError) => x);
      const successfulBids = txResult.batchInterruptedIndex ?? subaccounts.length;

      console.log('Done creating bids for cohort', {
        successfulBids,
        bidPerSeat: microgonsPerSeat,
        blockNumber,
      });

      if (bidError) {
        const unsuccessfulBids = subaccounts.length - successfulBids;
        this.history.handleBidsRejected(tick, blockNumber as number, {
          microgonsBid: microgonsPerSeat,
          submittedCount: subaccounts.length,
          rejectedCount: unsuccessfulBids,
          bidError,
        });
        throw bidError;
      }
    } catch (err) {
      this.lastBidTime = prevLastBidTime;
      console.error(`Error bidding for cohort ${this.cohortStartingFrameId}:`, err);
      clearTimeout(this.retryTimeout);
      this.retryTimeout = setTimeout(() => void this.checkCurrentSeats(), 1000);
    } finally {
      this.pendingRequest = undefined;
    }

    if (this.needsRebid) {
      this.needsRebid = false;
      await this.checkCurrentSeats();
    }
  }

  private async checkCurrentSeats() {
    const client = await this.clientPromise;
    const bids = await client.query.miningSlot.bidsForNextSlotCohort();
    await this.checkWinningBids(bids);
  }

  public static async getStartingData(
    api: ArgonClient,
  ): Promise<{ micronotsStakedPerSeat: bigint; microgonsToBeMinedPerBlock: bigint }> {
    const micronotsStakedPerSeat = await api.query.miningSlot.argonotsPerMiningSeat().then(x => x.toBigInt());
    const microgonsToBeMinedPerBlock = await api.query.blockRewards.argonsPerBlock().then(x => x.toBigInt());
    return { micronotsStakedPerSeat, microgonsToBeMinedPerBlock };
  }
}
