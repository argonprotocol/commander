export type IBidHistoryItem = {
  type:
    | 'AddedBid'
    | 'DroppedBid'
    | 'FailedBid'
    | 'InitializingBot'
    | 'InitializedBot'
    | 'SyncingBot'
    | 'SyncedBot'
    | 'DisabledBidding'
    | 'ReenabledBidding';
  data:
    | IInitializingBot
    | IFinishedInitializingBot
    | ISyncingBot
    | IFinishedSyncingBot
    | IAddedBid
    | IDroppedBid
    | IFailedBid
    | IDisabledBidding
    | IReenabledBidding;
};

export type IInitializingBot = {
  type: 'InitializingBot';
};

export type IFinishedInitializingBot = {
  type: 'InitializedBot';
};

export type ISyncingBot = {
  type: 'SyncingBot';
  ticksToSync: number;
};

export type IFinishedSyncingBot = {
  type: 'SyncedBot';
  ticksSynced: number;
};

export type IAddedBid = {
  type: 'AddedBid';
  bidAmount: bigint;
  bidAddress: String;
  bidPosition: number;
};

export type IDroppedBid = {
  type: 'DroppedBid';
  bidAmount: bigint;
  bidAddress: String;
  bidPositionFrom: number;
  bidPositionTo: number;
};

export type IFailedBid = {
  type: 'FailedBid';
  bidAmount: bigint;
  bidCount: String;
};

export type IDisabledBidding = {
  type: 'DisabledBidding';
  reason: string;
};

export type IReenabledBidding = {
  type: 'ReenabledBidding';
};
