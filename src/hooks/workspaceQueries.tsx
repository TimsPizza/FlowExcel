import { ApiResponse, FilePreviewResponse, WorkspaceConfig } from "@/types";
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
): Promise<void> {
  const configJson = JSON.stringify(workspace);
  const result = await invoke<string>("save_workspace", {
    workspaceId: id,
    configJson,
  });
  const parsedResult = JSON.parse(result);
  if (parsedResult.error_type) {
    throw new Error(parsedResult.message);
  }
}

export const useSaveWorkspaceMutation = () => {
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
      return await saveWorkspace(id, workspace);
    },
    onSuccess: () => {
      toast.success("Workspace saved");
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

export const get_excel_preview = async (filePath?: string) => {
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
  return parsedResult.data as FilePreviewResponse;
};

export const useGetExcelPreview = (filePath?: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["excelPreview", filePath],
    queryFn: async () => await get_excel_preview(filePath),
    enabled: !!filePath,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
  return {
    previewData: data,
    isPreviewLoading: isLoading,
    previewError: error,
  };
};
