import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import {
  ApiResponse,
  FilePreviewResponse,
  IndexValues,
  TryReadHeaderRowResponse,
  TryReadSheetNamesResponse,
  WorkspaceConfig,
} from "@/types";
import {
  FlowNodeData,
  NodeType,
  IndexSourceNodeDataContext,
  SheetSelectorNodeDataContext,
  RowFilterNodeDataContext,
  RowLookupNodeDataContext,
  AggregatorNodeDataContext,
  OutputNodeDataContext,
} from "@/types/nodes";
import { invoke } from "@tauri-apps/api/core";
import { useMutation, useQuery, UseQueryResult } from "react-query";
import { toast } from "react-toastify";
import { Node as ReactFlowNode } from "reactflow";

/* List workspaces */

async function fetchWorkspaces(): Promise<WorkspaceListItem[]> {
  try {
    const result = await invoke<string>("list_workspaces");
    const parsedResult = JSON.parse(result) as ApiResponse<WorkspaceListItem[]>;
    if (parsedResult.status !== "success") {
      console.error("Error from backend:", parsedResult.message);
      throw new Error(parsedResult.message);
    }
    return parsedResult.data as WorkspaceListItem[];
  } catch (error) {
    console.error("Failed to fetch workspaces:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  }
}

type WorkspaceListItem = {
  id: string;
  name: string;
};

export const useWorkspaceListQuery = () => {
  const {
    data: workspaces,
    isLoading,
    error,
  }: UseQueryResult<WorkspaceListItem[], Error> = useQuery<
    WorkspaceListItem[],
    Error
  >("workspaces", fetchWorkspaces);
  return {
    workspaces,
    isLoading,
    error,
  };
};

/* Get workspace by ID */
async function getWorkspaceByID(workspaceID: string): Promise<WorkspaceConfig> {
  const result = await invoke<string>("load_workspace", {
    workspaceId: workspaceID,
  });
  const parsedResult = JSON.parse(result) as ApiResponse<WorkspaceConfig>;
  if (parsedResult.status !== "success") {
    throw new Error(parsedResult.message);
  }
  return parsedResult.data as WorkspaceConfig;
}

export const useWorkspaceQuery = ({ workspaceID }: { workspaceID: string }) => {
  const {
    isLoading,
    data: workspace,
    error,
  } = useQuery({
    queryKey: ["workspace", workspaceID],
    queryFn: () => getWorkspaceByID(workspaceID),
    onError: () => {
      toast.error("Failed to load workspace");
    },
  });
  return {
    isLoading,
    workspace,
    error,
  };
};

/* Save  workspace */

// 确保flow node数据完整性
function sanitizeWorkspaceData(workspace: WorkspaceConfig): WorkspaceConfig {
  // 创建副本，避免修改原始对象
  const sanitized = {
    ...workspace,
    flow_nodes: [...(workspace.flow_nodes || [])],
    flow_edges: [...(workspace.flow_edges || [])],
  };

  sanitized.flow_nodes = sanitized.flow_nodes.map((node) => {
    // node is expected to be ReactFlowNode<FlowNodeData> from the workspace store
    const reactFlowNode = node as ReactFlowNode<FlowNodeData>;

    // Ensure reactFlowNode.data exists and has a node_type
    if (!reactFlowNode.data || !reactFlowNode.data.nodeType) {
      console.error(
        "sanitizeWorkspaceData: Node is missing data or node_type",
        reactFlowNode,
      );
      // Create a minimal valid structure if data is badly corrupted or missing
      // This case should ideally not happen if nodes are created correctly
      const defaultNodeType = NodeType.INDEX_SOURCE; // Or some other sensible default
      return {
        id: reactFlowNode.id,
        type: reactFlowNode.type || defaultNodeType, // reactFlowNode.type is the string type for RF
        position: reactFlowNode.position || { x: 0, y: 0 },
        data: {
          id: reactFlowNode.id,
          nodeType: defaultNodeType,
          label: `Recovered Node ${reactFlowNode.id.substring(0, 5)}`,
          // Add other minimal default fields for FlowNodeData if necessary
        } as FlowNodeData, // Cast to FlowNodeData
      } as ReactFlowNode<FlowNodeData>;
    }

    // reactFlowNode.data is already the FlowNodeData object (e.g., IndexSourceNodeDataContext)
    // It should contain node_type, label, and other specific fields.
    const currentData = reactFlowNode.data;

    // Create the sanitized node structure for saving
    // The top-level structure (id, type, position) is from React Flow.
    // The 'data' field directly contains our FlowNodeData.
    const sanitizedNode: ReactFlowNode<FlowNodeData> = {
      id: reactFlowNode.id,
      type: reactFlowNode.type as string, // RF type, e.g., "indexSource"
      position: reactFlowNode.position,
      data: {
        // Spread all properties from currentData first
        ...currentData,
        // Ensure essential base properties exist
        label: currentData.label || `Node ${reactFlowNode.id.substring(0, 5)}`,
        nodeType: currentData.nodeType, // This must exist due to the check above
        // testResult and error are optional and can remain as they are or undefined
      } as FlowNodeData, // Explicitly cast to FlowNodeData
    };

    // Ensure specific fields for each node type are present, with defaults if necessary
    // This primarily involves checking for properties that are mandatory for a given node type
    // but might have been missed during creation or if the types were out of sync.
    switch (sanitizedNode.data.nodeType) {
      case NodeType.INDEX_SOURCE:
        const indexData = sanitizedNode.data as IndexSourceNodeDataContext;
        sanitizedNode.data = {
          ...indexData,
          label: indexData.label || "索引源",
          // sourceFileID, sheetName, columnNames are optional per definition
        };
        break;
      case NodeType.SHEET_SELECTOR:
        const sheetData = sanitizedNode.data as SheetSelectorNodeDataContext;
        sanitizedNode.data = {
          ...sheetData,
          label: sheetData.label || "Sheet定位",
          mode: sheetData.mode || "auto_by_index", // mode is mandatory
          // targetFileID, manualSheetName are optional
        };
        break;
      case NodeType.ROW_FILTER:
        const filterData = sanitizedNode.data as RowFilterNodeDataContext;
        sanitizedNode.data = {
          ...filterData,
          label: filterData.label || "行过滤",
          conditions: filterData.conditions || [], // conditions is mandatory
        };
        break;
      case NodeType.ROW_LOOKUP:
        const lookupData = sanitizedNode.data as RowLookupNodeDataContext;
        sanitizedNode.data = {
          ...lookupData,
          label: lookupData.label || "行查找/列匹配",
          // matchColumn is optional
        };
        break;
      case NodeType.AGGREGATOR:
        const aggData = sanitizedNode.data as AggregatorNodeDataContext;
        sanitizedNode.data = {
          ...aggData,
          label: aggData.label || "统计",
          method: aggData.method || "sum", // method is mandatory
          // statColumn is optional
        };
        break;
      case NodeType.OUTPUT:
        const outputData = sanitizedNode.data as OutputNodeDataContext;
        sanitizedNode.data = {
          ...outputData,
          label: outputData.label || "输出",
          outputFormat: outputData.outputFormat || "table", // outputFormat is optional but good to default
        };
        break;
      default:
        // If node_type is unknown, keep data as is but log a warning
        console.warn(
          "sanitizeWorkspaceData: Unknown node_type",
          sanitizedNode.data.nodeType,
          sanitizedNode,
        );
        break;
    }
    return sanitizedNode;
  });

  // 确保边有唯一ID
  sanitized.flow_edges = sanitized.flow_edges.map((edge) => {
    if (!edge.id) {
      return {
        ...edge,
        id: `edge-${edge.source}-${edge.target}-${Date.now()}`,
      };
    }
    return edge;
  });
  console.log("sanitized workspace", sanitized);

  return sanitized;
}

async function saveWorkspace(
  id: string,
  workspace: WorkspaceConfig,
): Promise<WorkspaceConfig | void> {
  // 在保存前清理和完善数据
  const sanitizedWorkspace = sanitizeWorkspaceData(workspace);

  const configJson = JSON.stringify(sanitizedWorkspace);
  const result = await invoke<string>("save_workspace", {
    workspaceId: id,
    configJson,
  });
  const parsedResult = JSON.parse(result) as ApiResponse<WorkspaceConfig>;
  if (parsedResult.status === "error") {
    throw new Error(parsedResult.message);
  }
  return parsedResult.data;
}

export const useSaveWorkspaceMutation = () => {
  const resetDirty = useWorkspaceStore((state) => state.resetDirty);
  const { mutateAsync, isLoading, error } = useMutation({
    mutationKey: ["saveWorkspace"],
    mutationFn: async ({
      id,
      workspace,
    }: {
      id: string;
      workspace: WorkspaceConfig;
    }) => {
      console.log("saveWorkspace", id, workspace);
      const result = await saveWorkspace(id, workspace);
      console.log("saveWorkspace result:", result);
      return result;
    },
    onSuccess: () => {
      toast.success("Workspace saved");
      resetDirty();
    },
    onError: () => {
      toast.error("Failed to save workspace");
    },
  });
  return {
    saveWorkspace: mutateAsync,
    isSaving: isLoading,
    saveError: error,
  };
};

/* Get excel preview */

export const getExcelPreview = async (filePath?: string) => {
  if (!filePath) {
    return null;
  }
  console.log("filePath", filePath);
  const result = await invoke<string>("preview_excel_data", {
    filePath,
  });
  console.log("result-raw", result);
  const parsedResult = JSON.parse(result) as ApiResponse<FilePreviewResponse>;
  if (parsedResult.status !== "success") {
    throw new Error(parsedResult.message);
  }
  console.log("parsedResult", parsedResult);
  const unemptySheets =
    parsedResult?.data?.sheets?.filter((sheet) => sheet?.columns?.length > 0) ??
    [];
  console.log("unemptySheets", unemptySheets);
  const sanitizedResult = {
    sheets: unemptySheets,
  } as FilePreviewResponse;
  console.log("sanitizedResult", sanitizedResult);

  return sanitizedResult;
};

export const useGetExcelPreview = (filePath?: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["excelPreview", filePath],
    queryFn: async () => await getExcelPreview(filePath),
    enabled: !!filePath,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: false,
  });
  return {
    previewData: data,
    isPreviewLoading: isLoading,
    previewError: error,
  };
};

/**
 * Get index values for a single column
 * @param filePath
 * @param sheetName
 * @param columnName
 * @returns Non-repeating values of the column
 */
const getIndexValues = async (
  filePath: string,
  sheetName: string,
  headerRow: number,
  columnName: string,
) => {
  console.log("getIndexValues", filePath, sheetName, columnName);
  const result = await invoke<string>("get_index_values", {
    filePath,
    sheetName,
    headerRow,
    columnName,
  });
  const parsedResult = JSON.parse(result) as ApiResponse<IndexValues>;
  if (parsedResult.status !== "success") {
    throw new Error(parsedResult.message);
  }
  console.log("getIndexValues result", parsedResult);
  return parsedResult.data;
};

export const useGetIndexValues = (
  filePath: string,
  sheetName: string,
  // use string[] interface for future use? just do not change yet
  headerRow: number,
  columnNames: string[],
) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["indexValues", filePath, sheetName, columnNames, headerRow],
    queryFn: async () => {
      return (await Promise.all(
        columnNames.map((columnName) =>
          getIndexValues(filePath, sheetName, headerRow, columnName),
        ),
      )) as IndexValues[];
    },
    enabled: !!filePath && !!sheetName && !!columnNames && !isNaN(headerRow),
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
  return {
    indexValuesArr: data,
    isIndexValuesLoading: isLoading,
    indexValuesError: error as Error,
  };
};

const tryReadHeaderRow = async (
  filePath: string,
  sheetName: string,
  headerRow: number,
) => {
  const result = await invoke<string>("try_read_header_row", {
    filePath,
    sheetName,
    headerRow,
  });
  console.log("tryReadHeaderRow result", result);
  const parsedResult = JSON.parse(
    result,
  ) as ApiResponse<TryReadHeaderRowResponse>;
  console.log("tryReadHeaderRow parsedResult", parsedResult);
  if (parsedResult.status !== "success") {
    throw new Error(parsedResult.message);
  }
  return parsedResult.data;
};

export const useTryReadHeaderRow = (
  filePath: string,
  sheetName: string,
  headerRow: number,
) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["tryReadHeaderRow", filePath, sheetName, headerRow],
    queryFn: async () => await tryReadHeaderRow(filePath, sheetName, headerRow),
    enabled: !!filePath && !!sheetName && !isNaN(headerRow),
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: false,
  });
  return {
    headerRow: data,
    isHeaderRowLoading: isLoading,
    headerRowError: error as Error,
  };
};

const tryReadSheetNames = async (filePath: string) => {
  const result = await invoke<string>("try_read_sheet_names", {
    filePath,
  });
  console.log("tryReadSheetNames raw result:", result);
  const parsedResult = JSON.parse(
    result,
  ) as ApiResponse<TryReadSheetNamesResponse>;
  if (parsedResult.status !== "success") {
    throw new Error(parsedResult.message);
  }
  return parsedResult.data as TryReadSheetNamesResponse;
};

export const useTryReadSheetNames = (
  filePath: string,
  bySheetName: boolean,
) => {
  const query = useQuery<TryReadSheetNamesResponse, Error>({
    queryKey: ["tryReadSheetNames", filePath],
    queryFn: () => tryReadSheetNames(filePath),
    enabled: !!filePath && bySheetName,
    onError: (error) => {
      console.error("Error reading sheet names:", error);
    },
  });

  return {
    sheetNamesArr: query.data,
    isSheetNamesLoading: query.isLoading,
    sheetNamesError: query.error,
  };
};

/* Pipeline execution */

interface PipelineExecutionResult {
  success: boolean;
  error?: string;
  results: Record<string, any[]>;
}

const executePipeline = async (
  workspaceId: string,
): Promise<PipelineExecutionResult> => {
  const result = await invoke<string>("execute_pipeline", {
    pipelineJson: JSON.stringify({ workspaceId }),
  });
  return JSON.parse(result) as PipelineExecutionResult;
};

export const useExecutePipelineMutation = () => {
  return useMutation<PipelineExecutionResult, Error, string>({
    mutationFn: executePipeline,
    onSuccess: () => {
      toast.success("Pipeline执行完成");
    },
    onError: (error) => {
      console.error("Pipeline执行失败:", error);
      toast.error(`Pipeline执行失败: ${error.message}`);
    },
  });
};

/* Pipeline node testing */

const testPipelineNode = async (params: {
  workspaceId: string;
  nodeId: string;
}): Promise<PipelineExecutionResult> => {
  console.log("testPipelineNode params", params);
  const result = await invoke<string>("test_pipeline_node", {
    workspaceId: params.workspaceId,
    nodeId: params.nodeId,
  });
  console.log("testPipelineNode raw result", result);
  try {
    const parsedResult = JSON.parse(result) as PipelineExecutionResult;
    console.log("testPipelineNode parsed result", parsedResult);
    return parsedResult;
  } catch (error) {
    console.error("testPipelineNode error", error);
    throw error;
  }
};

export const useTestPipelineNodeMutation = () => {
  return useMutation<
    PipelineExecutionResult,
    Error,
    { workspaceId: string; nodeId: string }
  >({
    mutationFn: testPipelineNode,
    onSuccess: () => {
      toast.success("Pipeline测试完成");
    },
    onError: (error) => {
      console.error("Pipeline测试失败:", error);
      toast.error(`Pipeline测试失败: ${error.message}`);
    },
  });
};
