use crate::db::{
    CohortAccounts, CohortFrames, Cohorts,
    Frames,
};
use crate::ssh::SSH;
use crate::stats::fetcher::StatsFetcher;
use crate::stats::structs::{IEarningsFileCohort};
use crate::config::{ConfigFile, ServerDetails};
use anyhow::Result;
use log::{error, info};
use std::collections::HashSet;
use std::str::FromStr;
use std::sync::Mutex;
use lazy_static::lazy_static;

lazy_static! {
    static ref IS_RUNNING: Mutex<Option<tokio::task::JoinHandle<()>>> = Mutex::new(None);
}

pub struct StatsSyncer {
    ssh: SSH,
    local_port: u16,
}

impl StatsSyncer {
    pub async fn new(ssh: &SSH, local_port: u16) -> Result<Self> {
        let ssh = SSH::connect(ssh.config.clone()).await?;

        Ok(Self {
            ssh: ssh.clone(),
            local_port,
        })
    }

    pub async fn launch_sync_thread(ssh: &SSH, local_port: u16, oldest_frame_id_to_sync: u32, current_frame_id: u32) -> Result<()> {       
        if let Some(_handle) = IS_RUNNING.lock().unwrap().take() {
            info!("Syncer thread already running, skipping");
            return Ok(());
        }
        let mut syncer = StatsSyncer::new(ssh, local_port).await?;

        let handle: tokio::task::JoinHandle<()> = tokio::spawn(async move {
            match syncer.sync_db(oldest_frame_id_to_sync, current_frame_id).await {
                Ok(_) => info!("Syncer thread Finished"),
                Err(e) => {
                    error!("Syncer thread failed: {}", e);
                    let mut server_details = ServerDetails::load().unwrap_or_default();
                    server_details.sync_error = Some(e.to_string());
                    server_details.save().unwrap_or_default();
                }
            }
            let _ = IS_RUNNING.lock().unwrap().take();
        });

        let _ = IS_RUNNING.lock().unwrap().insert(handle);

        Ok(())
    }

    async fn sync_db(&mut self, oldest_frame_id_to_sync: u32, current_frame_id: u32) -> Result<()> {
        for frame_id in oldest_frame_id_to_sync..=current_frame_id {
            info!("Syncing frame: {}", frame_id);
            self.sync_db_frame(frame_id).await?;
        }

        Ok(())
    }

    pub async fn sync_db_frame(&mut self, frame_id: u32) -> Result<()> {
        if let Ok(frame) = Frames::fetch_by_id(frame_id) {
            if frame.is_processed {
                return Ok(());
            }
        }

        let earnings_file = StatsFetcher::fetch_earnings_file(self.local_port, frame_id).await?;

        Frames::insert_or_update(
            frame_id,
            earnings_file.frame_tick_start,
            earnings_file.frame_tick_end,
            earnings_file.frame_progress,
            false,
        )?;

        let mut processed_cohorts: HashSet<u32> = HashSet::new();

        let mut total_blocks_mined = 0;

        for (cohort_frame_id_str, cohort_data) in
            earnings_file.by_cohort_frame_id.iter()
        {
            let cohort_frame_id = u32::from_str(cohort_frame_id_str)
                .map_err(|e| anyhow::anyhow!("Failed to parse frame ID: {}", e))?;
            if !processed_cohorts.contains(&cohort_frame_id) {
                self.sync_db_cohort(cohort_frame_id, frame_id, earnings_file.frame_progress)
                    .await?;
                processed_cohorts.insert(cohort_frame_id);
            }

            total_blocks_mined += cohort_data.blocks_mined;
            self.sync_db_cohort_frame(cohort_frame_id, frame_id, cohort_data)
                .await?;
        }

        info!("TOTAL BLOCKS MINED: {}", total_blocks_mined);

        let is_processed = earnings_file.frame_progress == 100.0;
        Frames::update(
            frame_id,
            earnings_file.frame_tick_start,
            earnings_file.frame_tick_end,
            earnings_file.frame_progress,
            is_processed,
        )?;

        Ok(())
    }

    async fn sync_db_cohort_frame(
        &mut self,
        cohort_bidding_frame_id: u32,
        frame_id: u32,
        data: &IEarningsFileCohort,
    ) -> Result<()> {
        CohortFrames::insert_or_update(
            frame_id,
            cohort_bidding_frame_id,
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
        let data = StatsFetcher::fetch_bids_file(self.local_port, Some(cohort_starting_frame_id)).await?;

        if data.frame_bidding_progress < 100.0 {
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
}
