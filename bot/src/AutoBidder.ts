import { type Accountset, MiningBids } from '@argonprotocol/mainchain';
import { createBidderParams } from '@argonprotocol/commander-calculator';
import { type CohortStorage } from './storage.ts';
import { CohortBidder } from './CohortBidder.ts';
import { readJsonFileOrNull } from './utils.ts';

/**
 * Creates a bidding process. Between each cohort, it will ask the callback for parameters for the next cohort.
 * @param accountset
 * @param storage
 * @param biddingRulesPath
 */
export class AutoBidder {
  public readonly miningBids: MiningBids;
  public activeBidder: CohortBidder | undefined;
  private unsubscribe?: () => void;

  constructor(
    readonly accountset: Accountset,
    readonly storage: CohortStorage,
    private biddingRulesPath: string,
  ) {
    this.miningBids = new MiningBids(accountset.client);
  }

  get bidHistory(): CohortBidder['bidHistory'] {
    return this.activeBidder?.bidHistory || [];
  }

  async start(localRpcUrl: string): Promise<void> {
    await this.accountset.registerKeys(localRpcUrl);
    const { unsubscribe } = await this.miningBids.onCohortChange({
      onBiddingStart: this.onBiddingStart.bind(this),
      onBiddingEnd: this.onBiddingEnd.bind(this),
    });
    this.unsubscribe = unsubscribe;
  }

  async restart() {
    if (this.activeBidder) {
      const cohortActivatingFrameId = this.activeBidder.cohortId;
      await this.stopBidder();
      await this.onBiddingStart(cohortActivatingFrameId);
    }
  }

  async stop() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    await this.stopBidder();
  }

  private async onBiddingEnd(cohortActivatingFrameId: number): Promise<void> {
    console.log(`Bidding for frame ${cohortActivatingFrameId} ended`);
    if (this.activeBidder?.cohortId !== cohortActivatingFrameId) return;
    await this.stopBidder();
  }

  private async onBiddingStart(cohortActivatingFrameId: number) {
    if (this.activeBidder?.cohortId === cohortActivatingFrameId) return;
    const biddingRules = readJsonFileOrNull(this.biddingRulesPath) || {};
    const params = await createBidderParams(
      cohortActivatingFrameId,
      await this.accountset.client,
      biddingRules,
    );
    if (params.maxSeats === 0) return;

    const bidsFileData = await this.storage.bidsFile(cohortActivatingFrameId).get();
    console.log(`Bidding for frame ${cohortActivatingFrameId} started`, {
      hasStartingStats: !!bidsFileData,
      seatGoal: params.maxSeats,
    });

    const subaccounts: { index: number; isRebid: boolean; address: string }[] = [];
    if (bidsFileData && bidsFileData.winningBids.length) {
      const miningAccounts = await this.accountset.loadRegisteredMiners(
        await this.accountset.client,
      );
      for (const winningBid of bidsFileData.winningBids) {
        if (winningBid.subAccountIndex === undefined) continue;
        const account = miningAccounts.find(x => x.address === winningBid.address);
        if (account) {
          subaccounts.push({
            index: winningBid.subAccountIndex,
            isRebid: true,
            address: winningBid.address,
          });
        }
      }
    }
    // check if we need to add more seats
    if (subaccounts.length < params.maxSeats) {
      const neededSeats = params.maxSeats - subaccounts.length;
      const added = await this.accountset.getAvailableMinerAccounts(neededSeats);
      subaccounts.push(...added);
    }

    const activeBidder = new CohortBidder(
      this.accountset,
      cohortActivatingFrameId,
      subaccounts,
      params,
    );
    this.activeBidder = activeBidder;
    await activeBidder.start();
  }

  private async stopBidder() {
    const activeBidder = this.activeBidder;
    if (!activeBidder) return;
    this.activeBidder = undefined;
    const cohortActivatingFrameId = activeBidder.cohortId;
    const stats = await activeBidder.stop();
    console.log('Bidding stopped', { cohortActivatingFrameId, ...stats });
  }
}
