import useToast from "@/hooks/useToast";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import {
  FileMeta,
  FilePreviewResponse,
  IndexValues,
  PipelineExecutionResult,
  PreviewNodeResult,
  WorkspaceConfig,
} from "@/types";
import {
  AggregatorNodeDataContext,
  FlowNodeData,
  IndexSourceNodeDataContext,
  NodeType,
  OutputNodeDataContext,
  RowFilterNodeDataContext,
  RowLookupNodeDataContext,
  SheetSelectorNodeDataContext,
} from "@/types/nodes";
import { useMutation, useQueries, useQuery, UseQueryResult } from "react-query";
import { Node as ReactFlowNode } from "reactflow";
import { v4 as uuidv4 } from "uuid";
import { useTranslation } from "react-i18next";

/* List workspaces */

async function fetchWorkspaces(): Promise<WorkspaceListItem[]> {
  try {
    const result = await apiClient.listWorkspaces();
    return result.workspaces as WorkspaceListItem[];
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
    refetch, // 添加refetch以便手动刷新
  }: UseQueryResult<WorkspaceListItem[], Error> = useQuery<
    WorkspaceListItem[],
    Error
  >("workspaces-list", {
    queryFn: fetchWorkspaces,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: true,
  });
  return {
    workspaces,
    isLoading,
    error,
    refetch, // 返回refetch方法
  };
};

/* Get workspace by ID */
async function getWorkspaceByID(workspaceID: string): Promise<WorkspaceConfig> {
  const result = await apiClient.loadWorkspace(workspaceID);
  return result as WorkspaceConfig;
}

export const useWorkspaceQuery = ({ workspaceID }: { workspaceID: string }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const {
    isLoading,
    data: workspace,
    error,
  } = useQuery({
    queryKey: ["workspace", workspaceID],
    queryFn: () => getWorkspaceByID(workspaceID),
    onError: (error: Error) => {
      toast.error(t("workspace.load_failed", { message: error.message }));
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
        // Spread all properties from currentData first, excluding testResult
        ...currentData,
        // Ensure essential base properties exist
        label: currentData.label || `Node ${reactFlowNode.id.substring(0, 5)}`,
        nodeType: currentData.nodeType, // This must exist due to the check above
        // 过滤掉 testResult 字段，因为这个字段没必要保存
        testResult: undefined,
        // error is optional and can remain as they are or undefined
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
          label: indexData.label || "Index Source",
          testResult: undefined, // 过滤掉 testResult
          // sourceFileID, sheetName, columnNames are optional per definition
          displayName:
            indexData.displayName || "DataSource-" + uuidv4().slice(0, 4),
        };
        break;
      case NodeType.SHEET_SELECTOR:
        const sheetData = sanitizedNode.data as SheetSelectorNodeDataContext;
        sanitizedNode.data = {
          ...sheetData,
          label: sheetData.label || "Sheet Selector",
          mode: sheetData.mode || "auto_by_index", // mode is mandatory
          testResult: undefined, // 过滤掉 testResult
          // targetFileID, manualSheetName are optional
        };
        break;
      case NodeType.ROW_FILTER:
        const filterData = sanitizedNode.data as RowFilterNodeDataContext;
        sanitizedNode.data = {
          ...filterData,
          label: filterData.label || "Row Filter",
          conditions: filterData.conditions || [], // conditions is mandatory
          testResult: undefined, // 过滤掉 testResult
        };
        break;
      case NodeType.ROW_LOOKUP:
        const lookupData = sanitizedNode.data as RowLookupNodeDataContext;
        sanitizedNode.data = {
          ...lookupData,
          label: lookupData.label || "Row Lookup",
          testResult: undefined, // 过滤掉 testResult
          // matchColumn is optional
        };
        break;
      case NodeType.AGGREGATOR:
        const aggData = sanitizedNode.data as AggregatorNodeDataContext;
        sanitizedNode.data = {
          ...aggData,
          label: aggData.label || "Aggregator",
          method: aggData.method || "sum", // method is mandatory
          testResult: undefined, // 过滤掉 testResult
          // statColumn is optional
        };
        break;
      case NodeType.OUTPUT:
        const outputData = sanitizedNode.data as OutputNodeDataContext;
        sanitizedNode.data = {
          ...outputData,
          label: outputData.label || "Output",
          outputFormat: outputData.outputFormat || "excel", // outputFormat is optional but good to default
          outputPath: outputData.outputPath || "",
          testResult: undefined, // 过滤掉 testResult
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

  return sanitized;
}

async function saveWorkspace(
  id: string,
  workspace: WorkspaceConfig,
): Promise<WorkspaceConfig | void> {
  // 在保存前清理和完善数据
  const sanitizedWorkspace = sanitizeWorkspaceData(workspace);

  const configJson = JSON.stringify(sanitizedWorkspace);
  const result = await apiClient.saveWorkspace(id, configJson);
  return result as WorkspaceConfig;
}

export const useSaveWorkspaceMutation = () => {
  const { t } = useTranslation();
  const toast = useToast();
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
      const result = await saveWorkspace(id, workspace);
      return result;
    },
    onSuccess: () => {
      toast.success(t("workspace.saved"));
      resetDirty();
    },
    onError: (error: Error) => {
      toast.error(t("workspace.save_failed", { message: error.message }));
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
  const result = await apiClient.previewExcelData(filePath);

  // The API client already handles the response parsing and error checking
  const unemptySheets =
    result?.sheets?.filter((sheet: any) => sheet?.columns?.length > 0) ?? [];
  const sanitizedResult = {
    sheets: unemptySheets,
  } as FilePreviewResponse;

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
  const result = await apiClient.getIndexValues(
    filePath,
    sheetName,
    headerRow,
    columnName,
  );
  return result;
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
  console.log("tryReadHeaderRow", filePath, sheetName, headerRow);
  const result = await apiClient.tryReadHeaderRow(
    filePath,
    sheetName,
    headerRow,
  );
  return result;
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

/* Pipeline execution */

// Updated to match new backend API signature
const executePipeline = async (params: {
  workspaceId?: string;
  workspaceConfig?: WorkspaceConfig;
  executionMode?: string;
}) => {
  // 优先尝试json，因为是最新的
  let sanitizedWorkspaceConfigJson: string | undefined;
  if (params.workspaceConfig) {
    sanitizedWorkspaceConfigJson = JSON.stringify(
      sanitizeWorkspaceData(params.workspaceConfig),
    );
  }
  const result = await apiClient.executePipeline(
    params.workspaceId,
    sanitizedWorkspaceConfigJson,
    "production",
  );
  return result.data;
};

export const useExecutePipelineMutation = () => {
  return useMutation<
    PipelineExecutionResult | undefined,
    Error,
    {
      workspaceId?: string;
      workspaceConfig?: WorkspaceConfig;
      executionMode?: string;
    }
  >({
    mutationFn: executePipeline,
  });
};

/* Enhanced Node Preview - using new /preview-node endpoint */

const previewNode = async (params: {
  nodeId: string;
  testModeMaxRows?: number;
  workspaceId?: string;
  workspaceConfig?: WorkspaceConfig;
}): Promise<PreviewNodeResult> => {
  if (!params.workspaceConfig) {
    throw new Error("workspaceConfig is required");
  }
  const sanitizedWorkspaceConfig = sanitizeWorkspaceData(
    params.workspaceConfig,
  );
  const result = await apiClient.previewNode(
    params.nodeId,
    params.testModeMaxRows || 100,
    params.workspaceId,
    JSON.stringify(sanitizedWorkspaceConfig),
  );
  return result;
};

export const usePreviewNodeMutation = () => {
  return useMutation<
    PreviewNodeResult,
    Error,
    {
      nodeId: string;
      testModeMaxRows: number;
      workspaceId?: string;
      workspaceConfig?: WorkspaceConfig;
    }
  >({
    mutationFn: previewNode,
  });
};

export const getFileInfo = async (filePath: string) => {
  const result = await apiClient.getFileInfo(filePath);
  return result;
};

export const useGetFileInfo = (filePath: string) => {
  const {
    data: fileInfo,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["fileInfo", filePath],
    queryFn: async () => await getFileInfo(filePath),
    enabled: !!filePath,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: false,
  });
  return {
    fileInfo,
    isFileInfoLoading: isLoading,
    fileInfoError: error as Error,
  };
};

export const useGetAllFileInfo = (workspaceConfig?: WorkspaceConfig) => {
  const fileIds = workspaceConfig?.files.map((f) => f.id).sort(); // 排序确保查询键稳定
  const {
    data: fileInfos,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["fileInfosAll", workspaceConfig?.id ?? "", fileIds],
    queryFn: async () => {
      if (!workspaceConfig) {
        return {};
      }
      const resultsArray = await Promise.all(
        workspaceConfig.files.map((file) => getFileInfo(file.path)),
      );

      const resultsMap = Object.fromEntries(
        workspaceConfig?.files.map((file, idx) => [
          file.id,
          resultsArray[idx],
        ]) ?? [],
      );
      return resultsMap;
    },
    enabled: !!workspaceConfig && !!workspaceConfig.id,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: false,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
  return {
    fileInfos,
    isFileInfoLoading: isLoading,
    fileInfoError: error as Error,
  };
};
