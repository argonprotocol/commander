CREATE TABLE config (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER config_update_timestamp
AFTER UPDATE ON config
BEGIN
  UPDATE config SET updatedAt = CURRENT_TIMESTAMP WHERE key = NEW.key;
END;

CREATE TABLE argon_activities (
  localNodeBlockNumber INTEGER NOT NULL,
  mainNodeBlockNumber INTEGER NOT NULL,
  insertedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bitcoin_activities (
  localNodeBlockNumber INTEGER NOT NULL,
  mainNodeBlockNumber INTEGER NOT NULL,
  insertedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bot_activities (
  blockNumber INTEGER NOT NULL,
  tick INTEGER NOT NULL,
  address TEXT NOT NULL,
  bidAmount INTEGER NOT NULL,
  bidPosition INTEGER NOT NULL,
  prevPosition INTEGER NOT NULL,
  insertedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cohort_accounts (
  idx INTEGER NOT NULL,
  cohortId INTEGER NOT NULL,
  address TEXT NOT NULL,
  microgonsBid INTEGER NOT NULL,
  bidPosition INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idx, cohortId),
  FOREIGN KEY (cohortId) REFERENCES cohorts(id)
);

CREATE TRIGGER cohort_accounts_update_timestamp
AFTER UPDATE ON cohort_accounts
BEGIN
  UPDATE cohort_accounts SET updatedAt = CURRENT_TIMESTAMP WHERE idx = NEW.idx AND cohortId = NEW.cohortId;
END;

CREATE TABLE cohort_frames (
  frameId INTEGER NOT NULL,
  cohortId INTEGER NOT NULL,
  blocksMined INTEGER NOT NULL,
  micronotsMined INTEGER NOT NULL,
  microgonsMined INTEGER NOT NULL,
  microgonsMinted INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (frameId, cohortId),
  FOREIGN KEY (frameId) REFERENCES frames(id),
  FOREIGN KEY (cohortId) REFERENCES cohorts(id)
);

CREATE TRIGGER cohort_frames_update_timestamp
AFTER UPDATE ON cohort_frames
BEGIN
  UPDATE cohort_frames SET updatedAt = CURRENT_TIMESTAMP WHERE frameId = NEW.frameId AND cohortId = NEW.cohortId;
END;

CREATE TABLE cohorts (
  id INTEGER NOT NULL PRIMARY KEY,
  progress REAL NOT NULL,
  transactionFees INTEGER NOT NULL,
  micronotsStaked INTEGER NOT NULL,
  microgonsBid INTEGER NOT NULL,
  seatsWon INTEGER NOT NULL,
  microgonsToBeMined INTEGER NOT NULL,
  micronotsToBeMined INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id) REFERENCES frames(id)
);

CREATE TRIGGER cohorts_update_timestamp
AFTER UPDATE ON cohorts
BEGIN
  UPDATE cohorts SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE frames (
  id INTEGER NOT NULL PRIMARY KEY,
  firstTick INTEGER NOT NULL,
  lastTick INTEGER NOT NULL,
  firstBlockNumber INTEGER NOT NULL,
  lastBlockNumber INTEGER NOT NULL,
  microgonToUsd TEXT NOT NULL DEFAULT '[]',
  microgonToBtc TEXT NOT NULL DEFAULT '[]',
  microgonToArgonot TEXT NOT NULL DEFAULT '[]',
  progress REAL NOT NULL,
  isProcessed INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER frames_update_timestamp
AFTER UPDATE ON frames
BEGIN
  UPDATE frames SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE bitcoin_locks (
  utxoId INTEGER NOT NULL PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('initialized', 'pendingMint', 'verificationFailed', 'minted', 'releaseRequested', 'vaultCosigned')),
  txid TEXT,
  vout INTEGER,
  satoshis INTEGER NOT NULL,
  lockPrice INTEGER NOT NULL,
  ratchets JSON NOT NULL,
  lockDetails JSON NOT NULL,
  requestedReleaseAtHeight INTEGER,
  releaseBitcoinNetworkFee INTEGER,
  releaseToDestinationAddress TEXT,
  releaseCosignSignature BLOB,
  releaseCosignHeight INTEGER,
  network TEXT NOT NULL,
  hdPath TEXT NOT NULL,
  vaultId INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER bitcoin_locks_update_timestamp
AFTER UPDATE ON bitcoin_locks
BEGIN
  UPDATE bitcoin_locks SET updatedAt = CURRENT_TIMESTAMP WHERE utxoId = NEW.utxoId;
END;

--- Tracks the latest index for each bitcoin lock's HD path
CREATE TABLE bitcoin_lock_vault_hd_seq (
  vaultId INTEGER NOT NULL PRIMARY KEY,
  latestIndex INTEGER NOT NULL
);

CREATE TABLE vaults (
  id INTEGER NOT NULL PRIMARY KEY,
  hdPath TEXT NOT NULL,
  createdAtBlockHeight INTEGER NOT NULL,
  lastTermsUpdateHeight INTEGER,
  isClosed BOOLEAN NOT NULL DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER vaults_update_timestamp
AFTER UPDATE ON vaults
BEGIN
  UPDATE vaults SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;