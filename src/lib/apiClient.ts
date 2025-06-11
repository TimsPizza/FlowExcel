/**
 * API Client for communicating with the Python REST API server
 * Replaces Tauri invoke calls with HTTP requests
 */

import {
  ApiResponse,
  FileInfoResponse,
  PipelineExecutionResult,
  TryReadHeaderRowResponse,
} from "@/types";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { useBackendStore } from "@/stores/useBackendStore";

// API Response types matching the Python server
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Request types matching the Python server
interface PreviewRequest {
  file_path: string;
}

interface IndexValuesRequest {
  file_path: string;
  sheet_name: string;
  header_row: number;
  column_name: string;
}

interface HeaderRowRequest {
  file_path: string;
  sheet_name: string;
  header_row: number;
}

interface SheetNamesRequest {
  file_path: string;
}

// Updated Pipeline request interfaces to match backend models
interface PipelineRequest {
  workspace_id?: string;
  workspace_config_json?: string;
  execution_mode?: string;
}

// New: Preview Node request interface
interface PreviewNodeRequest {
  workspace_id?: string;
  workspace_config_json?: string;
  node_id: string;
  test_mode_max_rows?: number;
}

// New: Node preview response types
interface NodePreviewResult {
  success: boolean;
  node_id: string;
  node_type: string;
  execution_time_ms?: number;
  error?: string;
}

interface IndexSourcePreviewResult extends NodePreviewResult {
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

interface DataFramePreviewResult extends NodePreviewResult {
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

interface AggregationPreviewResult extends NodePreviewResult {
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
type PreviewNodeResult =
  | IndexSourcePreviewResult
  | DataFramePreviewResult
  | AggregationPreviewResult
  | NodePreviewResult;

// Workspace management request types
interface SaveWorkspaceRequest {
  workspace_id: string;
  config_json: string;
}

const FALLBACK_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:11017";

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 60000, // 60 seconds timeout, as some operations may take a long time
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add request interceptor to set dynamic base URL
    this.client.interceptors.request.use(
      (config) => {
        const baseURL = this.getBaseUrl();
        console.log("Using API base URL:", baseURL);
        config.baseURL = baseURL;
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error("API Client Error:", error);
        if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
        }
        if (error.code === "ECONNREFUSED") {
          throw new Error("后端服务未启动，这可能是个bug");
        }
        throw error;
      },
    );
  }

  private getBaseUrl(): string {
    const backendInfo = useBackendStore.getState().backendInfo;

    if (backendInfo?.api_base) {
      return backendInfo.api_base;
    }

    // 如果后端还没有准备好，使用回退 URL
    return FALLBACK_API_BASE_URL;
  }

  // 检查后端是否已经准备好
  isBackendReady(): boolean {
    const backendInfo = useBackendStore.getState().backendInfo;
    return backendInfo !== null;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get("/health");
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // Preview Excel data
  async previewExcelData(filePath: string): Promise<any> {
    const request: PreviewRequest = { file_path: filePath };
    const response: AxiosResponse<APIResponse> = await this.client.post(
      "/excel/preview",
      request,
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "预览数据失败");
    }

    return response.data.data;
  }

  // Get index values
  async getIndexValues(
    filePath: string,
    sheetName: string,
    headerRow: number,
    columnName: string,
  ): Promise<any> {
    const request: IndexValuesRequest = {
      file_path: filePath,
      sheet_name: sheetName,
      header_row: headerRow,
      column_name: columnName,
    };
    const response: AxiosResponse<APIResponse> = await this.client.post(
      "/excel/index-values",
      request,
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "获取索引值失败");
    }

    return response.data.data;
  }

  // Try to read header row
  async tryReadHeaderRow(
    filePath: string,
    sheetName: string,
    headerRow: number,
  ): Promise<TryReadHeaderRowResponse | undefined> {
    const request: HeaderRowRequest = {
      file_path: filePath,
      sheet_name: sheetName,
      header_row: headerRow,
    };
    const response: AxiosResponse<ApiResponse<TryReadHeaderRowResponse>> =
      await this.client.post("/excel/header-row", request);

    if (!response.data.success) {
      throw new Error(response.data.error || "读取表头失败");
    }

    return response.data.data;
  }

  // Try to read sheet names
  async tryReadSheetNames(filePath: string): Promise<any> {
    const request: SheetNamesRequest = { file_path: filePath };
    const response: AxiosResponse<APIResponse> = await this.client.post(
      "/excel/sheet-names",
      request,
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "读取表名失败");
    }

    return response.data.data;
  }

  // Execute pipeline - updated to use target_node_id
  async executePipeline(
    workspaceId?: string,
    workspaceConfigJson?: string,
    executionMode: string = "production",
  ): Promise<APIResponse<PipelineExecutionResult>> {
    if (!workspaceId && !workspaceConfigJson) {
      throw new Error("必须提供workspaceId或workspaceConfigJson参数");
    }
    const request: PipelineRequest = {
      workspace_id: workspaceId,
      workspace_config_json: workspaceConfigJson,
      execution_mode: executionMode,
    };
    const response: AxiosResponse<APIResponse> = await this.client.post(
      "/pipeline/execute",
      request,
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "执行流程失败");
    }

    return response.data;
  }

  // New: Preview pipeline node - uses the new /preview-node endpoint
  async previewNode(
    nodeId: string,
    testModeMaxRows: number = 100,
    workspaceId?: string,
    workspaceConfigJson?: string,
  ): Promise<PreviewNodeResult> {
    const request: PreviewNodeRequest = {
      node_id: nodeId,
      test_mode_max_rows: testModeMaxRows,
    };

    // 添加工作区参数（优先使用 workspaceConfigJson）
    if (workspaceConfigJson) {
      request.workspace_config_json = workspaceConfigJson;
    } else if (workspaceId) {
      request.workspace_id = workspaceId;
    } else {
      throw new Error("必须提供 workspaceId 或 workspaceConfigJson 参数");
    }

    const response: AxiosResponse<APIResponse> = await this.client.post(
      "/pipeline/preview-node",
      request,
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "预览流程节点失败");
    }

    return response.data.data as PreviewNodeResult;
  }

  // Workspace management methods
  async listWorkspaces(): Promise<any> {
    const response: AxiosResponse<APIResponse> =
      await this.client.get("/workspace/list");

    if (!response.data.success) {
      throw new Error(response.data.error || "获取工作空间列表失败");
    }

    return response.data.data;
  }

  async loadWorkspace(workspaceId: string): Promise<any> {
    const response: AxiosResponse<APIResponse> = await this.client.get(
      `/workspace/load/${workspaceId}`,
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "加载工作区失败");
    }

    return response.data.data;
  }

  async saveWorkspace(workspaceId: string, configJson: string): Promise<any> {
    const request: SaveWorkspaceRequest = {
      workspace_id: workspaceId,
      config_json: configJson,
    };
    const response: AxiosResponse<APIResponse> = await this.client.post(
      "/workspace/save",
      request,
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "保存工作区失败");
    }

    return response.data.data;
  }

  async deleteWorkspace(workspaceId: string): Promise<any> {
    const response: AxiosResponse<APIResponse> = await this.client.delete(
      `/workspace/delete/${workspaceId}`,
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "删除工作区失败");
    }

    return response.data.data;
  }

  // Shutdown server (for cleanup)
  async shutdown(): Promise<void> {
    try {
      await this.client.post("/shutdown");
    } catch (error) {
      // Ignore errors during shutdown as the server will close the connection
    }
  }

  async getFileInfo(filePath: string): Promise<FileInfoResponse | null> {
    const response: AxiosResponse<APIResponse> = await this.client.post(
      `/workspace/file-info`,
      {
        file_path: filePath,
      },
    );
    if (!response.data.success) {
      return null; // 文件不存在
    }
    return response.data.data;
  }
}

// Create a singleton instance
export const apiClient = new ApiClient();

// Export the class for testing purposes
export { ApiClient };
