use std::collections::HashMap;

use serde::{Deserialize, Serialize};

// Basic response structure for all API endpoints
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub status: String,
    pub message: Option<String>,
    pub data: Option<T>,
}

// Error response for returning errors
#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error_type: String,
    pub message: String,
} 

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexValues {
    pub columns: HashMap<String, Vec<String>>,
}
