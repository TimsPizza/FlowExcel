import WorkspaceToolbar from "@/components/workspace/WorkspaceToolbar";
import {
  useSaveWorkspaceMutation,
  useWorkspaceQuery,
} from "@/hooks/workspaceQueries";
import {
  useWorkspaceStore,
  workspaceSelector,
} from "@/stores/useWorkspaceStore";
import { Flex } from "@radix-ui/themes";
import React, { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "react-query";
import { ErrorResponse, Outlet, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useShallow } from "zustand/shallow";

function isErrorResponse(obj: unknown): obj is ErrorResponse {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const potentialError = obj as Record<string, unknown>;
  return (
    typeof potentialError.error_type === "string" &&
    typeof potentialError.message === "string"
  );
}

export default function WorkspaceEditorPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  const {
    workspace,
    isLoading: isWsLoading,
    error: wsError,
  } = useWorkspaceQuery({
    workspaceID: workspaceId ?? "",
  });

  const {
    currentWorkspace,
    isDirty,
    loadWorkspace,
    setCurrentWorkspaceName,
    clearCurrentWorkspace,
  } = useWorkspaceStore(useShallow(workspaceSelector));

  const { saveError, isSaving, saveWorkspace } = useSaveWorkspaceMutation();
  const queryClient = useQueryClient();

  // 当从后端加载数据成功时，更新zustand状态
  useEffect(() => {
    if (workspace && !isWsLoading && !wsError) {
      loadWorkspace(workspace);
    }
  }, [workspace, isWsLoading, wsError, loadWorkspace]);

  useEffect(() => {
    if (wsError) {
      navigate("/");
    }
  }, [wsError, navigate]);

  // 组件卸载时清理workspace状态
  useEffect(() => {
    return () => {
      clearCurrentWorkspace();
    };
  }, [clearCurrentWorkspace]);

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!isSaving) {
        setCurrentWorkspaceName(event.target.value);
      }
    },
    [setCurrentWorkspaceName, isSaving],
  );

  const handleSaveWorkspace = useCallback(async () => {
    if (!currentWorkspace) {
      toast.error("Cannot save: No workspace loaded.");
      return;
    }
    if (isSaving) return;
    await saveWorkspace({
      id: currentWorkspace.id,
      workspace: currentWorkspace,
    });
    queryClient.invalidateQueries([""]);
  }, [currentWorkspace, isSaving, saveWorkspace, queryClient]);

  if (isWsLoading && !currentWorkspace) {
    return <div>Loading Workspace...</div>;
  }

  if (wsError) {
    return (
      <div>
        Error: {wsError instanceof Error ? wsError.message : String(wsError)}
      </div>
    );
  }

  if (!currentWorkspace) {
    return <div>Workspace not available (ID: {workspaceId}).</div>;
  }

  return (
    <Flex direction="column" className="h-screen">
      <WorkspaceToolbar
        workspaceName={currentWorkspace.name}
        onNameChange={handleNameChange}
        onSave={handleSaveWorkspace}
        isSaving={isSaving}
        isDirty={isDirty}
      />
      <Flex className="flex-grow overflow-hidden">
        <Outlet />
      </Flex>
    </Flex>
  );
}
