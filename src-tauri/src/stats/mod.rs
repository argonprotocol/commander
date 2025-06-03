use crate::config::{ConfigFile, ServerDetails};
use crate::db::{
    ArgonActivities, BitcoinActivities, BotActivities, CohortAccounts, CohortFrames, Cohorts,
    Frames,
};
use crate::ssh::SSH;
use crate::ssh::singleton::*;
use crate::stats::structs::{IDashboardGlobalStats, IDashboardCohortStats, IBidsFileSubaccount, IBotStatus};
use crate::stats::syncer::StatsSyncer;
use anyhow::Result;
use tauri::AppHandle;
use fetcher::StatsFetcher;

pub use structs::IDashboardStats;
pub use structs::IActiveBids;
pub use structs::IStats;

pub mod structs;
pub mod fetcher;
pub mod syncer;

pub struct Stats {
    app: AppHandle,
    ssh: SSH,
    local_port: u16,
    bot_status: IBotStatus,

    oldest_frame_id_to_sync: u32,
    current_frame_id: u32,
    last_processed_frame_id: u32,
    is_missing_current_frame: bool,
}

impl Stats {
    async fn new(app: &AppHandle, server_details: ServerDetails) -> Result<Self> {
        let ssh = get_ssh_connection(server_details.ssh_config()?).await?;
        let local_port = try_adding_tunnel_to_connection(&ssh).await?;
        
        let bot_status = match StatsFetcher::fetch_bot_status(local_port).await {
            Ok(bot_status) => {
                Self::update_server_details_from_bot_status(&bot_status)?;
                bot_status
            },
            Err(_) => IBotStatus {
                argon_block_numbers: (0, 0),
                bitcoin_block_numbers: (0, 0),
                bids_last_modified_at: String::new(),
                earnings_last_modified_at: String::new(),
                has_won_seats: false,
                last_block_number: 0,
                last_finalized_block_number: 0,
                oldest_frame_id_to_sync: 0,
                current_frame_id: 0,
                load_progress: 0.0,
                queue_depth: 0,
            }
        };
        
        let oldest_frame_id_to_sync = bot_status.oldest_frame_id_to_sync;
        let current_frame_id = bot_status.current_frame_id;

        Ok(Self {
            app: app.clone(),
            ssh: ssh,
            local_port,
            bot_status,
            oldest_frame_id_to_sync,
            current_frame_id,
            last_processed_frame_id: Frames::latest_id().unwrap_or(0),
            is_missing_current_frame: false,
        })
    }

    fn default(cohort_id: Option<u32>) -> IStats {
        IStats {
            is_syncing: false,
            sync_progress: 0.0,
            sync_error: None,
            has_won_seats: false,
            active_bids: IActiveBids {
                subaccounts: Vec::new(),
            },
            dashboard: IDashboardStats {
                global: IDashboardGlobalStats {
                    active_cohorts: 0,
                    active_seats: 0,
                    total_blocks_mined: 0,
                    total_argons_bid: 0,
                    total_transaction_fees: 0,
                    total_argonots_mined: 0,
                    total_argons_mined: 0,
                    total_argons_minted: 0,
                },
                cohort_id,
                cohort: Some(IDashboardCohortStats {
                    cohort_id: 0,
                    frame_tick_start: 0,
                    frame_tick_end: 0,
                    transaction_fees: 0,
                    argonots_staked: 0,
                    argons_bid: 0,
                    seats_won: 0,
                    blocks_mined: 0,
                    argonots_mined: 0,
                    argons_mined: 0,
                    argons_minted: 0,
                }),
            },
            argon_activity: Vec::new(),
            bitcoin_activity: Vec::new(),
            bot_activity: Vec::new(),
        }
    }

    pub async fn fetch(app: &AppHandle, cohort_id: Option<u32>) -> Result<IStats> {
        let server_details = ServerDetails::load()?;
        let sync_error = server_details.sync_error.clone();

        if server_details.is_installing || server_details.is_requiring_upgrade {
            return Ok(Self::default(cohort_id));
        }

        let mut stats = Self::new(app, server_details).await?;

        let sync_progress = stats.calculate_sync_progress().await?;
        let has_won_seats = stats.bot_status.has_won_seats;
        let mut is_syncing = false;

        if sync_error.is_some() {
            let mut response = Self::default(cohort_id);
            response.is_syncing = true;
            response.sync_progress = sync_progress;
            response.sync_error = sync_error;
            return Ok(response);
        }

        if sync_progress < 100.0 {
            StatsSyncer::launch_sync_thread(&stats.ssh, stats.local_port, stats.oldest_frame_id_to_sync, stats.current_frame_id).await?;
            is_syncing = true;
        } else {
            let mut syncer = StatsSyncer::new(&stats.ssh, stats.local_port).await?;

            if stats.is_missing_current_frame {
                let yesterday_frame = Frames::fetch_by_id(stats.current_frame_id - 1)?;
                if !yesterday_frame.is_processed {
                    syncer.sync_db_frame(yesterday_frame.id).await?;
                }
            }

            syncer.sync_db_frame(stats.current_frame_id).await?;
        }
        
        let active_bids = stats.fetch_active_bids()?;
        let cohort_id = cohort_id.or_else(|| Self::fetch_latest_cohort_id());
        let dashboard = stats.fetch_dashboard(cohort_id)?;
        
        Ok(IStats {
            is_syncing,
            sync_progress,
            sync_error: None,
            has_won_seats,
            active_bids,
            dashboard,
            argon_activity: ArgonActivities::fetch_last_five_records()?,
            bitcoin_activity: BitcoinActivities::fetch_last_five_records()?,
            bot_activity: BotActivities::fetch_last_five_records()?,
        })
    }

    async fn calculate_sync_progress(&mut self) -> Result<f32> {
        let bot_load_progress = self.bot_status.load_progress * 0.9;

        if bot_load_progress < 90.0 {
            return Ok(bot_load_progress);
        }

        let db_sync_progress = self.calculate_db_sync_progress()? * 0.1;

        Ok(bot_load_progress + db_sync_progress)
    }

    fn calculate_db_sync_progress(&mut self) -> Result<f32> {
        let db_rows_expected = self.current_frame_id - self.oldest_frame_id_to_sync + 1;
        let db_rows_found = Frames::fetch_record_count().unwrap();

        if db_rows_found == db_rows_expected {
            self.last_processed_frame_id = self.current_frame_id - 1;
            self.is_missing_current_frame = false;
            return Ok(100.0);
        }

        if db_rows_found == (db_rows_expected - 1) {
            if let Err(_) = Frames::fetch_by_id(self.current_frame_id) {
                self.is_missing_current_frame = true;
                return Ok(100.0);
            }
        }

        Ok(db_rows_found as f32 / db_rows_expected as f32 * 100.0)
    }

    fn fetch_active_bids(&self) -> Result<IActiveBids> {
        let cohort_accounts = CohortAccounts::fetch_for_cohort_id(self.current_frame_id)?;
        Ok(IActiveBids {
            subaccounts: cohort_accounts.into_iter().map(|account| IBidsFileSubaccount {
                index: account.idx,
                address: account.address,
                bid_position: Some(account.bid_position),
                argons_bid: Some(account.argons_bid),
                is_rebid: None,
                last_bid_at_tick: None,
            }).collect(),
        })
    }

    pub fn fetch_dashboard(&self, cohort_id: Option<u32>) -> Result<IDashboardStats> {
        Ok(IDashboardStats {
            global: Self::fetch_dashboard_global_stats()?,
            cohort_id,
            cohort: match cohort_id {
                Some(id) => Self::fetch_dashboard_cohort_stats(id)?,
                None => None,
            },
        })
    }
    
    fn fetch_latest_cohort_id() -> Option<u32> {
        match Cohorts::fetch_latest_active_id() {
            Ok(Some(id)) => Some(id),
            Ok(None) => None,
            Err(_) => None,
        }
    }

    fn fetch_dashboard_global_stats() -> Result<IDashboardGlobalStats> {
        let current_frame_id = Frames::latest_id()?;
        let (active_cohorts, active_seats, total_transaction_fees, total_argons_bid) =
            Cohorts::fetch_global_stats(current_frame_id)?;

        let (total_blocks_mined, total_argonots_mined, total_argons_mined, total_argons_minted) =
            CohortFrames::fetch_global_stats()?;

        Ok(IDashboardGlobalStats {
            active_cohorts,
            active_seats,
            total_blocks_mined,
            total_argons_bid,
            total_transaction_fees,
            total_argonots_mined,
            total_argons_mined,
            total_argons_minted,
        })
    }

    fn fetch_dashboard_cohort_stats(cohort_id: u32) -> Result<Option<IDashboardCohortStats>> {
        let cohort = match Cohorts::fetch_by_id(cohort_id)? {
            Some(cohort) => cohort,
            None => return Ok(None),
        };

        let (blocks_mined, argonots_mined, argons_mined, argons_minted) =
            CohortFrames::fetch_cohort_stats(cohort.id)?;
        Ok(Some(IDashboardCohortStats {
            cohort_id: cohort.id,
            frame_tick_start: cohort.frame_tick_start,
            frame_tick_end: cohort.frame_tick_end,
            transaction_fees: cohort.transaction_fees,
            argonots_staked: cohort.argonots_staked,
            argons_bid: cohort.argons_bid,
            seats_won: cohort.seats_won,
            blocks_mined,
            argonots_mined,
            argons_mined,
            argons_minted,
        }))
    }

    fn update_server_details_from_bot_status(bot_status: &IBotStatus) -> Result<()> {
        let mut server_details = ServerDetails::load()
            .map_err(|e| anyhow::anyhow!("Failed to load server connection: {}", e))?;

        if bot_status.oldest_frame_id_to_sync > 0 {
            server_details.oldest_frame_id_to_sync = Some(bot_status.oldest_frame_id_to_sync);
        }

        server_details.has_mining_seats = bot_status.has_won_seats;
        server_details.save()?;

        Ok(())
    }
}
