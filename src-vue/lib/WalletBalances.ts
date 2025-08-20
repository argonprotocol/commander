import { Mainchain, MainchainClient } from '@argonprotocol/commander-core';
import { Accountset, FrameSystemAccountInfo, KeyringPair, PalletBalancesAccountData } from '@argonprotocol/mainchain';
import { createDeferred } from './Utils';
import {
  IConfig,
  IMiningAccountPreviousHistoryBid,
  IMiningAccountPreviousHistoryRecord,
  IMiningAccountPreviousHistorySeat,
} from '../interfaces/IConfig';

export interface IWallet {
  address: string;
  availableMicrogons: bigint;
  availableMicronots: bigint;
  reservedMicronots: bigint;
}

export class WalletBalances {
  private clientPromise: Promise<MainchainClient>;
  private client!: MainchainClient;
  private mainchain!: Mainchain;
  private subscriptions: VoidFunction[] = [];
  private deferredLoading = createDeferred<void>(false);

  public onBalanceChange?: () => void;
  public onLoadHistoryProgress?: (loadPct: number) => void;

  public miningWallet: IWallet = {
    address: '',
    availableMicrogons: 0n,
    availableMicronots: 0n,
    reservedMicronots: 0n,
  };

  public vaultingWallet: IWallet = {
    address: '',
    availableMicrogons: 0n,
    availableMicronots: 0n,
    reservedMicronots: 0n,
  };

  public totalWalletMicrogons: bigint = 0n;
  public totalWalletMicronots: bigint = 0n;

  constructor(clientPromise: Promise<MainchainClient>) {
    this.clientPromise = clientPromise;
    this.mainchain = new Mainchain(clientPromise);
  }

  public async load(accountData: { miningAccountAddress?: string; vaultingAccountAddress?: string }) {
    if (this.deferredLoading.isRunning || this.deferredLoading.isSettled) {
      return this.deferredLoading.promise;
    }
    this.deferredLoading.setIsRunning(true);

    const { miningAccountAddress, vaultingAccountAddress } = accountData;
    if (miningAccountAddress) this.miningWallet.address = miningAccountAddress;
    if (vaultingAccountAddress) this.vaultingWallet.address = vaultingAccountAddress;

    this.client = await this.clientPromise;
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
      const [subMicrogon, subMicronot] = await Promise.all([
        this.client.query.system.account(wallet.address, result => {
          this.handleMicrogonBalanceChange(result, wallet);
        }),
        this.client.query.ownership.account(wallet.address, result => {
          this.handleMicronotBalanceChange(result, wallet);
        }),
      ]);
      this.subscriptions.push(subMicrogon, subMicronot);
    }
  }

  public async loadHistory(
    miningAccount: KeyringPair,
    miningSessionMiniSecret: string,
  ): Promise<IMiningAccountPreviousHistoryRecord[]> {
    await this.deferredLoading.promise;

    const accountset = new Accountset({
      client: this.clientPromise,
      seedAccount: miningAccount,
      sessionKeySeedOrMnemonic: miningSessionMiniSecret,
      subaccountRange: new Array(99).fill(0).map((_, i) => i),
    });

    const currentFrameBids: IMiningAccountPreviousHistoryBid[] = [];
    const seatsByFrameId: Record<number, IMiningAccountPreviousHistorySeat[]> = {};
    const latestFrameId = await this.client.query.miningSlot.nextFrameId().then(x => x.toNumber() - 1);
    const earliestPossibleFrameId = 150; // this is hard coded based on the spec version needing to be > 124. Doesn't need to be exact.

    const bidsRaw = await this.client.query.miningSlot.bidsForNextSlotCohort();
    for (const [bidPosition, bidRaw] of bidsRaw.entries()) {
      const address = bidRaw.accountId.toHuman();
      const isOurAccount = !!accountset.subAccountsByAddress[address];
      if (!isOurAccount) continue;

      currentFrameBids.push({
        bidPosition,
        microgonsBid: bidRaw.bid.toBigInt(),
        micronotsStaked: bidRaw.argonots.toBigInt(),
      });
    }

    await this.mainchain.forEachFrame(true, async (frameId, api, _meta, _abortController) => {
      Object.assign(seatsByFrameId, await this.fetchSeatData(api, accountset));
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
    api: MainchainClient,
    accountset: Accountset,
  ): Promise<Record<number, IMiningAccountPreviousHistorySeat[]>> {
    const minersByCohort = await api.query.miningSlot.minersByCohort.entries();
    const seatsByFrameId: Record<number, IMiningAccountPreviousHistorySeat[]> = {};

    for (const [frameIdRaw, seatsInFrame] of minersByCohort) {
      const frameId = Number(frameIdRaw.toHuman());
      const seats: IMiningAccountPreviousHistorySeat[] = [];
      for (const [seatPosition, seatRaw] of seatsInFrame.entries()) {
        const address = seatRaw.accountId.toHuman();
        const isOurAccount = !!accountset.subAccountsByAddress[address];
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
    const result = await this.client.query.system.account(wallet.address);
    this.handleMicrogonBalanceChange(result, wallet);
  }

  private async loadMicronotBalance(wallet: IWallet) {
    const result = await this.client.query.ownership.account(wallet.address);
    this.handleMicronotBalanceChange(result, wallet);
  }

  private handleMicrogonBalanceChange(result: FrameSystemAccountInfo, wallet: IWallet) {
    const availableMicrogons = result.data.free.toBigInt();
    const availableMicrogonsDiff = availableMicrogons - wallet.availableMicrogons;

    wallet.availableMicrogons = availableMicrogons;

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
    return false;
  }
}
