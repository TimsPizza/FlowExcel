// 使用从nodes.ts导入的类型定义
import { Edge, Node, OnConnect, OnEdgesChange, OnNodesChange } from "reactflow";
import { FlowNodeData } from "./nodes";

// Backend event types matching Rust definitions
export interface BackendEndpoints {
  health: string;
  shutdown: string;
}

export interface BackendInfo {
  host: string;
  port: number;
  api_base: string;
  endpoints: BackendEndpoints;
}

export interface BackendErrorEvent {
  error: string;
}

export interface ExcelInfo {
  sheets: string[];
  sheet_info: {
    [key: string]: {
      columns: string[];
    };
  };
  status: string;
}

export interface PreviewData {
  columns: string[];
  data: (string | number)[][];
}

// Updated to match backend APIResponse structure
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/* Zustand Store Types */

export interface SheetMeta {
  sheet_name: string;
  header_row: number;
  // columns: string[];
}

export interface FileMeta {
  id: string;
  name: string;
  path: string;
  sheet_metas: SheetMeta[];
  file_info: FileInfo;
}

// Workspace配置类型
export interface WorkspaceConfig {
  id: string;
  name: string;
  files: FileMeta[];
  flow_nodes: Node<FlowNodeData>[]; // React Flow的Node类型与我们的数据结构
  flow_edges: Edge[];
}

// For responses from Tauri commands
export interface FilePreviewResponse {
  sheets: SheetInfo[];
}

export interface SimpleDataframe {
  columns?: string[]; // index column names
  data?: any[][];
}

export interface IndexValues {
  column: string;
  data: any[]; // 1d array of values
}

export interface TryReadSheetNamesResponse {
  sheet_names: string[];
}

export interface TryReadHeaderRowResponse {
  column_names: string[];
}

export interface SheetInfo {
  sheet_name: string;
  columns: string[];
  data: Array<Array<string | number | null>>;
}

export interface ErrorResponse {
  error_type: string;
  message: string;
}

// --- Store State and Actions ---
// Export the state type
export interface WorkspaceState {
  currentWorkspace: WorkspaceConfig | null;
  isDirty: boolean; // 新增：跟踪工作区是否有未保存的更改
  outdatedFileIds: string[]; // 新增：跟踪工作区文件是否发生过变化，如有，则需要重新加载文件以保证流程执行正确性

  // Actions

  // Create a new workspace with the given id and name and set it as the current workspace
  createWorkspace: (id: string, name?: string) => void; // Takes id and optional name
  loadWorkspace: (workspace: WorkspaceConfig) => void;
  setCurrentWorkspaceName: (name: string) => void;
  markFileAsOutdated: (fileId: string) => void;
  upToDateFileInfo: (fileId: string, newFileInfo: FileInfo) => void;
  // For addFileToWorkspace, expect columns to be provided externally after backend call
  addFileToWorkspace: (
    fileMetaWithFileIdAndColumns: FileMeta,
  ) => WorkspaceConfig | null;
  updateFileMeta: (
    fileId: string,
    updates: Partial<Omit<FileMeta, "id">>,
  ) => void;
  removeFileFromWorkspace: (fileId: string) => void;

  // Flow Actions
  addFlowNode: (node: Node<FlowNodeData>) => void;
  updateNodeData: (
    nodeId: string,
    data: Partial<FlowNodeData>,
    markDirty?: boolean,
  ) => void;
  removeFlowNode: (nodeId: string) => void;

  removeFlowEdge: (edgeId: string) => void;

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  clearCurrentWorkspace: () => void;
  resetDirty: () => void; // 新增：重置dirty状态
  markAsDirty: () => void; // 新增：标记为已修改
}

// --- Data type from Python pipeline ---
// Updated to match backend's new response structure

// Backend PipelineNodeResult structure
export interface PipelineNodeResult {
  node_id: string;
  node_type: string;
  success: boolean;
  execution_time_ms: number;
  sheets?: SheetInfo[];
  result_data?: {
    columns: string[];
    data: Array<string | number | null>[];
    total_rows: number;
  };
  error?: string;
  message?: string;
}

// Backend PipelineExecutionResult structure
export interface PipelineExecutionResult {
  result: {
    success: boolean;
    warnings?: string[];
    error?: string;
    execution_time?: number;
    output_data?: {
      sheets: Array<{
        sheet_name: string;
        dataframe: SimpleDataframe & {
          total_rows: number;
        };
        branch_id: string;
        source_name: string;
      }>;
      total_sheets: number;
    };
  };
  execution_time?: number;
}

// Node test response structure
export interface NodeTestResult {
  success: boolean;
  node_id: string;
  node_type: string;
  execution_time_ms: number;
  sheets?: SheetInfo[];
  result_data?: {
    columns: string[];
    data: Array<string | number | null>[];
    total_rows: number;
  };
  error?: string;
  message?: string;
}

// New: Node preview result types for the enhanced preview API
export interface NodePreviewResult {
  success: boolean;
  node_id: string;
  node_type: string;
  execution_time_ms?: number;
  error?: string;
}

export interface IndexSourcePreviewResult extends NodePreviewResult {
  index_values: string[];
  source_column?: string;
  preview_data: {
    sheet_name: string;
    columns: string[];
    data: string[][];
    metadata: {
      total_count: number;
      preview_count: number;
    };
  };
}

export interface DataFramePreviewResult extends NodePreviewResult {
  dataframe_previews: Array<{
    sheet_name: string;
    columns: string[];
    data: Array<Array<string | number | null>>;
    metadata: {
      total_rows: number;
      preview_rows: number;
      index_value: string;
      [key: string]: any;
    };
  }>;
}

export interface AggregationPreviewResult extends NodePreviewResult {
  aggregation_results: Array<{
    index_value: string;
    column_name: string;
    operation: string;
    result_value: any;
  }>;
  preview_data: {
    sheet_name: string;
    columns: string[];
    data: Array<Array<string | number | null>>;
    metadata: {
      total_count: number;
    };
  };
}

// Union type for all possible preview results
export type PreviewNodeResult =
  | IndexSourcePreviewResult
  | DataFramePreviewResult
  | AggregationPreviewResult
  | NodePreviewResult;

export interface FileInfoResponse {
  file_info: FileInfo;
}

export interface FileInfo {
  last_modified: string;
  file_size: number;
  file_hash: string;
}
