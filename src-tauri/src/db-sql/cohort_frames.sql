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
    FOREIGN KEY (frame_id) REFERENCES frames(id),
    FOREIGN KEY (frame_id_at_cohort_activation) REFERENCES cohorts(frame_id_at_cohort_activation)
);
