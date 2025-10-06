ALTER TABLE BitcoinLocks ADD COLUMN liquidityPromised INTEGER NOT NULL DEFAULT 0;
ALTER TABLE BitcoinLocks RENAME COLUMN lockPrice TO peggedPrice;
