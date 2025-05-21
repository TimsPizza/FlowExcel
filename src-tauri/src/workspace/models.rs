use serde::{Deserialize, Serialize};

// Auxiliary struct for conditions in RowFilterNodeDataContext
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FilterCondition {
    pub column: String,
    pub operator: String,
    // Assuming value can be string or number, will be handled by serde_json::Value or specific types
    pub value: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logic: Option<String>, // "AND" | "OR"
}

/// Represents the `data` property of a React Flow node, now an enum based on `nodeType`.
/// This corresponds to FlowNodeData in TypeScript.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "nodeType")] // This is the discriminant field from TypeScript
pub enum RustFlowNodeData {
    #[serde(rename = "indexSource")]
    IndexSource {
        id: String,
        label: String,
        #[serde(rename = "sourceFileID", skip_serializing_if = "Option::is_none")]
        source_file_id: Option<String>,
        #[serde(rename = "bySheetName", skip_serializing_if = "Option::is_none")]
        by_sheet_name: Option<bool>,
        #[serde(rename = "sheetName", skip_serializing_if = "Option::is_none")]
        sheet_name: Option<String>,
        #[serde(rename = "byColumn", skip_serializing_if = "Option::is_none")]
        by_column: Option<bool>,
        #[serde(rename = "columnName", skip_serializing_if = "Option::is_none")]
        column_name: Option<String>,
        // #[serde(rename = "testResult", skip_serializing_if = "Option::is_none")]
        // test_result: Option<serde_json::Value>, // Assuming SimpleDataframe serializes to JSON
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
    #[serde(rename = "sheetSelector")]
    SheetSelector {
        id: String,
        label: String,
        #[serde(rename = "targetFileID", skip_serializing_if = "Option::is_none")]
        target_file_id: Option<String>,
        mode: String, // "auto_by_index" | "manual"
        #[serde(rename = "manualSheetName", skip_serializing_if = "Option::is_none")]
        manual_sheet_name: Option<String>,
        // #[serde(rename = "testResult", skip_serializing_if = "Option::is_none")]
        // test_result: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
    #[serde(rename = "rowFilter")]
    RowFilter {
        id: String,
        label: String,
        conditions: Vec<FilterCondition>,
        // #[serde(rename = "testResult", skip_serializing_if = "Option::is_none")]
        // test_result: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
    #[serde(rename = "rowLookup")]
    RowLookup {
        id: String,
        label: String,
        #[serde(rename = "matchColumn", skip_serializing_if = "Option::is_none")]
        match_column: Option<String>,
        // #[serde(rename = "testResult", skip_serializing_if = "Option::is_none")]
        // test_result: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
    #[serde(rename = "aggregator")]
    Aggregator {
        id: String,
        label: String,
        #[serde(rename = "statColumn", skip_serializing_if = "Option::is_none")]
        stat_column: Option<String>,
        method: String, // "sum" | "avg" | "count" | "min" | "max"
        // #[serde(rename = "testResult", skip_serializing_if = "Option::is_none")]
        // test_result: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
    #[serde(rename = "output")]
    Output {
        id: String,
        label: String,
        #[serde(rename = "outputFormat", skip_serializing_if = "Option::is_none")]
        output_format: Option<String>, // "table" | "csv" | "excel"
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
}

/// Represents a node in React Flow: Node<FlowNodeData> from TypeScript.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReactFlowNode {
    pub id: String,
    #[serde(rename = "type")] // This is the React Flow node type string, e.g., "indexSource"
    pub rf_node_type: String,
    pub position: Position,
    pub data: RustFlowNodeData, // This is our new enum, equivalent to TS FlowNodeData
}

/// Workspace configuration structure
#[derive(Debug, Clone, Serialize, Deserialize, Default)] // Added Default
pub struct WorkspaceConfig {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub files: Vec<FileMeta>,
    #[serde(default)]
    pub flow_nodes: Vec<ReactFlowNode>,
    #[serde(default)]
    pub flow_edges: Vec<FlowEdge>,
}

/// Sheet metadata
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SheetMeta {
    pub sheet_name: String,
    pub header_row: i32,
}

/// File metadata
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FileMeta {
    pub id: String,
    pub name: String,
    pub path: String,
    pub sheet_metas: Vec<SheetMeta>,
}

// This NodeType enum can be used for internal logic if needed,
// but deserialization of RustFlowNodeData relies on the `nodeType` tag.
// The variant names here are PascalCase as per Rust convention.
// Their serde rename should match the string values used in the `nodeType` tag.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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

/// Flow edge connecting nodes
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(rename = "sourceHandle", skip_serializing_if = "Option::is_none")]
    pub source_handle: Option<String>,
    #[serde(rename = "targetHandle", skip_serializing_if = "Option::is_none")]
    pub target_handle: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}
