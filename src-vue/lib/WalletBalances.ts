import { Accountset, ArgonClient, MainchainClients, parseSubaccountRange } from '@argonprotocol/commander-core';
import { FrameSystemAccountInfo, KeyringPair, PalletBalancesAccountData } from '@argonprotocol/mainchain';
import { createDeferred } from './Utils';
import {
  IMiningAccountPreviousHistoryBid,
  IMiningAccountPreviousHistoryRecord,
  IMiningAccountPreviousHistorySeat,
} from '../interfaces/IConfig';
import { FrameIterator } from '@argonprotocol/commander-core/src/FrameIterator.ts';

export interface IWallet {
  address: string;
  availableMicrogons: bigint;
  availableMicronots: bigint;
  reservedMicrogons: bigint;
  reservedMicronots: bigint;
}

export class WalletBalances {
  private clients: MainchainClients;
  private subscriptions: VoidFunction[] = [];
  private deferredLoading = createDeferred<void>(false);

  public onBalanceChange?: () => void;
  public onLoadHistoryProgress?: (loadPct: number) => void;

  public miningWallet: IWallet = {
    address: '',
    availableMicrogons: 0n,
    availableMicronots: 0n,
    reservedMicrogons: 0n,
    reservedMicronots: 0n,
  };

  public vaultingWallet: IWallet = {
    address: '',
    availableMicrogons: 0n,
    availableMicronots: 0n,
    reservedMicrogons: 0n,
    reservedMicronots: 0n,
  };

  public totalWalletMicrogons: bigint = 0n;
  public totalWalletMicronots: bigint = 0n;

  constructor(mainchainClients: MainchainClients) {
    this.clients = mainchainClients;
  }

  public async load(accountData: { miningAccountAddress?: string; vaultingAccountAddress?: string }) {
    if (this.deferredLoading.isRunning || this.deferredLoading.isSettled) {
      return this.deferredLoading.promise;
    }
    this.deferredLoading.setIsRunning(true);

    const { miningAccountAddress, vaultingAccountAddress } = accountData;
    if (miningAccountAddress) this.miningWallet.address = miningAccountAddress;
    if (vaultingAccountAddress) this.vaultingWallet.address = vaultingAccountAddress;

    this.deferredLoading.resolve();
  }

  public async updateBalances() {
    await this.deferredLoading.promise;

    const walletsToUpdate = [this.miningWallet, this.vaultingWallet].filter(x => x.address);

    for (const wallet of walletsToUpdate) {
      await Promise.all([this.loadMicrogonBalance(wallet), this.loadMicronotBalance(wallet)]);
    }

    this.onBalanceChange?.();
  }

  public async subscribeToBalanceUpdates() {
    await this.deferredLoading.promise;

    if (this.subscriptions.length) {
      this.subscriptions.forEach(x => x());
      this.subscriptions.length = 0;
    }

    const walletsToSubscribe = [this.miningWallet, this.vaultingWallet].filter(x => x.address);

    for (const wallet of walletsToSubscribe) {
      const client = await this.clients.prunedClientOrArchivePromise;
      const [subMicrogon, subMicronot] = await Promise.all([
        client.query.system.account(wallet.address, result => {
          this.handleMicrogonBalanceChange(result, wallet);
        }),
        client.query.ownership.account(wallet.address, result => {
          this.handleMicronotBalanceChange(result, wallet);
        }),
      ]);
      this.subscriptions.push(subMicrogon, subMicronot);
    }
  }

  public async loadHistory(miningAccount: KeyringPair): Promise<IMiningAccountPreviousHistoryRecord[]> {
    await this.deferredLoading.promise;

    const liveClient = await this.clients.prunedClientOrArchivePromise;
    const accountSubaccounts = Accountset.getSubaccounts(miningAccount, parseSubaccountRange('0-99')!);

    const currentFrameBids: IMiningAccountPreviousHistoryBid[] = [];
    const seatsByFrameId: Record<number, IMiningAccountPreviousHistorySeat[]> = {};
    const latestFrameId = await liveClient.query.miningSlot.nextFrameId().then(x => x.toNumber() - 1);
    const earliestPossibleFrameId = 150; // this is hard coded based on the spec version needing to be > 124. Doesn't need to be exact.

    const bidsRaw = await liveClient.query.miningSlot.bidsForNextSlotCohort();
    for (const [bidPosition, bidRaw] of bidsRaw.entries()) {
      const address = bidRaw.accountId.toHuman();
      const isOurAccount = !!accountSubaccounts[address];
      if (!isOurAccount) continue;

      currentFrameBids.push({
        bidPosition,
        microgonsBid: bidRaw.bid.toBigInt(),
        micronotsStaked: bidRaw.argonots.toBigInt(),
      });
    }

    await new FrameIterator(this.clients, true).forEachFrame(async (frameId, api, _meta, _abortController) => {
      Object.assign(seatsByFrameId, await this.fetchSeatData(api, accountSubaccounts));
      const framesProcessed = latestFrameId - frameId;
      const framesToProcess = latestFrameId - earliestPossibleFrameId;
      this.onLoadHistoryProgress?.(Math.max((100 * framesProcessed) / framesToProcess, 0));
    });

    this.onLoadHistoryProgress?.(100);

    const dataByFrameId: Record<string, IMiningAccountPreviousHistoryRecord> = {};
    for (const [frameIdStr, seats] of Object.entries(seatsByFrameId)) {
      const frameId = Number(frameIdStr);
      const bids = frameId === latestFrameId ? currentFrameBids : [];
      if (!bids.length && !seats.length) continue;

      dataByFrameId[frameIdStr] = {
        frameId,
        bids,
        seats,
      };
    }

    return Object.values(dataByFrameId);
  }

  private async fetchSeatData(
    api: ArgonClient,
    accountSubaccounts: Record<string, any>,
  ): Promise<Record<number, IMiningAccountPreviousHistorySeat[]>> {
    const minersByCohort = await api.query.miningSlot.minersByCohort.entries();
    const seatsByFrameId: Record<number, IMiningAccountPreviousHistorySeat[]> = {};

    for (const [frameIdRaw, seatsInFrame] of minersByCohort) {
      const frameId = Number(frameIdRaw.toHuman());
      const seats: IMiningAccountPreviousHistorySeat[] = [];
      for (const [seatPosition, seatRaw] of seatsInFrame.entries()) {
        const address = seatRaw.accountId.toHuman();
        const isOurAccount = !!accountSubaccounts[address];
        if (!isOurAccount) continue;

        seats.push({
          seatPosition,
          microgonsBid: seatRaw.bid.toBigInt(),
          micronotsStaked: seatRaw.argonots.toBigInt(),
        });
      }
      seatsByFrameId[frameId] = seats;
    }

    return seatsByFrameId;
  }

  private async loadMicrogonBalance(wallet: IWallet) {
    const client = await this.clients.prunedClientOrArchivePromise;
    const result = await client.query.system.account(wallet.address);
    this.handleMicrogonBalanceChange(result, wallet);
  }

  private async loadMicronotBalance(wallet: IWallet) {
    const client = await this.clients.prunedClientOrArchivePromise;
    const result = await client.query.ownership.account(wallet.address);
    this.handleMicronotBalanceChange(result, wallet);
  }

  private handleMicrogonBalanceChange(result: FrameSystemAccountInfo, wallet: IWallet) {
    const availableMicrogons = result.data.free.toBigInt();
    const reservedMicrogons = result.data.reserved.toBigInt();
    const availableMicrogonsDiff = availableMicrogons + reservedMicrogons - wallet.availableMicrogons;

    wallet.availableMicrogons = availableMicrogons;
    wallet.reservedMicrogons = reservedMicrogons;

    this.totalWalletMicrogons += availableMicrogonsDiff;
    this.onBalanceChange?.();
  }

  private handleMicronotBalanceChange(result: PalletBalancesAccountData, wallet: IWallet) {
    const availableMicronots = result.free.toBigInt();
    const reservedMicronots = result.reserved.toBigInt();
    const micronotsDiff = availableMicronots + reservedMicronots - wallet.availableMicronots;

    wallet.availableMicronots = availableMicronots;
    wallet.reservedMicronots = reservedMicronots;

    this.totalWalletMicronots += micronotsDiff;
    this.onBalanceChange?.();
  }

  public static doesWalletHasValue(wallet: IWallet): boolean {
    if (wallet.availableMicrogons > 0n) return true;
    if (wallet.availableMicronots > 0n) return true;
    if (wallet.reservedMicronots > 0n) return true;
    if (wallet.reservedMicrogons > 0n) return true;
    return false;
  }
}
