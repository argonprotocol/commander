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
  ACTION TEXT NOT NULL,
  inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cohort_accounts (
  frame_id_at_cohort_activation INTEGER NOT NULL,
  idx INTEGER NOT NULL,
  address TEXT NOT NULL,
  argons_bid INTEGER NOT NULL,
  bid_position INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (frame_id_at_cohort_activation, idx),
  FOREIGN KEY (frame_id_at_cohort_activation) REFERENCES cohorts (frame_id_at_cohort_activation)
);

CREATE TABLE IF NOT EXISTS cohort_frames (
  frame_id INTEGER NOT NULL,
  frame_id_at_cohort_activation INTEGER NOT NULL,
  blocks_mined INTEGER NOT NULL,
  argonots_mined INTEGER NOT NULL,
  argons_mined INTEGER NOT NULL,
  argons_minted INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (frame_id, frame_id_at_cohort_activation),
  FOREIGN KEY (frame_id) REFERENCES frames (id),
  FOREIGN KEY (frame_id_at_cohort_activation) REFERENCES cohorts (frame_id_at_cohort_activation)
);

CREATE TABLE IF NOT EXISTS cohorts (
  frame_id_at_cohort_activation INTEGER NOT NULL PRIMARY KEY,
  progress REAL NOT NULL,
  transaction_fees INTEGER NOT NULL,
  argonots_staked INTEGER NOT NULL,
  argons_bid INTEGER NOT NULL,
  seats_won INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (frame_id_at_cohort_activation) REFERENCES frames (id)
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
