use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendEndpoints {
    pub health: String,
    pub shutdown: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandshakePayload {
    pub host: String,
    pub port: u16,
    pub api_base: String,
    pub endpoints: BackendEndpoints,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BackendState {
    NotStarted,
    Starting,
    Running(HandshakePayload),
    Failed(String),
    Restarting,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendStatus {
    pub state: BackendState,
    pub last_heartbeat: Option<u64>, // Unix timestamp
    pub restart_count: u32,
} 