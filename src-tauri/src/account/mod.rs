use crate::db;

#[derive(Clone)]
pub struct AccountRecord {
    pub id: i64,
    pub address: String,
    pub private_json: String,
    pub requires_password: bool,
    pub is_saved: bool,
}

#[derive(Clone)]
pub struct Account {
    pub record: AccountRecord,
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

}
