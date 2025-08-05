import { type Accountset, MiningBids } from '@argonprotocol/mainchain';
import { createBidderParams, type IBiddingRules } from '@argonprotocol/commander-calculator';
import { type Storage } from './Storage.ts';
import { CohortBidder } from './CohortBidder.ts';
import type { History } from './History.ts';

/**
 * Creates a bidding process. Between each cohort, it will ask the callback for parameters for the next cohort.
 * @param accountset
 * @param storage
 * @param biddingRules
 */
export class AutoBidder {
  public readonly miningBids: MiningBids;
  private cohortBidder: CohortBidder | undefined;
  private unsubscribe?: () => void;

  constructor(
    readonly accountset: Accountset,
    readonly storage: Storage,
    readonly history: History,
    private biddingRules: IBiddingRules,
  ) {
    this.miningBids = new MiningBids(accountset.client);
  }

  async start(localRpcUrl: string): Promise<void> {
    await this.accountset.registerKeys(localRpcUrl);
    const { unsubscribe } = await this.miningBids.onCohortChange({
      onBiddingStart: this.onBiddingStart.bind(this),
      onBiddingEnd: this.onBiddingEnd.bind(this),
    });
    this.unsubscribe = unsubscribe;
  }

  async stop() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    await this.stopCohortBidding();
  }

  private async onBiddingEnd(cohortActivationFrameId: number): Promise<void> {
    console.log(`Bidding for frame ${cohortActivationFrameId} ended`);
    if (this.cohortBidder?.cohortStartingFrameId !== cohortActivationFrameId) return;
    await this.stopCohortBidding();
  }

  private async onBiddingStart(cohortActivationFrameId: number) {
    if (this.cohortBidder?.cohortStartingFrameId === cohortActivationFrameId) return;
    const params = await createBidderParams(cohortActivationFrameId, await this.accountset.client, this.biddingRules);
    if (params.maxSeats === 0) return;

    const cohortBiddingFrameId = cohortActivationFrameId - 1;
    const bidsFileData = await this.storage.bidsFile(cohortBiddingFrameId, cohortActivationFrameId).get();
    console.log(`Bidding for frame ${cohortActivationFrameId} started`, {
      hasStartingStats: !!bidsFileData,
      seatGoal: params.maxSeats,
    });

    const subaccounts: { index: number; isRebid: boolean; address: string }[] = [];
    if (bidsFileData && bidsFileData.winningBids.length) {
      const miningAccounts = await this.accountset.loadRegisteredMiners(await this.accountset.client);
      for (const winningBid of bidsFileData.winningBids) {
        if (typeof winningBid.subAccountIndex !== 'number') continue;
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

    const cohortBidder = new CohortBidder(this.accountset, this.history, cohortActivationFrameId, subaccounts, params);
    this.cohortBidder = cohortBidder;
    await cohortBidder.start();
  }

  private async stopCohortBidding() {
    const cohortBidder = this.cohortBidder;
    if (!cohortBidder) return;
    this.cohortBidder = undefined;
    const cohortActivationFrameId = cohortBidder.cohortStartingFrameId;
    await cohortBidder.stop();
    console.log('Bidding stopped', { cohortActivationFrameId });
  }
}
