CREATE TABLE IF NOT EXISTS cohort_accounts (
    frame_id_at_cohort_activation INTEGER NOT NULL,
    idx INTEGER NOT NULL,
    address TEXT NOT NULL,
    argons_bid INTEGER NOT NULL,
    bid_position INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (frame_id_at_cohort_activation, idx),
    FOREIGN KEY (frame_id_at_cohort_activation) REFERENCES cohorts(frame_id_at_cohort_activation)
);
