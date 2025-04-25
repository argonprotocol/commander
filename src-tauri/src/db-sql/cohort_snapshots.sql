CREATE TABLE IF NOT EXISTS cohort_snapshots (
    cohort_id INTEGER NOT NULL,
    active_cohort_count INTEGER NOT NULL,
    active_seat_count INTEGER NOT NULL,
    value_invested INTEGER NOT NULL,
    blocks_mined INTEGER NOT NULL,
    argonots_mined INTEGER NOT NULL,
    argons_mined INTEGER NOT NULL,
    argons_minted INTEGER NOT NULL,
    last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
