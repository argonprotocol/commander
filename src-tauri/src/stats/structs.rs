use serde::{Deserialize, Deserializer, Serialize};
use crate::db::{ArgonActivityRecord, BitcoinActivityRecord, BotActivityRecord};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IStats {
    pub is_syncing: bool,
    pub sync_progress: f32,
    pub has_won_seats: bool,
    pub dashboard: IDashboardStats,
    pub active_bids: IActiveBids,
    pub argon_activity: Vec<ArgonActivityRecord>,
    pub bitcoin_activity: Vec<BitcoinActivityRecord>,
    pub bot_activity: Vec<BotActivityRecord>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IDashboardStats {
    pub global: IDashboardGlobalStats,
    pub cohort: Option<IDashboardCohortStats>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IActiveBids {
    pub subaccounts: Vec<IBidsFileSubaccount>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IBotStatus {
    pub argon_block_numbers: (u32, u32),
    pub bitcoin_block_numbers: (u32, u32),
    pub bids_last_modified_at: String,
    pub earnings_last_modified_at: String,
    pub has_won_seats: bool,
    pub last_block_number: u32,
    pub last_finalized_block_number: u32,
    pub oldest_frame_id_to_sync: u32,
    pub current_frame_id: u32,
    pub load_progress: f32,
    pub queue_depth: u32,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
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

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
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
    pub by_cohort_frame_id: std::collections::HashMap<String, IEarningsFileCohort>,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IDashboardGlobalStats {
    pub active_cohorts: u32,
    pub active_seats: u32,
    pub total_blocks_mined: u32,
    pub total_argons_bid: u64,
    pub total_argons_minted: u64,
    pub total_argons_mined: u64,
    pub total_transaction_fees: u64,
    pub total_argonots_mined: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IDashboardCohortStats {
    pub cohort_id: u32,
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

// Helper Functions

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