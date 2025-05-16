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

export interface ApiResponse<T> {
  status: string;
  message?: string;
  data?: T;
}

/* Zustand Store Types */

export interface SheetMeta {
  sheet_name: string;
  header_row: number;
}

export interface FileMeta {
  id: string;
  alias: string;
  path: string;
  sheet_metas: SheetMeta[];
}

// Use unknown instead of any for better type safety
export interface FlowNodeData {
  [key: string]: unknown;
}

// Extend React Flow's Node type if needed, or use it directly
// For now, defining our own simplified version
export interface FlowNode {
  id: string; // Use id consistent with React Flow
  type: string; // e.g., 'primarySource', 'linkedProcessing'
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface PrimarySourceNodeData extends FlowNodeData {
  fileId?: string;
  indexColumns?: string[];
}

export interface AssociationNodeData extends FlowNodeData {
  incomingIndexName?: string; // Name of the index column from the source node
  fileId?: string; // ID of the excel file to associate with
  inputIndexColumn?: string; // Column in this file to match against incomingIndexName
  dataColumn?: string; // Column in this file to get data from
  aggregation?: "sum" | "average" | "count" | "first" | "last"; // Type of aggregation
  outputColumnName?: string; // Name of the new column produced
}

// Discriminated union for specific node data types
export type SpecificNodeData = PrimarySourceNodeData | AssociationNodeData;
// | OtherNodeTypeData etc.

export interface WorkspaceConfig {
  id: string;
  name: string;
  files: FileMeta[];
  flow_nodes: Node<FlowNodeData>[]; // Use React Flow's Node type with our data structure
  flow_edges: Edge[];
}

// For responses from Tauri commands
export interface FilePreviewResponse {
  sheets: SheetInfo[];
}

interface SheetInfo {
  sheet_name: string;
  columns: string[];
  preview_data: Record<string, unknown>[];
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

  // Actions

  // Create a new workspace with the given id and name and set it as the current workspace
  createWorkspace: (id: string, name?: string) => void; // Takes id and optional name
  loadWorkspace: (workspace: WorkspaceConfig) => void;
  setCurrentWorkspaceName: (name: string) => void;
  // For addFileToWorkspace, expect columns to be provided externally after backend call
  addFileToWorkspace: (fileMetaWithFileIdAndColumns: FileMeta) => WorkspaceConfig | null;
  updateFileMeta: (
    fileId: string,
    updates: Partial<Omit<FileMeta, "id">>,
  ) => void;
  removeFileFromWorkspace: (fileId: string) => void;

  // Flow Actions
  addFlowNode: (node: Node<FlowNodeData>) => void;
  updateNodeData: (nodeId: string, data: Partial<FlowNodeData>) => void;
  removeFlowNode: (nodeId: string) => void;

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  clearCurrentWorkspace: () => void;
  resetDirty: () => void; // 新增：重置dirty状态
  markAsDirty: () => void; // 新增：标记为已修改
}

/* React Flow Types */

export interface PrimarySourceNodeData extends FlowNodeData {
  fileId?: string;
  indexColumns?: string[];
  // We might add more specific output handles if branching directly from here
}
