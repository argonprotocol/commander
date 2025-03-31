use crate::db;
use crate::ssh::SSH;

#[derive(Clone)]
pub struct ServerRecord {
    pub id: i64,
    pub address: String,
    pub private_key: String,
    pub public_key: String,
    pub requires_password: bool,
    pub setup_status: db::SetupStatus,
    pub is_saved: bool,
}

#[derive(Clone)]
pub struct Server {
    pub record: ServerRecord,
}

// Implement Send and Sync explicitly to confirm thread-safety
unsafe impl Send for Server {}
unsafe impl Sync for Server {}

impl Server {
    pub fn init() -> Result<Self, String> {
        db::init().map_err(|e| e.to_string())?;

        // Try to fetch existing record
        match db::try_fetch_server_record().map_err(|e| e.to_string())? {
            Some(server_record) => {
                Ok(Server { 
                    record: ServerRecord {
                        id: server_record.id,
                        address: server_record.address.clone(),
                        private_key: server_record.private_key.clone(),
                        public_key: server_record.public_key.clone(),
                        requires_password: server_record.requires_password,
                        setup_status: server_record.setup_status.clone(),
                        is_saved: true,
                    },
                })
            }
            None => {
                // Generate new keys but don't save to database
                let (private_key, public_key) = SSH::generate_keys()?;
                
                Ok(Server {
                    record: ServerRecord {
                        id: 0,
                        address: String::new(),
                        private_key: private_key,
                        public_key: public_key,
                        requires_password: false,
                        setup_status: db::SetupStatus::default(),
                        is_saved: false,
                    },
                })
            }
        }
    }

    pub async fn refresh_setup_status(&mut self) -> Result<(), String> {
        // Create SSH connection outside the lock
        let mut ssh = SSH::connect(&self.record.private_key, "root", &self.record.address, 22)
            .await
            .map_err(|e| e.to_string())?;
            
        let status = ssh.setup_server().await.map_err(|e| e.to_string())?;
        ssh.close().await.map_err(|e| e.to_string())?;
        
        self.record.setup_status = status;
        self.save().await.map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn from_record(record: ServerRecord) -> Self {
        Self { record }
    }

    pub async fn save(&mut self) -> Result<(), String> {
        if self.record.is_saved {
            db::update_server_record(
                &self.record.id,
                &self.record.address,    
                &self.record.private_key, 
                &self.record.public_key,
                &self.record.setup_status,
                self.record.requires_password,
            ).map_err(|e| e.to_string())?;
        } else {
            self.record.id = db::create_server_record(
                &self.record.address,
                &self.record.private_key,
                &self.record.public_key,
                &self.record.setup_status,
                self.record.requires_password,
            ).map_err(|e| e.to_string())?;
        }

        self.record.is_saved = true;
        Ok(())
    }
}
