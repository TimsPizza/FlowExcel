// 使用从nodes.ts导入的类型定义
import { FlowNodeData, NodeType } from "./nodes";
import { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from "reactflow";

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
  // columns: string[];
}

export interface FileMeta {
  id: string;
  name: string;
  path: string;
  sheet_metas: SheetMeta[];
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

interface SheetInfo {
  sheet_name: string;
  columns: string[];
  preview_data: Array<string | null>[];
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
  updateNodeData: (nodeId: string, data: Partial<FlowNodeData>, markDirty?: boolean) => void;
  removeFlowNode: (nodeId: string) => void;

  removeFlowEdge: (edgeId: string) => void;

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  clearCurrentWorkspace: () => void;
  resetDirty: () => void; // 新增：重置dirty状态
  markAsDirty: () => void; // 新增：标记为已修改
}
