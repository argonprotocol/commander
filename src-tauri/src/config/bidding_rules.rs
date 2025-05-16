use super::ConfigFile;
use serde::{Deserialize, Serialize};

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
#[serde(rename_all = "camelCase")]
pub struct BiddingRules {
    pub calculated_total_seats: i32,
    pub calculated_argon_circulation: f64,
    pub argonot_price_change_type: ArgonotPriceChangeType,
    pub argonot_price_change_min: f64,
    pub argonot_price_change_max: f64,
    pub starting_amount_formula_type: StartingAmountFormulaType,
    pub starting_amount_formula_increase: f64,
    pub starting_amount: f64,
    pub rebidding_delay: i32,
    pub increment_amount: f64,
    pub final_amount_formula_type: FinalAmountFormulaType,
    pub final_amount_formula_increase: f64,
    pub final_amount: f64,
    pub throttle_seats: bool,
    pub throttle_seat_count: i32,
    pub throttle_spending: bool,
    pub throttle_spending_amount: f64,
    pub throttle_distribute_evenly: bool,
    pub disable_bot: String,
    pub required_argons: i32,
    pub required_argonots: i32,
    pub desired_argons: i32,
    pub desired_argonots: i32,
}

impl ConfigFile<Option<Self>> for BiddingRules {
    const FILENAME: &'static str = "biddingRules.json";
}
