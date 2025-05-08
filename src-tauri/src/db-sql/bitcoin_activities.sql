CREATE TABLE IF NOT EXISTS bitcoin_activities (
    localhost_block_number INTEGER NOT NULL,
    mainchain_block_number INTEGER NOT NULL,
    inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

