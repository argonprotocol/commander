CREATE TABLE Config (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER ConfigUpdateTimestamp
AFTER UPDATE ON Config
BEGIN
  UPDATE Config SET updatedAt = CURRENT_TIMESTAMP WHERE key = NEW.key;
END;

CREATE TABLE ServerState (
  id INTEGER NOT NULL PRIMARY KEY,
  latestFrameId INTEGER NOT NULL,
  argonBlocksLastUpdatedAt DATETIME,
  argonLocalNodeBlockNumber INTEGER NOT NULL,
  argonMainNodeBlockNumber INTEGER NOT NULL,
  bitcoinBlocksLastUpdatedAt DATETIME,
  bitcoinLocalNodeBlockNumber INTEGER NOT NULL,
  bitcoinMainNodeBlockNumber INTEGER NOT NULL,
  botActivities JSON,
  botActivityLastUpdatedAt DATETIME,
  botActivityLastBlockNumber INTEGER,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  -- FOREIGN KEY (latestFrameId) REFERENCES frames(id)
);

CREATE TABLE CohortFrames (
  frameId INTEGER NOT NULL,
  cohortId INTEGER NOT NULL,
  blocksMinedTotal INTEGER NOT NULL,
  microgonFeesCollectedTotal INTEGER NOT NULL,
  micronotsMinedTotal INTEGER NOT NULL,
  microgonsMinedTotal INTEGER NOT NULL,
  microgonsMintedTotal INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (frameId, cohortId),
  FOREIGN KEY (frameId) REFERENCES frames(id),
  FOREIGN KEY (cohortId) REFERENCES cohorts(id)
);

CREATE TRIGGER CohortFramesUpdateTimestamp
AFTER UPDATE ON CohortFrames
BEGIN
  UPDATE CohortFrames SET updatedAt = CURRENT_TIMESTAMP WHERE frameId = NEW.frameId AND cohortId = NEW.cohortId;
END;

CREATE TABLE Cohorts (
  id INTEGER NOT NULL PRIMARY KEY,
  progress REAL NOT NULL,
  seatCountWon INTEGER NOT NULL,
  transactionFeesTotal INTEGER NOT NULL,
  micronotsStakedPerSeat INTEGER NOT NULL,
  microgonsBidPerSeat INTEGER NOT NULL,
  microgonsToBeMinedPerSeat INTEGER NOT NULL,
  micronotsToBeMinedPerSeat INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id) REFERENCES frames(id)
);

CREATE TRIGGER CohortsUpdateTimestamp
AFTER UPDATE ON Cohorts
BEGIN
  UPDATE Cohorts SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE Frames (
  id INTEGER NOT NULL PRIMARY KEY,
  firstTick INTEGER NOT NULL,
  lastTick INTEGER NOT NULL,
  firstBlockNumber INTEGER NOT NULL,
  lastBlockNumber INTEGER NOT NULL,
  microgonToUsd TEXT NOT NULL DEFAULT '[]',
  microgonToBtc TEXT NOT NULL DEFAULT '[]',
  microgonToArgonot TEXT NOT NULL DEFAULT '[]',
  seatCountActive INTEGER NOT NULL DEFAULT 0,
  seatCostTotalFramed INTEGER NOT NULL DEFAULT 0,
  blocksMinedTotal INTEGER NOT NULL DEFAULT 0,
  microgonFeesCollectedTotal INTEGER NOT NULL DEFAULT 0,
  micronotsMinedTotal INTEGER NOT NULL DEFAULT 0,
  microgonsMinedTotal INTEGER NOT NULL DEFAULT 0,
  microgonsMintedTotal INTEGER NOT NULL DEFAULT 0,
  accruedMicrogonProfits INTEGER NOT NULL DEFAULT 0,
  progress REAL NOT NULL,
  isProcessed INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER FramesUpdateTimestamp
AFTER UPDATE ON Frames
BEGIN
  UPDATE Frames SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE FrameBids (
  frameId INTEGER NOT NULL,
  confirmedAtBlockNumber INTEGER NOT NULL,
  address TEXT NOT NULL,
  subAccountIndex INTEGER,
  microgonsPerSeat INTEGER NOT NULL,
  bidPosition INTEGER NOT NULL,
  lastBidAtTick INTEGER,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (frameId, address)
);

CREATE TRIGGER FrameBidsUpdateTimestamp
AFTER UPDATE ON FrameBids
BEGIN
  UPDATE FrameBids SET updatedAt = CURRENT_TIMESTAMP WHERE frameId = NEW.frameId AND address = NEW.address;
END;

CREATE TABLE BitcoinLocks (
  utxoId INTEGER NOT NULL PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('initialized', 'pendingMint', 'verificationFailed', 'minted', 'releaseRequested', 'vaultCosigned', 'released')),
  txid TEXT,
  vout INTEGER,
  satoshis INTEGER NOT NULL,
  lockPrice INTEGER NOT NULL,
  ratchets JSON NOT NULL,
  cosignVersion TEXT NOT NULL,
  lockDetails JSON NOT NULL,
  requestedReleaseAtHeight INTEGER,
  releaseBitcoinNetworkFee INTEGER,
  releaseToDestinationAddress TEXT,
  releaseCosignSignature BLOB,
  releaseCosignHeight INTEGER,
  releasedAtHeight INTEGER,
  releasedTxid TEXT,
  network TEXT NOT NULL,
  hdPath TEXT NOT NULL,
  vaultId INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER BitcoinLocksUpdateTimestamp
AFTER UPDATE ON BitcoinLocks
BEGIN
  UPDATE BitcoinLocks SET updatedAt = CURRENT_TIMESTAMP WHERE utxoId = NEW.utxoId;
END;

--- Tracks the latest index for each bitcoin lock's HD path
CREATE TABLE BitcoinLockVaultHdSeq (
  vaultId INTEGER NOT NULL PRIMARY KEY,
  latestIndex INTEGER NOT NULL
);

CREATE TABLE Vaults (
  id INTEGER NOT NULL PRIMARY KEY,
  hdPath TEXT NOT NULL,
  createdAtBlockHeight INTEGER NOT NULL,
  lastTermsUpdateHeight INTEGER,
  personalUtxoId INTEGER,
  operationalFeeMicrogons TEXT,
  prebondedMicrogons TEXT,
  prebondedMicrogonsAtTick INTEGER,
  isClosed INTEGER NOT NULL DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER VaultsUpdateTimestamp
AFTER UPDATE ON Vaults
BEGIN
  UPDATE Vaults SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
