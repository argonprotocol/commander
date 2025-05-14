CREATE TABLE IF NOT EXISTS argon_activities (
  localhost_block_number INTEGER NOT NULL,
  mainchain_block_number INTEGER NOT NULL,
  inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bitcoin_activities (
  localhost_block_number INTEGER NOT NULL,
  mainchain_block_number INTEGER NOT NULL,
  inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bot_activities (
  tag TEXT NOT NULL,
  inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cohort_accounts (
  idx INTEGER NOT NULL,
  cohort_id INTEGER NOT NULL,
  address TEXT NOT NULL,
  argons_bid INTEGER NOT NULL,
  bid_position INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idx, cohort_id),
  FOREIGN KEY (cohort_id) REFERENCES cohorts(id)
);

CREATE TABLE IF NOT EXISTS cohort_frames (
  frame_id INTEGER NOT NULL,
  cohort_id INTEGER NOT NULL,
  blocks_mined INTEGER NOT NULL,
  argonots_mined INTEGER NOT NULL,
  argons_mined INTEGER NOT NULL,
  argons_minted INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (frame_id, cohort_id),
  FOREIGN KEY (frame_id) REFERENCES frames(id),
  FOREIGN KEY (cohort_id) REFERENCES cohorts(id)
);

CREATE TABLE IF NOT EXISTS cohorts (
  id INTEGER NOT NULL PRIMARY KEY,
  progress REAL NOT NULL,
  transaction_fees INTEGER NOT NULL,
  argonots_staked INTEGER NOT NULL,
  argons_bid INTEGER NOT NULL,
  seats_won INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id) REFERENCES frames(id)
);

CREATE TABLE IF NOT EXISTS frames (
  id INTEGER NOT NULL PRIMARY KEY,
  tick_start INTEGER NOT NULL,
  tick_end INTEGER NOT NULL,
  progress REAL NOT NULL,
  is_processed INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
