use serde::{Deserialize, Serialize};

/// Workspace configuration structure - matches the previous Python model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub files: Vec<FileMeta>,
    #[serde(default)]
    pub flow_nodes: Vec<FlowNode>,
}

/// File metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMeta {
    pub id: String,
    pub name: String,
    pub path: String,
    pub sheet: Option<String>,
    pub header_row: Option<i32>,
    #[serde(default)]
    pub columns: Vec<String>,
}

/// Flow node for data processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowNode {
    pub id: String,
    pub node_type: String,
    pub name: String,
    pub config: serde_json::Value, // Use generic JSON value for flexibility
    pub position: Position,
    #[serde(default)]
    pub inputs: Vec<String>,
    #[serde(default)]
    pub outputs: Vec<String>,
}

/// Position for nodes in the UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
} 