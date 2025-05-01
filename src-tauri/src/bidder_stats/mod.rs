use crate::config::ServerConnection;
use crate::db::{ArgonActivity, BitcoinActivity, BotActivity};
use crate::ssh::SSH;
use anyhow::Result;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

lazy_static! {
    static ref RUNNING_TASK: Mutex<Option<tokio::task::JoinHandle<()>>> = Mutex::new(None);
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IBidderSubaccount {
    #[serde(rename = "index")]
    index: u32,
    #[serde(rename = "isRebid")]
    is_rebid: bool,
    #[serde(rename = "address")]
    address: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IBidderData {
    #[serde(rename = "cohortId")]
    cohort_id: u32,
    #[serde(rename = "lastBlock")]
    last_block: u32,
    #[serde(rename = "seats")]
    seats: u32,
    #[serde(rename = "totalArgonsBid")]
    total_argons_bid: String,
    #[serde(rename = "fees")]
    fees: String,
    #[serde(rename = "maxBidPerSeat")]
    max_bid_per_seat: String,
    #[serde(rename = "argonotsPerSeat")]
    argonots_per_seat: String,
    #[serde(rename = "argonotUsdPrice")]
    argonot_usd_price: f64,
    #[serde(rename = "cohortArgonsPerBlock")]
    cohort_argons_per_block: String,
    #[serde(rename = "subaccounts")]
    subaccounts: Vec<IBidderSubaccount>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LastProcessed {
    #[serde(rename = "blockNumber")]
    block_number: u64,
    #[serde(rename = "rotation")]
    rotation: u32,
    #[serde(rename = "date")]
    date: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IStatusResponse {
    #[serde(rename = "biddingsLastUpdated")]
    biddings_last_updated: String,
    #[serde(rename = "earningsLastUpdated")]
    earnings_last_updated: String,
    #[serde(rename = "hasWonSeats")]
    has_won_seats: bool,
    #[serde(rename = "latestSynched")]
    latest_synched: u64,
    #[serde(rename = "latestFinalized")]
    latest_finalized: u64,
    #[serde(rename = "firstRotation")]
    first_rotation: u32,
    #[serde(rename = "currentRotation")]
    current_rotation: u32,
    #[serde(rename = "queueDepth")]
    queue_depth: u64,
    #[serde(rename = "lastProcessed")]
    last_processed: LastProcessed,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ISubaccount {
    pub index: u32,
    pub address: String,
    pub is_rebid: bool,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct IBiddingsFile {
    #[serde(rename = "cohortId")]
    pub cohort_id: u32,
    #[serde(rename = "lastBlock")]
    pub last_block: u64,
    pub seats: u32,
    #[serde(rename = "totalArgonsBid")]
    pub total_argons_bid: String,
    pub fees: String,
    #[serde(rename = "maxBidPerSeat")]
    pub max_bid_per_seat: String,
    #[serde(rename = "argonotsPerSeat")]
    pub argonots_per_seat: String,
    #[serde(rename = "argonotUsdPrice")]
    pub argonot_usd_price: f64,
    #[serde(rename = "cohortArgonsPerBlock")]
    pub cohort_argons_per_block: String,
    pub subaccounts: Vec<ISubaccount>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct IEarningsCohort {
    #[serde(rename = "argonotsMined")]
    pub argonots_mined: String,
    #[serde(rename = "argonsMined")]
    pub argons_mined: String,
    #[serde(rename = "argonsMinted")]
    pub argons_minted: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct IEarningsFile {
    #[serde(rename = "lastBlock")]
    pub last_block: u64,
    #[serde(rename = "byCohortId")]
    pub by_cohort_id: std::collections::HashMap<String, IEarningsCohort>,
}

pub struct BidderStats<'a> {
    app: AppHandle,
    ssh: &'a mut SSH,
    local_port: u16,

    biddings_last_updated: String,
    earnings_last_updated: String,

    argon_mining_status: (u32, u32),
    bitcoin_mining_status: (u32, u32),
}

impl<'a> BidderStats<'a> {
    pub fn new(app: AppHandle, ssh: &'a mut SSH, local_port: u16) -> Self {
        BidderStats {
            app,
            biddings_last_updated: String::new(),
            earnings_last_updated: String::new(),
            ssh,
            local_port,
            argon_mining_status: (0, 0),
            bitcoin_mining_status: (0, 0),
        }
    }

    pub async fn run(&mut self) -> Result<()> {
        let status = self.update_sync_status().await?;

        // // If processed rotation is less than current rotation, we need to update the biddings and earnings

        // if self.biddings_last_updated != status.biddings_last_updated {
        //     self.update_biddings(status.current_rotation).await?; // TODO: once Blake applies his rotation fix to mainchain, we need to increment this by 1
        // }
        // if self.earnings_last_updated != status.earnings_last_updated {
        //     self.update_earnings(status.current_rotation).await?;
        // }

        self.update_argon_blockchain_status().await?;
        self.update_bitcoin_blockchain_status().await?;

        Ok(())
    }

    async fn update_sync_status(&mut self) -> Result<(bool, bool)> {
        let response = reqwest::get(format!("http://127.0.0.1:{}/status", self.local_port))
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch status: {}", e))?;

        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "Could not get response text".to_string());
        let status: IStatusResponse = serde_json::from_str(&text).map_err(|e| {
            anyhow::anyhow!(
                "Failed to parse status JSON: {}. Response text: {}",
                e,
                text
            )
        })?;

        if status.has_won_seats {
            let mut server_connection = ServerConnection::load()
                .map_err(|e| anyhow::anyhow!("Failed to load server connection: {}", e))?;
            server_connection.has_mining_seats = true;
            server_connection
                .save()
                .map_err(|e| anyhow::anyhow!("Failed to save server connection: {}", e))?;
        }

        let mut biddings_were_updated = false;
        let mut earnings_were_updated = false;

        if self.biddings_last_updated != status.biddings_last_updated {
            let record = BotActivity::insert("biddings changed", &status.biddings_last_updated)?;
            self.biddings_last_updated = status.biddings_last_updated;
            biddings_were_updated = true;
            if let Err(e) = self.app.emit("botActivity", record.clone()) {
                println!("Error emitting bot activity: {}", e);
            }
        }

        if self.earnings_last_updated != status.earnings_last_updated {
            let record = BotActivity::insert("earnings changed", &status.earnings_last_updated)?;
            self.earnings_last_updated = status.earnings_last_updated;
            earnings_were_updated = true;
            if let Err(e) = self.app.emit("botActivity", record.clone()) {
                println!("Error emitting bot activity: {}", e);
            }
        }

        Ok((biddings_were_updated, earnings_were_updated))
    }

    async fn update_biddings(&mut self, next_cohort_id: u32) -> Result<()> {
        let response = reqwest::get(format!(
            "http://127.0.0.1:{}/biddings/{}",
            self.local_port, next_cohort_id
        ))
        .await
        .map_err(|e| anyhow::anyhow!("Failed to fetch biddings/: {}", e))?;

        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "Could not get response text".to_string());
        let status: IBiddingsFile = serde_json::from_str(&text).map_err(|e| {
            anyhow::anyhow!(
                "Failed to parse status JSON: {}. Response text: {}",
                e,
                text
            )
        })?;

        Ok(())
    }

    async fn update_earnings(&mut self, rotation_id: u32) -> Result<()> {
        let response = reqwest::get(format!(
            "http://127.0.0.1:{}/earnings/{}",
            self.local_port, rotation_id
        ))
        .await
        .map_err(|e| anyhow::anyhow!("Failed to fetch earnings/: {}", e))?;

        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "Could not get response text".to_string());
        let status: IEarningsFile = serde_json::from_str(&text).map_err(|e| {
            anyhow::anyhow!(
                "Failed to parse status JSON: {}. Response text: {}",
                e,
                text
            )
        })?;

        Ok(())
    }

    async fn update_argon_blockchain_status(&mut self) -> Result<(u32, u32)> {
        let (argon_output, _) = self
            .ssh
            .run_command("docker exec commander-deploy-argon-miner-1 latestblock.sh")
            .await?;
        println!("ARGON output: {}", argon_output);

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

        if self.argon_mining_status != (localhost_block, mainchain_block) {
            let record = ArgonActivity::insert(localhost_block, mainchain_block)?;
            self.argon_mining_status = (localhost_block, mainchain_block);
            if let Err(e) = self.app.emit("argonActivity", record.clone()) {
                println!("Error emitting argon activity: {}", e);
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

        if self.bitcoin_mining_status != (localhost_block, mainchain_block) {
            let record = BitcoinActivity::insert(localhost_block, mainchain_block)?;
            self.bitcoin_mining_status = (localhost_block, mainchain_block);
            if let Err(e) = self.app.emit("bitcoinActivity", record.clone()) {
                println!("Error emitting bitcoin activity: {}", e);
            }
        }

        Ok((localhost_block, mainchain_block))
    }

    async fn fetch_current_bidding_data(ssh: &mut SSH) -> Result<String> {
        let (sync_state, _code) = match ssh
            .run_command("cat ~/commander-data/sync-state.json")
            .await
        {
            Ok(result) => result,
            Err(e) => return Err(anyhow::anyhow!("Failed to fetch sync-state.json: {}", e)),
        };

        // Parse the sync state JSON
        let sync_state: serde_json::Value = serde_json::from_str(&sync_state)
            .map_err(|e| anyhow::anyhow!("Failed to parse sync-state.json: {}", e))?;

        // Extract the lastBlockByRotation object
        let last_block_by_rotation = sync_state["lastBlockByRotation"]
            .as_object()
            .ok_or_else(|| anyhow::anyhow!("lastBlockByRotation is not an object"))?;

        // Find the highest rotation number
        let highest_rotation = last_block_by_rotation
            .keys()
            .filter_map(|k| k.parse::<u32>().ok())
            .max()
            .ok_or_else(|| anyhow::anyhow!("No valid rotation numbers found"))?;

        let filename = format!("cohort-{}.json", highest_rotation);
        let command = format!("cat ~/commander-data/bidding/{}", filename);
        let (bidding_data, _code) = match ssh.run_command(command.as_str()).await {
            Ok(result) => result,
            Err(_) => return Err(anyhow::anyhow!("Failed to fetch {}", filename)),
        };

        Ok(bidding_data)
    }
}
