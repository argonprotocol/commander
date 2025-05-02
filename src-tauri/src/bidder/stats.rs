use crate::config::ServerConnection;
use crate::db::{
    ArgonActivities, BitcoinActivities, BotActivities, CohortAccounts, CohortFrames, Cohorts, Frames
};
use crate::ssh::SSH;
use anyhow::Result;
use lazy_static::lazy_static;
use log::{error, info};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::json;
use std::collections::HashSet;
use std::str::FromStr;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

lazy_static! {
    static ref RUNNING_TASK: Mutex<Option<tokio::task::JoinHandle<()>>> = Mutex::new(None);
}

fn deserialize_from_bigint<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: From<u64>,
{
    let s = String::deserialize(deserializer)?;
    let s = s.trim_end_matches('n');
    s.parse::<u64>()
        .map(T::from)
        .map_err(serde::de::Error::custom)
}

fn deserialize_option_from_bigint<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: From<u64>,
{
    match Option::<String>::deserialize(deserializer) {
        Ok(Some(s)) => {
            let s = s.trim_end_matches('n');
            s.parse::<u64>()
                .map(T::from)
                .map(Some)
                .map_err(serde::de::Error::custom)
        }
        Ok(None) => Ok(None),
        Err(_) => Ok(None), // Handle missing field by returning None
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IBotStatus {
    bids_last_modified_at: String,
    earnings_last_modified_at: String,
    has_won_seats: bool,
    last_block_number: u32,
    last_finalized_block_number: u32,
    oldest_frame_id_to_sync: u32,
    current_frame_id: u32,
    load_progress: f32,
    queue_depth: u32,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IBidsFile {
    pub frame_id_at_cohort_bidding: u32,
    pub frame_id_at_cohort_activation: u32,
    pub frame_bidding_progress: f32,
    pub last_block_number: u32,
    #[serde(deserialize_with = "deserialize_from_bigint")]
    pub argons_bid_total: u64,
    #[serde(deserialize_with = "deserialize_from_bigint")]
    pub transaction_fees: u64,
    #[serde(deserialize_with = "deserialize_from_bigint")]
    pub argonots_staked_per_seat: u64,
    pub argonots_usd_price: f32,
    #[serde(deserialize_with = "deserialize_from_bigint")]
    pub argons_to_be_mined_per_block: u64,
    pub seats_won: u32,
    pub subaccounts: Vec<IBidsFileSubaccount>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IBidsFileSubaccount {
    pub index: u32,
    pub address: String,
    #[serde(default)]
    pub bid_position: Option<u32>,
    #[serde(default, deserialize_with = "deserialize_option_from_bigint")]
    pub argons_bid: Option<u64>,
    #[serde(default)]
    pub is_rebid: Option<bool>,
    #[serde(default)]
    pub last_bid_at_tick: Option<u32>,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IEarningsFile {
    pub frame_progress: f32,
    pub frame_tick_start: u32,
    pub frame_tick_end: u32,
    pub last_block_number: u32,
    pub by_frame_id_at_cohort_activation: std::collections::HashMap<String, IEarningsFileCohort>,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IEarningsFileCohort {
    pub last_block_mined_at: String,
    pub blocks_mined: u32,
    #[serde(deserialize_with = "deserialize_from_bigint")]
    pub argons_mined: u64,
    #[serde(deserialize_with = "deserialize_from_bigint")]
    pub argons_minted: u64,
    #[serde(deserialize_with = "deserialize_from_bigint")]
    pub argonots_mined: u64,
}

// GlobalStats
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IGlobalStats {
    pub active_cohorts: u32,
    pub active_seats: u32,
    pub total_blocks_mined: u32,
    pub total_argons_bid: u64,
    pub total_argons_minted: u64,
    pub total_argons_mined: u64,
    pub total_transaction_fees: u64,
    pub total_argonots_mined: u64,
}

// LatestCohortStats
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ICohortStats {
    pub frame_id_at_cohort_activation: u32,
    pub frame_tick_start: u32,
    pub frame_tick_end: u32,
    pub transaction_fees: u64,
    pub argonots_staked: u64,
    pub argons_bid: u64,
    pub seats_won: u32,
    pub blocks_mined: u32,
    pub argonots_mined: u64,
    pub argons_mined: u64,
    pub argons_minted: u64,
}

////////////////////////////////////////////////////////////
// BidderStats
////////////////////////////////////////////////////////////
pub struct BidderStats<'a> {
    app: AppHandle,
    ssh: &'a mut SSH,
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

impl<'a> BidderStats<'a> {
    pub fn new(app: AppHandle, ssh: &'a mut SSH, local_port: u16) -> Self {
        BidderStats {
            app,
            ssh,
            local_port,
            db_is_synced: false,
            has_won_seats: false,
            bids_last_modified_at: String::new(),
            earnings_last_modified_at: String::new(),
            last_argon_block_numbers: (0, 0),
            last_bitcoin_block_numbers: (0, 0),
            oldest_frame_id_to_sync: 0,
            current_frame_id: 0,
            last_processed_frame_id: Frames::latest_id().unwrap_or(0),
        }
    }

    pub async fn run(&mut self) -> Result<()> {
        self.update_argon_blockchain_status().await?;
        self.update_bitcoin_blockchain_status().await?;
        
        let bot_status = self.fetch_bidding_bot_status().await?;

        self.oldest_frame_id_to_sync = bot_status.oldest_frame_id_to_sync;
        self.current_frame_id = bot_status.current_frame_id;


        if bot_status.has_won_seats && !self.has_won_seats {
            self.set_has_won_seats().await?;
        }

        let has_bids_update = self.insert_db_bidding_activity(&bot_status)?;
        let has_earnings_update = self.insert_db_earnings_activity(&bot_status)?;

        if bot_status.load_progress < 100.0 {
            println!("Waiting for server to load: {}", bot_status.load_progress);
            if let Err(e) = self.app.emit("dataSync", json!({ "type": "server", "progress": bot_status.load_progress })) {
                error!("Error during emit loading: {}", e);
            }
            return Ok(());
        }
        
        if self.last_processed_frame_id < bot_status.current_frame_id {
            self.db_is_synced = false;
        }

        if self.db_is_synced {
            if has_bids_update {
                self.update_bids().await?;
            }
    
            if has_earnings_update {
                println!("Syncing earnings for frame: {}", bot_status.current_frame_id);
                self.sync_db_frame(bot_status.current_frame_id).await?;
            }

            if has_bids_update || has_earnings_update {
                let cohort_stats = Self::fetch_latest_cohort_stats()?;
                let global_stats = Self::fetch_global_stats()?;
                
                if let Err(e) = self.app.emit("stats", json!({
                    "cohortStats": cohort_stats,
                    "globalStats": global_stats,
                })) {
                    error!("Error emitting stats: {}", e);
                }
            }
        } else {
            println!("Ensuring DB is synced");
            self.ensure_db_is_synced().await?;
            self.db_is_synced = true;
        }

        Ok(())
    }

    async fn update_argon_blockchain_status(&mut self) -> Result<(u32, u32)> {
        let (argon_output, _) = self
            .ssh
            .run_command("docker exec commander-deploy-argon-miner-1 latestblock.sh")
            .await?;
        info!("ARGON output: {}", argon_output);

        let parts: Vec<&str> = argon_output.trim().split('-').collect();
        if parts.len() != 2 {
            return Err(anyhow::anyhow!("Invalid argon output format"));
        }
        let localhost_block = parts[0]
            .trim()
            .parse::<u32>()
            .map_err(|_| anyhow::anyhow!("Failed to parse localhost block number"))?;
        let mainchain_block = parts[1]
            .trim()
            .parse::<u32>()
            .map_err(|_| anyhow::anyhow!("Failed to parse mainchain block number"))?;

        if self.last_argon_block_numbers != (localhost_block, mainchain_block) {
            let record = ArgonActivities::insert(localhost_block, mainchain_block)?;
            self.last_argon_block_numbers = (localhost_block, mainchain_block);
            if let Err(e) = self.app.emit("argonActivity", record.clone()) {
                error!("Error emitting argon activity: {}", e);
            }
        }

        Ok((localhost_block, mainchain_block))
    }

    async fn update_bitcoin_blockchain_status(&mut self) -> Result<(u32, u32)> {
        let (bitcoin_output, _) = self
            .ssh
            .run_command("docker exec commander-deploy-bitcoin-1 latestblock.sh")
            .await?;

        let parts: Vec<&str> = bitcoin_output.trim().split('-').collect();
        if parts.len() != 2 {
            return Err(anyhow::anyhow!("Invalid bitcoin output format"));
        }
        let localhost_block = parts[0]
            .trim()
            .parse::<u32>()
            .map_err(|_| anyhow::anyhow!("Failed to parse localhost block number"))?;
        let mainchain_block = parts[1]
            .trim()
            .parse::<u32>()
            .map_err(|_| anyhow::anyhow!("Failed to parse mainchain block number"))?;

        if self.last_bitcoin_block_numbers != (localhost_block, mainchain_block) {
            let record = BitcoinActivities::insert(localhost_block, mainchain_block)?;
            self.last_bitcoin_block_numbers = (localhost_block, mainchain_block);
            if let Err(e) = self.app.emit("bitcoinActivity", record.clone()) {
                error!("Error emitting bitcoin activity: {}", e);
            }
        }

        Ok((localhost_block, mainchain_block))
    }

    async fn fetch_bidding_bot_status(&mut self) -> Result<IBotStatus> {
        let response = reqwest::get(format!("http://127.0.0.1:{}/status", self.local_port))
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch status: {}", e))?;

        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "Could not get response text".to_string());
        let sync_status: IBotStatus = serde_json::from_str(&text).map_err(|e| {
            anyhow::anyhow!("Failed to parse status JSON: {}. Response: {}", e, text)
        })?;

        Ok(sync_status)
    }

    async fn set_has_won_seats(&mut self) -> Result<()> {
        self.has_won_seats = true;
        let mut server_connection = ServerConnection::load()
            .map_err(|e| anyhow::anyhow!("Failed to load server connection: {}", e))?;
        server_connection.has_mining_seats = true;
        server_connection
            .save()
            .map_err(|e| anyhow::anyhow!("Failed to save server connection: {}", e))?;

        if let Err(e) = self.app.emit("serverConection", server_connection.clone()) {
            error!("Error emitting server connection: {}", e);
        }

        Ok(())
    }

    async fn ensure_db_is_synced(&mut self) -> Result<()> {
        let db_rows_expected = self.current_frame_id - self.oldest_frame_id_to_sync;

        if Frames::fetch_record_count().unwrap() == db_rows_expected {
            self.last_processed_frame_id = self.current_frame_id - 1;
            return Ok(());
        }

        println!("Syncing DB...");
        self.sync_db().await?;

        Ok(())
    }

    async fn sync_db(&mut self) -> Result<()> {
        let frames_to_sync = self.current_frame_id - self.oldest_frame_id_to_sync;
        let mut frames_synced = 0;
        
        for frame_id in self.oldest_frame_id_to_sync..=self.current_frame_id {
            let progress = (frames_synced as f32 / frames_to_sync as f32) * 100.0;
            if let Err(e) = self.app.emit("dataSync", json!({ "type": "db", "progress": progress })) {
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
        println!("Fetching earnings: {}", url);
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

        Frames::insert_or_update(frame_id, data.frame_tick_start, data.frame_tick_end, data.frame_progress, false)?;
        
        let mut processed_cohorts: HashSet<u32> = HashSet::new();
        
        let mut total_blocks_mined = 0;

        for (frame_id_at_cohort_activation_str, cohort_data) in data.by_frame_id_at_cohort_activation.iter() {
            let frame_id_at_cohort_activation = u32::from_str(frame_id_at_cohort_activation_str)
                .map_err(|e| anyhow::anyhow!("Failed to parse frame ID: {}", e))?;
            if !processed_cohorts.contains(&frame_id_at_cohort_activation) {
                self.sync_db_cohort(frame_id_at_cohort_activation, frame_id, data.frame_progress).await?;
                processed_cohorts.insert(frame_id_at_cohort_activation);
            }

            total_blocks_mined += cohort_data.blocks_mined;
            self.sync_db_cohort_frame(frame_id_at_cohort_activation, frame_id, cohort_data).await?;
        }

        println!("TOTAL BLOCKS MINED: {}", total_blocks_mined);

        let is_processed = data.frame_progress == 100.0;
        if is_processed {
            self.last_processed_frame_id = frame_id;
        }
        Frames::update(frame_id, data.frame_tick_start, data.frame_tick_end, data.frame_progress, is_processed)?;

        Ok(())
    }

    async fn sync_db_cohort_frame(&mut self, frame_id_at_cohort_activation: u32, frame_id: u32, data: &IEarningsFileCohort) -> Result<()> {
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

    async fn sync_db_cohort(&mut self, frame_id_at_cohort_activation: u32, current_frame_id: u32, current_frame_progress: f32) -> Result<()> {
        let data = self.fetch_bids_file(frame_id_at_cohort_activation).await?;
        
        if data.frame_bidding_progress < 100.0 {
            // cohort hasn't started yet so don't add to DB
            println!("Cohort hasn't started yet so don't add to DB: {} in {}", frame_id_at_cohort_activation, current_frame_id);
            return Ok(());
        }

        let frames_completed = current_frame_id - frame_id_at_cohort_activation;
        let progress = ((frames_completed as f32 * 100.0) + current_frame_progress) / 10.0;
        let argonots_staked = data.argonots_staked_per_seat * data.seats_won as u64;
        
        Cohorts::insert_or_update(
            frame_id_at_cohort_activation,
            progress,
            data.transaction_fees,
            argonots_staked,
            data.argons_bid_total,
            data.seats_won,
        )?;

        CohortAccounts::delete_for_cohort(frame_id_at_cohort_activation)?;

        for subaccount in data.subaccounts {
            CohortAccounts::insert(
                frame_id_at_cohort_activation,
                subaccount.index,
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
        if let Err(e) = self.app.emit("botActivity", record.clone()) {
            error!("Error emitting bot activity: {}", e);
        }
        Ok(true)
    }

    fn insert_db_earnings_activity(&mut self, sync_status: &IBotStatus) -> Result<bool> {
        if self.earnings_last_modified_at == sync_status.earnings_last_modified_at {
            return Ok(false);
        }
        let record = BotActivities::insert(
            "earnings changed",
            &sync_status.earnings_last_modified_at.clone(),
        )?;
        self.earnings_last_modified_at = sync_status.earnings_last_modified_at.clone();
        if let Err(e) = self.app.emit("botActivity", record.clone()) {
            error!("Error emitting bot activity: {}", e);
        }
        Ok(true)
    }
    
    async fn fetch_bids_file(&mut self, frame_id_at_cohort_activation: impl Into<Option<u32>>) -> Result<IBidsFile> {
        let url_base = format!("http://127.0.0.1:{}/bids", self.local_port);
        let url = match frame_id_at_cohort_activation.into() {
            Some(frame_id_at_cohort_activation) => format!(
                "{}/{}",
                url_base, frame_id_at_cohort_activation
            ),
            None => url_base
        };
        println!("Fetching cohort data for cohort: {}", url);
        let response = reqwest::get(url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch cohort biddings: {}", e))?;

        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "Could not get response text".to_string());

        let data: IBidsFile = serde_json::from_str(&text).map_err(|e| {
            anyhow::anyhow!("Failed to parse bids JSON: {}. Text: {}", e, text)
        })?;

        Ok(data)
    }

    pub async fn update_bids(&mut self) -> Result<()> {
        let bids_file = self.fetch_bids_file(None).await?;
        if let Err(e) = self.app.emit("currentBids", bids_file) {
            error!("Error emitting bids file: {}", e);
        }

        Ok(())
    }

    ////////////////////////////////////////////////////////////
    // Fetch Stats
    ////////////////////////////////////////////////////////////

    pub fn fetch_global_stats() -> Result<IGlobalStats> {
        let current_frame_id = Frames::latest_id()?;
        let (active_cohorts, active_seats, total_transaction_fees, total_argons_bid) =
            Cohorts::fetch_global_stats(current_frame_id)?;

        let (total_blocks_mined, total_argonots_mined, total_argons_mined, total_argons_minted) =
            CohortFrames::fetch_global_stats()?;

        Ok(IGlobalStats {
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

    pub fn fetch_latest_cohort_stats() -> Result<Option<ICohortStats>> {
        let cohort = match Cohorts::fetch_latest()? {
            Some(cohort) => cohort,
            None => return Ok(None),
        };
        
        let (blocks_mined, argonots_mined, argons_mined, argons_minted) = CohortFrames::fetch_cohort_stats(cohort.frame_id_at_cohort_activation)?;
        Ok(Some(ICohortStats {
            frame_id_at_cohort_activation: cohort.frame_id_at_cohort_activation,
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
