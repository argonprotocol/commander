use crate::config::{ConfigFile, ServerDetails};
use crate::db::{
    ArgonActivities, BitcoinActivities, BotActivities, CohortAccounts, CohortFrames, Cohorts,
    Frames,
};
use crate::ssh::SSH;
use crate::ssh::singleton::*;
use crate::stats::structs::{IBidsFile, IEarningsFile, IEarningsFileCohort, IBotStatus, IGlobalStats, ICohortStats, IDashboardStats};
use anyhow::Result;
use log::{error, info};
use serde_json::json;
use std::collections::HashSet;
use std::str::FromStr;
use std::sync::{Arc};
use tauri::{AppHandle, Emitter};

pub mod structs;

pub struct StatsSync {
    app: AppHandle,
    ssh: Arc<SSH>,
    local_port: u16,
    db_is_synced: bool,
    has_won_seats: bool,

    bids_last_modified_at: String,
    earnings_last_modified_at: String,

    last_argon_block_numbers: (u32, u32),
    last_bitcoin_block_numbers: (u32, u32),

    oldest_frame_id_to_sync: u32,
    current_frame_id: u32,
    last_processed_frame_id: u32,
}

impl StatsSync {
    pub async fn run(app: &AppHandle) -> Result<()> {
        

        if stats.db_is_synced {
            if has_bids_update {
                stats.update_bids().await?;
            }

            if has_earnings_update {
                info!(
                    "Syncing earnings for frame: {}",
                    bot_status.current_frame_id
                );
                stats.sync_db_frame(bot_status.current_frame_id).await?;
            }

            if has_bids_update || has_earnings_update {
                let cohort_stats = Self::fetch_latest_cohort_stats()?;
                let global_stats = Self::fetch_global_stats()?;

                if let Err(e) = app.emit(
                    "Stats",
                    json!({
                        "cohortStats": cohort_stats,
                        "globalStats": global_stats,
                    }),
                ) {
                    error!("Error emitting stats: {}", e);
                }
            }
        } else {
            stats.ensure_db_is_synced().await?;
            stats.db_is_synced = true;
        }

        Ok(())
    }

    async fn ensure_db_is_synced(&mut self) -> Result<()> {
        let db_rows_expected = self.current_frame_id - self.oldest_frame_id_to_sync;

        if Frames::fetch_record_count().unwrap() == db_rows_expected {
            self.last_processed_frame_id = self.current_frame_id - 1;
            return Ok(());
        }

        info!("Syncing DB...");
        self.sync_db().await?;

        Ok(())
    }

    async fn sync_db(&mut self) -> Result<()> {
        let frames_to_sync = self.current_frame_id - self.oldest_frame_id_to_sync;
        let mut frames_synced = 0;

        for frame_id in self.oldest_frame_id_to_sync..=self.current_frame_id {
            let progress = (frames_synced as f32 / frames_to_sync as f32) * 100.0;
            if let Err(e) = self
                .app
                .emit("dataSync", json!({ "type": "db", "progress": progress }))
            {
                error!("Error emitting loadingy: {}", e);
            }
            self.sync_db_frame(frame_id).await?;
            frames_synced += 1;
        }

        Ok(())
    }

    async fn sync_db_frame(&mut self, frame_id: u32) -> Result<()> {
        // Try to fetch the frame, but ignore if it doesn't exist
        if let Ok(frame) = Frames::fetch_by_id(frame_id) {
            if frame.is_processed {
                self.last_processed_frame_id = frame_id;
                return Ok(());
            }
        }

        let url = format!("http://127.0.0.1:{}/earnings/{}", self.local_port, frame_id);
        info!("Fetching earnings: {}", url);
        let response = reqwest::get(url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch earnings: {}", e))?;

        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "Could not get response text".to_string());

        let data: IEarningsFile = serde_json::from_str(&text).map_err(|e| {
            anyhow::anyhow!(
                "Failed to parse earnings JSON: {}. Response text: {}",
                e,
                text
            )
        })?;

        Frames::insert_or_update(
            frame_id,
            data.frame_tick_start,
            data.frame_tick_end,
            data.frame_progress,
            false,
        )?;

        let mut processed_cohorts: HashSet<u32> = HashSet::new();

        let mut total_blocks_mined = 0;

        for (cohort_frame_id_str, cohort_data) in
            data.by_cohort_frame_id.iter()
        {
            let cohort_frame_id = u32::from_str(cohort_frame_id_str)
                .map_err(|e| anyhow::anyhow!("Failed to parse frame ID: {}", e))?;
            if !processed_cohorts.contains(&cohort_frame_id) {
                self.sync_db_cohort(cohort_frame_id, frame_id, data.frame_progress)
                    .await?;
                processed_cohorts.insert(cohort_frame_id);
            }

            total_blocks_mined += cohort_data.blocks_mined;
            self.sync_db_cohort_frame(cohort_frame_id, frame_id, cohort_data)
                .await?;
        }

        info!("TOTAL BLOCKS MINED: {}", total_blocks_mined);

        let is_processed = data.frame_progress == 100.0;
        if is_processed {
            self.last_processed_frame_id = frame_id;
        }
        Frames::update(
            frame_id,
            data.frame_tick_start,
            data.frame_tick_end,
            data.frame_progress,
            is_processed,
        )?;

        Ok(())
    }

    async fn sync_db_cohort_frame(
        &mut self,
        frame_id_at_cohort_activation: u32,
        frame_id: u32,
        data: &IEarningsFileCohort,
    ) -> Result<()> {
        CohortFrames::insert_or_update(
            frame_id,
            frame_id_at_cohort_activation,
            data.blocks_mined,
            data.argonots_mined,
            data.argons_mined,
            data.argons_minted,
        )?;

        Ok(())
    }

    async fn sync_db_cohort(
        &mut self,
        cohort_starting_frame_id: u32,
        current_frame_id: u32,
        current_frame_progress: f32,
    ) -> Result<()> {
        let data = self.fetch_bids_file(cohort_starting_frame_id).await?;

        if data.frame_bidding_progress < 100.0 {
            // cohort hasn't started yet so don't add to DB
            info!(
                "Cohort hasn't started yet so don't add to DB: {} in {}",
                cohort_starting_frame_id, current_frame_id
            );
            return Ok(());
        }

        let frames_completed = current_frame_id - cohort_starting_frame_id;
        let progress = ((frames_completed as f32 * 100.0) + current_frame_progress) / 10.0;
        let argonots_staked = data.argonots_staked_per_seat * data.seats_won as u64;

        Cohorts::insert_or_update(
            cohort_starting_frame_id,
            progress,
            data.transaction_fees,
            argonots_staked,
            data.argons_bid_total,
            data.seats_won,
        )?;

        CohortAccounts::delete_for_cohort(cohort_starting_frame_id)?;

        for subaccount in data.subaccounts {
            CohortAccounts::insert(
                subaccount.index,
                cohort_starting_frame_id,
                subaccount.address,
                subaccount.argons_bid.unwrap_or_default(),
                subaccount.bid_position.unwrap_or_default(),
            )?;
        }

        Ok(())
    }

    fn insert_db_bidding_activity(&mut self, sync_status: &IBotStatus) -> Result<bool> {
        if self.bids_last_modified_at == sync_status.bids_last_modified_at {
            return Ok(false);
        }
        let record = BotActivities::insert(
            "biddings changed",
            &sync_status.bids_last_modified_at.clone(),
        )?;
        self.bids_last_modified_at = sync_status.bids_last_modified_at.clone();
        if let Err(e) = self.app.emit("BotActivity", record.clone()) {
            error!("Error emitting bot activity: {}", e);
        }
        Ok(true)
    }

    async fn fetch_bids_file(
        &mut self,
        frame_id_at_cohort_activation: impl Into<Option<u32>>,
    ) -> Result<IBidsFile> {
        let url_base = format!("http://127.0.0.1:{}/bids", self.local_port);
        let url = match frame_id_at_cohort_activation.into() {
            Some(frame_id_at_cohort_activation) => {
                format!("{}/{}", url_base, frame_id_at_cohort_activation)
            }
            None => url_base,
        };
        info!("Fetching cohort data for cohort: {}", url);
        let response = reqwest::get(url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch cohort biddings: {}", e))?;

        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "Could not get response text".to_string());

        let data: IBidsFile = serde_json::from_str(&text)
            .map_err(|e| anyhow::anyhow!("Failed to parse bids JSON: {}. Text: {}", e, text))?;

        Ok(data)
    }

    pub async fn update_bids(&mut self) -> Result<()> {
        let bids_file = self.fetch_bids_file(None).await?;
        if let Err(e) = self.app.emit("CurrentBids", bids_file) {
            error!("Error emitting bids file: {}", e);
        }

        Ok(())
    }
}
