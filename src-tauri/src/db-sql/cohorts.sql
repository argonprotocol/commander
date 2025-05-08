CREATE TABLE IF NOT EXISTS cohorts (
    frame_id_at_cohort_activation INTEGER NOT NULL PRIMARY KEY,
    progress REAL NOT NULL,
    transaction_fees INTEGER NOT NULL,
    argonots_staked INTEGER NOT NULL,
    argons_bid INTEGER NOT NULL,
    seats_won INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (frame_id_at_cohort_activation) REFERENCES frames(id)
);