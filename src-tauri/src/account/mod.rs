use crate::db;
use std::fs;
use std::path::Path;
use serde_json;

#[derive(Clone)]
pub struct AccountRecord {
    pub id: i64,
    pub address: String,
    pub private_json: String,
    pub requires_password: bool,
    pub is_saved: bool,
    pub bidding_config: Option<BiddingRules>,
}

#[derive(Clone)]
pub struct Account {
    pub record: AccountRecord,
}


#[derive(serde::Deserialize, serde::Serialize, Clone)]
pub struct BiddingRules {
    #[serde(rename = "calculatedTotalSeats")]
    pub calculated_total_seats: i32,
    #[serde(rename = "calculatedArgonCirculation")]
    pub calculated_argon_circulation: f64,
    #[serde(rename = "argonotPriceChangeType")]
    pub argonot_price_change_type: i32,
    #[serde(rename = "argonotPriceChangeMin")]
    pub argonot_price_change_min: f64,
    #[serde(rename = "argonotPriceChangeMax")]
    pub argonot_price_change_max: f64,
    #[serde(rename = "startingAmountFormulaType")]
    pub starting_amount_formula_type: i32,
    #[serde(rename = "startingAmountFormulaIncrease")]
    pub starting_amount_formula_increase: f64,
    #[serde(rename = "startingAmount")]
    pub starting_amount: f64,
    #[serde(rename = "rebiddingDelay")]
    pub rebidding_delay: i32,
    #[serde(rename = "incrementAmount")]
    pub increment_amount: f64,
    #[serde(rename = "finalAmountFormulaType")]
    pub final_amount_formula_type: i32,
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
}

// Implement Send and Sync explicitly to confirm thread-safety
unsafe impl Send for Account {}
unsafe impl Sync for Account {}

impl Account {
    pub fn init() -> Result<Self, String> {
        db::init().map_err(|e| e.to_string())?;

        // Try to fetch existing record
        match db::try_fetch_account_record().map_err(|e| e.to_string())? {
            Some(account_record) => {
                Ok(Account { 
                    record: AccountRecord {
                        id: account_record.id,
                        address: account_record.address.clone(),
                        private_json: account_record.private_json.clone(),
                        requires_password: account_record.requires_password,
                        is_saved: true,
                        bidding_config: Account::fetch_bidding_config(),
                    },
                })
            }
            None => {
                Ok(Account { 
                    record: AccountRecord {
                        id: 0,
                        address: "".to_string(),
                        private_json: "".to_string(),
                        requires_password: false,
                        is_saved: false,
                        bidding_config: None,
                    },
                })
            }
        }
    }

    pub async fn update_record(&mut self, address: String, private_json: String, requires_password: bool) -> Result<(), String> {
        self.record.address = address;
        self.record.private_json = private_json;
        self.record.requires_password = requires_password;
        self.save().await.map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn from_record(record: AccountRecord) -> Self {
        Self { record }
    }

    pub async fn save(&mut self) -> Result<(), String> {
        if self.record.is_saved {
            db::update_account_record(
                &self.record.id,
                &self.record.address,    
                &self.record.private_json,
                self.record.requires_password
            ).map_err(|e| e.to_string())?;
        } else {
            self.record.id = db::create_account_record(
                &self.record.address,
                &self.record.private_json,
                self.record.requires_password
            ).map_err(|e| e.to_string())?;
        }

        self.record.is_saved = true;
        Ok(())
    }

    pub async fn save_bidding_rules(&mut self, rules: BiddingRules) -> Result<(), String> {
        // Get the database path to determine where to save the JSON file
        let db_path = db::get_db_path();
        let db_dir = Path::new(&db_path).parent().unwrap();
        
        // Create the bidding rules file path in the same directory as the database
        let rules_file_path = db_dir.join("bidding_rules.json");
        
        // Serialize the rules to JSON
        let json = serde_json::to_string_pretty(&rules)
            .map_err(|e| format!("Failed to serialize bidding rules: {}", e))?;
        
        // Write the JSON to the file
        fs::write(&rules_file_path, json)
            .map_err(|e| format!("Failed to write bidding rules to file: {}", e))?;
        
        Ok(())
    }

    pub fn fetch_bidding_config() -> Option<BiddingRules> {
        let db_path = db::get_db_path();
        let db_dir = Path::new(&db_path).parent().unwrap();
        let rules_file_path = db_dir.join("bidding_rules.json");
        
        // Try to read the file, return None if it doesn't exist
        let json = match fs::read_to_string(&rules_file_path) {
            Ok(content) => content,
            Err(_) => return None,
        };
        
        // Try to parse the JSON, return None if parsing fails
        match serde_json::from_str(&json) {
            Ok(rules) => Some(rules),
            Err(_) => None,
        }
    }
}
