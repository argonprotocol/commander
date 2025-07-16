import { Config } from './Config';
import { Db } from './Db';
import { BotSyncer, BotStatus } from './BotSyncer';
import { ensureOnlyOneInstance } from './Utils';

import { IBidsFile } from '@argonprotocol/commander-bot/src/storage';
import mitt, { type Emitter } from 'mitt';

export type IBotEmitter = {
  'updated-cohort-data': number;
  'updated-bids-data': IBidsFile['winningBids'];
  'updated-bitcoin-activity': void;
  'updated-argon-activity': void;
  'updated-bidding-activity': void;
};

export const botEmitter: Emitter<IBotEmitter> = mitt<IBotEmitter>();

export class Bot {
  public syncProgress: number;
  public maxSeatsPossible: number;
  public maxSeatsReductionReason: string;

  private status: BotStatus | null = null;
  private config: Config;
  private dbPromise: Promise<Db>;

  constructor(config: Config, dbPromise: Promise<Db>) {
    ensureOnlyOneInstance(this.constructor);

    this.syncProgress = 0;
    this.maxSeatsPossible = 10;
    this.maxSeatsReductionReason = '';

    this.config = config;
    this.dbPromise = dbPromise;
  }

  public async load(): Promise<void> {
    const db = await this.dbPromise;
    const botSyncer = new BotSyncer(this.config, db, {
      onEvent: (type: keyof IBotEmitter, payload?: any) => botEmitter.emit(type, payload),
      setStatus: (x: BotStatus) => (this.status = x),
      setServerSyncProgress: (x: number) => (this.syncProgress = x * 0.9),
      setDbSyncProgress: (x: number) => (this.syncProgress = 90 + x * 0.1),
      setMaxSeatsPossible: (x: number) => (this.maxSeatsPossible = x),
      setMaxSeatsReductionReason: (x: string) => (this.maxSeatsReductionReason = x),
    });

    await botSyncer.load();
  }

  public get isStarting(): boolean {
    return this.status === BotStatus.Starting;
  }

  public get isSyncing(): boolean {
    return this.status === BotStatus.ServerSyncing || this.status === BotStatus.DbSyncing;
  }

  public get isBroken(): boolean {
    return this.status === BotStatus.Broken;
  }

  public get isReady(): boolean {
    return this.status === BotStatus.Ready;
  }
}
