CREATE TABLE config (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER config_update_timestamp 
AFTER UPDATE ON config
BEGIN
  UPDATE config SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
END;

CREATE TABLE argon_activities (
  local_node_block_number INTEGER NOT NULL,
  main_node_block_number INTEGER NOT NULL,
  inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bitcoin_activities (
  local_node_block_number INTEGER NOT NULL,
  main_node_block_number INTEGER NOT NULL,
  inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bot_activities (
  block_number INTEGER NOT NULL,
  tick INTEGER NOT NULL,
  address TEXT NOT NULL,
  bid_amount INTEGER NOT NULL,
  bid_position INTEGER NOT NULL,
  prev_position INTEGER NOT NULL,
  inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cohort_accounts (
  idx INTEGER NOT NULL,
  cohort_id INTEGER NOT NULL,
  address TEXT NOT NULL,
  microgons_bid INTEGER NOT NULL,
  bid_position INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idx, cohort_id),
  FOREIGN KEY (cohort_id) REFERENCES cohorts(id)
);

CREATE TRIGGER cohort_accounts_update_timestamp 
AFTER UPDATE ON cohort_accounts
BEGIN
  UPDATE cohort_accounts SET updated_at = CURRENT_TIMESTAMP WHERE idx = NEW.idx AND cohort_id = NEW.cohort_id;
END;

CREATE TABLE cohort_frames (
  frame_id INTEGER NOT NULL,
  cohort_id INTEGER NOT NULL,
  blocks_mined INTEGER NOT NULL,
  micronots_mined INTEGER NOT NULL,
  microgons_mined INTEGER NOT NULL,
  microgons_minted INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (frame_id, cohort_id),
  FOREIGN KEY (frame_id) REFERENCES frames(id),
  FOREIGN KEY (cohort_id) REFERENCES cohorts(id)
);

CREATE TRIGGER cohort_frames_update_timestamp 
AFTER UPDATE ON cohort_frames
BEGIN
  UPDATE cohort_frames SET updated_at = CURRENT_TIMESTAMP WHERE frame_id = NEW.frame_id AND cohort_id = NEW.cohort_id;
END;

CREATE TABLE cohorts (
  id INTEGER NOT NULL PRIMARY KEY,
  progress REAL NOT NULL,
  transaction_fees INTEGER NOT NULL,
  micronots_staked INTEGER NOT NULL,
  microgons_bid INTEGER NOT NULL,
  seats_won INTEGER NOT NULL,
  microgons_to_be_mined INTEGER NOT NULL,
  micronots_to_be_mined INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id) REFERENCES frames(id)
);

CREATE TRIGGER cohorts_update_timestamp 
AFTER UPDATE ON cohorts
BEGIN
  UPDATE cohorts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE frames (
  id INTEGER NOT NULL PRIMARY KEY,
  first_tick INTEGER NOT NULL,
  last_tick INTEGER NOT NULL,
  first_block_number INTEGER NOT NULL,
  last_block_number INTEGER NOT NULL,
  usd_exchange_rates TEXT NOT NULL DEFAULT '[]',
  btc_exchange_rates TEXT NOT NULL DEFAULT '[]',
  argnot_exchange_rates TEXT NOT NULL DEFAULT '[]',
  progress REAL NOT NULL,
  is_processed INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER frames_update_timestamp 
AFTER UPDATE ON frames
BEGIN
  UPDATE frames SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
