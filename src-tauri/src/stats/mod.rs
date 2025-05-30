use crate::config::{ConfigFile, ServerDetails};
use crate::db::{
    ArgonActivities, BitcoinActivities, BotActivities, CohortAccounts, CohortFrames, Cohorts,
    Frames,
};
use crate::ssh::SSH;
use crate::ssh::singleton::*;
use crate::stats::structs::{IDashboardGlobalStats, IDashboardCohortStats, IBidsFileSubaccount, IBotStatus};
use crate::installer::Installer;
use anyhow::Result;
use tauri::AppHandle;
use fetcher::StatsFetcher;

pub use structs::IDashboardStats;
pub use structs::IActiveBids;
pub use structs::IStats;

pub mod structs;
pub mod fetcher;

pub struct Stats {
    app: AppHandle,
    ssh: SSH,
    local_port: u16,
    bot_status: IBotStatus,

    oldest_frame_id_to_sync: u32,
    current_frame_id: u32,
    last_processed_frame_id: u32,
}

impl Stats {
    async fn new(app: &AppHandle, server_details: ServerDetails) -> Result<Self> {
        let ssh = get_ssh_connection(server_details.ssh_config()?).await?;
        let local_port = try_adding_tunnel_to_connection(&ssh).await?;
        
        let bot_status = match StatsFetcher::fetch_bidding_bot_status(local_port).await {
            Ok(status) => status,
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
        })
    }

    pub async fn fetch(app: &AppHandle, cohort_id: Option<u32>) -> Result<IStats> {
        let server_details = ServerDetails::load()?;

        if server_details.is_installing {
            return Ok(IStats {
                is_syncing: false,
                sync_progress: 0.0,
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
            });
        }

        let mut stats = Self::new(app, server_details).await?;
        println!("STATS: {:?}", stats.bot_status);

        let sync_progress = stats.calculate_sync_progress().await?;
        let is_syncing = sync_progress < 100.0;
        let has_won_seats = stats.bot_status.has_won_seats;

        if is_syncing {
            // StatsSync::launch(app, ssh).await?;
        }
        
        let active_bids = stats.fetch_active_bids()?;
        let cohort_id = cohort_id.or_else(|| Self::fetch_latest_cohort_id());
        let dashboard = stats.fetch_dashboard(cohort_id)?;
        
        Ok(IStats {
            is_syncing,
            sync_progress,
            has_won_seats,
            active_bids,
            dashboard,
            argon_activity: ArgonActivities::fetch_last_five_records()?,
            bitcoin_activity: BitcoinActivities::fetch_last_five_records()?,
            bot_activity: BotActivities::fetch_last_five_records()?,
        })
    }

    async fn calculate_sync_progress(&mut self) -> Result<f32> {
        if self.bot_status.load_progress < 100.0 {
            return Ok(self.bot_status.load_progress * 0.9);
        }

        if !self.is_db_synced().await? {
            println!("DB is not synced");
            return Ok(90.0);
        }

        Ok(100.0)
    }

    async fn is_db_synced(&mut self) -> Result<bool> {
        let db_rows_expected = self.current_frame_id - self.oldest_frame_id_to_sync;

        if Frames::fetch_record_count().unwrap() == db_rows_expected {
            self.last_processed_frame_id = self.current_frame_id - 1;
            return Ok(true);
        }

        Ok(false)
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
            global: Self::fetch_global_dashboard_stats()?,
            cohort: match cohort_id {
                Some(id) => Self::fetch_cohort_dashboard_stats(id)?,
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

    fn fetch_global_dashboard_stats() -> Result<IDashboardGlobalStats> {
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

    fn fetch_cohort_dashboard_stats(cohort_id: u32) -> Result<Option<IDashboardCohortStats>> {
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
}
