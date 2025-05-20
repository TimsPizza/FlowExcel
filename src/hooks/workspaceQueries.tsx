import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import {
  ApiResponse,
  FilePreviewResponse,
  IndexValues,
  TryReadHeaderRowResponse,
  WorkspaceConfig,
} from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { useMutation, useQuery, UseQueryResult } from "react-query";
import { toast } from "react-toastify";

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

async function saveWorkspace(
  id: string,
  workspace: WorkspaceConfig,
): Promise<WorkspaceConfig | void> {
  const configJson = JSON.stringify(workspace);
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
  columnName: string,
) => {
  const result = await invoke<string>("get_index_values", {
    filePath,
    sheetName,
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
  columnNames: string[],
) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["indexValues", filePath, sheetName, columnNames],
    queryFn: async () => {
      return (await Promise.all(
        columnNames.map((columnName) =>
          getIndexValues(filePath, sheetName, columnName),
        ),
      )) as IndexValues[];
    },
    enabled: !!filePath && !!sheetName && !!columnNames,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
  return {
    indexValuesArr: data,
    isIndexValuesLoading: isLoading,
    indexValuesError: error,
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
    headerRowError: error,
  };
};
