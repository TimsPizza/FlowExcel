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
    #[serde(default)]
    pub flow_edges: Vec<FlowEdge>
}

/// Sheet metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SheetMeta {
    pub sheet_name: String,
    pub header_row: i32,
}

/// File metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMeta {
    pub id: String,
    pub name: String,
    pub path: String,
    pub sheet_metas: Vec<SheetMeta>,
}

/// Flow node types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NodeType {
    #[serde(rename = "indexSource")]
    IndexSource,
    #[serde(rename = "sheetSelector")]
    SheetSelector,
    #[serde(rename = "rowFilter")]
    RowFilter,
    #[serde(rename = "rowLookup")]
    RowLookup,
    #[serde(rename = "aggregator")]
    Aggregator,
    #[serde(rename = "output")]
    Output,
}

/// Base node data shared by all node types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaseNodeData {
    pub id: String,
    pub label: String,
    pub error: Option<String>,
    #[serde(rename = "testResult")]
    pub test_result: Option<serde_json::Value>,
}

/// Index source node data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexSourceNodeData {
    #[serde(flatten)]
    pub base: BaseNodeData,
    #[serde(rename = "sourceFileID")]
    pub source_file_id: Option<String>,
    #[serde(rename = "sheetName")]
    pub sheet_name: Option<String>,
    #[serde(rename = "columnNames")]
    pub column_names: Option<Vec<String>>,
}

/// Flow node for data processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub position: Position,
    pub data: serde_json::Value, // Use generic JSON value for flexibility
}

/// Flow edge connecting nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(rename = "sourceHandle")]
    pub source_handle: Option<String>,
    #[serde(rename = "targetHandle")]
    pub target_handle: Option<String>,
}

/// Position for nodes in the UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}
