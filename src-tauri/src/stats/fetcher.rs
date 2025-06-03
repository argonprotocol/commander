use log::{info};
use crate::ssh::SSH;
use crate::stats::structs::{IBidsFile, IBotStatus, IEarningsFile};
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

    pub async fn fetch_bot_status(local_port: u16) -> Result<IBotStatus> {
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

        Ok(bot_status)
    }

    pub async fn fetch_earnings_file(local_port: u16, frame_id: u32) -> Result<IEarningsFile> {
        let url = format!("http://127.0.0.1:{}/earnings/{}", local_port, frame_id);
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

        Ok(data)
    }

    pub async fn fetch_bids_file(
        local_port: u16,
        cohort_frame_id: impl Into<Option<u32>>,
    ) -> Result<IBidsFile> {
        let url_base = format!("http://127.0.0.1:{}/bids", local_port);
        let url = match cohort_frame_id.into() {
            Some(id) => {
                format!("{}/{}", url_base, id)
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
}