use super::Config;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::path::Path;

#[derive(Deserialize, Serialize, Clone)]
pub enum ArgonotPriceChangeType {
    Between,
    Exactly,
}

#[derive(Deserialize, Serialize, Clone)]
pub enum StartingAmountFormulaType {
    PreviousLowestBid,
    MinimumBreakeven,
    OptimisticBreakeven,
    Custom,
}

#[derive(Deserialize, Serialize, Clone)]
pub enum FinalAmountFormulaType {
    PreviousHighestBid,
    MinimumBreakeven,
    OptimisticBreakeven,
    Custom,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct BiddingRules {
    #[serde(rename = "calculatedTotalSeats")]
    pub calculated_total_seats: i32,
    #[serde(rename = "calculatedArgonCirculation")]
    pub calculated_argon_circulation: f64,
    #[serde(rename = "argonotPriceChangeType")]
    pub argonot_price_change_type: ArgonotPriceChangeType,
    #[serde(rename = "argonotPriceChangeMin")]
    pub argonot_price_change_min: f64,
    #[serde(rename = "argonotPriceChangeMax")]
    pub argonot_price_change_max: f64,
    #[serde(rename = "startingAmountFormulaType")]
    pub starting_amount_formula_type: StartingAmountFormulaType,
    #[serde(rename = "startingAmountFormulaIncrease")]
    pub starting_amount_formula_increase: f64,
    #[serde(rename = "startingAmount")]
    pub starting_amount: f64,
    #[serde(rename = "rebiddingDelay")]
    pub rebidding_delay: i32,
    #[serde(rename = "incrementAmount")]
    pub increment_amount: f64,
    #[serde(rename = "finalAmountFormulaType")]
    pub final_amount_formula_type: FinalAmountFormulaType,
    #[serde(rename = "finalAmountFormulaIncrease")]
    pub final_amount_formula_increase: f64,
    #[serde(rename = "finalAmount")]
    pub final_amount: f64,
    #[serde(rename = "throttleSeats")]
    pub throttle_seats: bool,
    #[serde(rename = "throttleSeatCount")]
    pub throttle_seat_count: i32,
    #[serde(rename = "throttleSpending")]
    pub throttle_spending: bool,
    #[serde(rename = "throttleSpendingAmount")]
    pub throttle_spending_amount: f64,
    #[serde(rename = "throttleDistributeEvenly")]
    pub throttle_distribute_evenly: bool,
    #[serde(rename = "disableBot")]
    pub disable_bot: String,
    #[serde(rename = "requiredArgons")]
    pub required_argons: i32,
    #[serde(rename = "requiredArgonots")]
    pub required_argonots: i32,
    #[serde(rename = "desiredArgons")]
    pub desired_argons: i32,
    #[serde(rename = "desiredArgonots")]
    pub desired_argonots: i32,
}

impl BiddingRules {
    pub const FILENAME: &'static str = "biddingRules.json";

    pub fn load() -> Result<Option<Self>, Box<dyn Error>> {
        let file_path = Config::get_full_path(Self::FILENAME);

        if Path::new(&file_path).exists() {
            Config::load_from_json_file(Self::FILENAME).map(Some)
        } else {
            Ok(None)
        }
    }

    pub fn save(&self) -> Result<(), Box<dyn Error>> {
        Config::save_to_json_file(Self::FILENAME, self.clone())
    }
}
