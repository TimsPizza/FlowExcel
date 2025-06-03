/**
 * API Client for communicating with the Python REST API server
 * Replaces Tauri invoke calls with HTTP requests
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { SheetInfo } from '@/types';

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
  workspace_id: string;
  target_node_id: string;
  execution_mode?: string;
  test_mode_max_rows?: number;
  output_file_path?: string;
}

interface TestNodeRequest {
  workspace_id: string;
  node_id: string;
  execution_mode?: string;
  test_mode_max_rows?: number;
}

// New: Preview Node request interface
interface PreviewNodeRequest {
  workspace_id: string;
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
type PreviewNodeResult = IndexSourcePreviewResult | DataFramePreviewResult | AggregationPreviewResult | NodePreviewResult;

// Workspace management request types
interface SaveWorkspaceRequest {
  workspace_id: string;
  config_json: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:11017';

class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Client Error:', error);
        if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
        }
        if (error.code === 'ECONNREFUSED') {
          throw new Error('API server is not running. Please check if the Python server is started.');
        }
        throw error;
      }
    );
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // Preview Excel data
  async previewExcelData(filePath: string): Promise<any> {
    const request: PreviewRequest = { file_path: filePath };
    const response: AxiosResponse<APIResponse> = await this.client.post('/excel/preview', request);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to preview Excel data');
    }
    
    return response.data.data;
  }

  // Get index values
  async getIndexValues(
    filePath: string,
    sheetName: string,
    headerRow: number,
    columnName: string
  ): Promise<any> {
    const request: IndexValuesRequest = {
      file_path: filePath,
      sheet_name: sheetName,
      header_row: headerRow,
      column_name: columnName,
    };
    const response: AxiosResponse<APIResponse> = await this.client.post('/excel/index-values', request);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get index values');
    }
    
    return response.data.data;
  }

  // Try to read header row
  async tryReadHeaderRow(
    filePath: string,
    sheetName: string,
    headerRow: number
  ): Promise<any> {
    const request: HeaderRowRequest = {
      file_path: filePath,
      sheet_name: sheetName,
      header_row: headerRow,
    };
    const response: AxiosResponse<APIResponse> = await this.client.post('/excel/header-row', request);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to read header row');
    }
    
    return response.data.data;
  }

  // Try to read sheet names
  async tryReadSheetNames(filePath: string): Promise<any> {
    const request: SheetNamesRequest = { file_path: filePath };
    const response: AxiosResponse<APIResponse> = await this.client.post('/excel/sheet-names', request);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to read sheet names');
    }
    
    return response.data.data;
  }

  // Execute pipeline - updated to use target_node_id
  async executePipeline(
    workspaceId: string, 
    targetNodeId: string,
    executionMode: string = 'production',
    outputFilePath?: string
  ): Promise<any> {
    const request: PipelineRequest = { 
      workspace_id: workspaceId,
      target_node_id: targetNodeId,
      execution_mode: executionMode,
      output_file_path: outputFilePath
    };
    const response: AxiosResponse<APIResponse> = await this.client.post('/pipeline/execute', request);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to execute pipeline');
    }
    
    return response.data.data;
  }

  // Test pipeline node - updated to use new request format
  async testPipelineNode(
    workspaceId: string, 
    nodeId: string,
    executionMode: string = 'test',
    testModeMaxRows: number = 100
  ): Promise<any> {
    const request: TestNodeRequest = {
      workspace_id: workspaceId,
      node_id: nodeId,
      execution_mode: executionMode,
      test_mode_max_rows: testModeMaxRows,
    };
    const response: AxiosResponse<APIResponse> = await this.client.post('/pipeline/test-node', request);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to test pipeline node');
    }
    
    return response.data.data;
  }

  // New: Preview pipeline node - uses the new /preview-node endpoint
  async previewNode(
    workspaceId: string,
    nodeId: string,
    testModeMaxRows: number = 100
  ): Promise<PreviewNodeResult> {
    const request: PreviewNodeRequest = {
      workspace_id: workspaceId,
      node_id: nodeId,
      test_mode_max_rows: testModeMaxRows,
    };
    const response: AxiosResponse<APIResponse> = await this.client.post('/pipeline/preview-node', request);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to preview pipeline node');
    }
    
    return response.data.data as PreviewNodeResult;
  }

  // Test pipeline node - unified interface (updated)
  async testPipelineNodeUnified(
    workspaceId: string, 
    nodeId: string,
    executionMode: string = 'test',
    testModeMaxRows: number = 100
  ): Promise<SheetInfo[]> {
    const request: TestNodeRequest = {
      workspace_id: workspaceId,
      node_id: nodeId,
      execution_mode: executionMode,
      test_mode_max_rows: testModeMaxRows,
    };
    const response: AxiosResponse<APIResponse> = await this.client.post('/pipeline/test-node', request);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to test pipeline node');
    }
    
    // Extract sheets from the normalized response data
    const responseData = response.data.data;
    if (responseData && responseData.sheets) {
      return responseData.sheets;
    }
    
    // 返回空数组作为fallback
    return [];
  }

  // Workspace management methods
  async listWorkspaces(): Promise<any> {
    const response: AxiosResponse<APIResponse> = await this.client.get('/workspace/list');
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to list workspaces');
    }
    
    return response.data.data;
  }

  async loadWorkspace(workspaceId: string): Promise<any> {
    const response: AxiosResponse<APIResponse> = await this.client.get(`/workspace/load/${workspaceId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to load workspace');
    }
    
    return response.data.data;
  }

  async saveWorkspace(workspaceId: string, configJson: string): Promise<any> {
    const request: SaveWorkspaceRequest = {
      workspace_id: workspaceId,
      config_json: configJson,
    };
    const response: AxiosResponse<APIResponse> = await this.client.post('/workspace/save', request);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to save workspace');
    }
    
    return response.data.data;
  }

  async deleteWorkspace(workspaceId: string): Promise<any> {
    const response: AxiosResponse<APIResponse> = await this.client.delete(`/workspace/delete/${workspaceId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete workspace');
    }
    
    return response.data.data;
  }

  // Shutdown server (for cleanup)
  async shutdown(): Promise<void> {
    try {
      await this.client.post('/shutdown');
    } catch (error) {
      // Ignore errors during shutdown as the server will close the connection
    }
  }
}

// Create a singleton instance
export const apiClient = new ApiClient();

// Export the class for testing purposes
export { ApiClient }; 