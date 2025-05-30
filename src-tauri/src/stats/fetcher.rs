use log::{error, info};
use crate::ssh::SSH;
use crate::stats::structs::IBotStatus;
use crate::config::{ConfigFile, ServerDetails};
use anyhow::Result;

pub struct StatsFetcher;

impl StatsFetcher {
    pub async fn fetch_argon_blockchain_status(ssh: &SSH) -> Result<(u32, u32)> {
        let (argon_output, _) = ssh
            .run_command("docker exec deploy-argon-miner-1 latestblocks.sh")
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

        Ok((localhost_block, mainchain_block))
    }

    pub async fn fetch_bitcoin_blockchain_status(ssh: &SSH) -> Result<(u32, u32)> {
        let (bitcoin_output, _) = ssh
            .run_command("docker exec deploy-bitcoin-1 latestblocks.sh")
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

        Ok((localhost_block, mainchain_block))
    }

    pub async fn fetch_bidding_bot_status(local_port: u16) -> Result<IBotStatus> {
        let response = reqwest::get(format!("http://127.0.0.1:{}/status", local_port))
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch status: {}", e))?;

        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "Could not get response text".to_string());
        let bot_status: IBotStatus = serde_json::from_str(&text).map_err(|e| {
            anyhow::anyhow!("Failed to parse status JSON: {}. Response: {}", e, text)
        })?;

        Self::update_server_details(&bot_status)?;

        Ok(bot_status)
    }

    fn update_server_details(bot_status: &IBotStatus) -> Result<()> {
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