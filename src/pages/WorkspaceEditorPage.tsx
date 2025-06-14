import WorkspaceToolbar from "@/components/workspace/WorkspaceToolbar";
import useI18nToast from "@/hooks/useI18nToast";
import {
  useGetAllFileInfo,
  useSaveWorkspaceMutation,
  useWorkspaceQuery,
} from "@/hooks/workspaceQueries";
import {
  fileSelector,
  useWorkspaceStore,
  workspaceSelector,
} from "@/stores/useWorkspaceStore";
import { FileInfo } from "@/types";
import { Flex, Text } from "@radix-ui/themes";
import isEqual from "lodash/isEqual";
import React, { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "react-query";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";

export default function WorkspaceEditorPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const hasLoadedRef = useRef(true);
  const { t } = useTranslation();
  const toast = useI18nToast();

  useEffect(() => {
    if (hasLoadedRef.current) {
      hasLoadedRef.current = false;
    }
  }, [workspaceId]);

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
  const { isSaving, saveWorkspace } = useSaveWorkspaceMutation();
  const {
    fileInfos: newestFileInfo,
    isFileInfoLoading,
    fileInfoError,
  } = useGetAllFileInfo(currentWorkspace!);

  const queryClient = useQueryClient();

  const { outdatedFileIds } = useWorkspaceStore(useShallow(fileSelector));

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

  useEffect(() => {
    if (!isWsLoading && !wsError) {
      hasLoadedRef.current = true;
    }
    // only auto navigate to flow-editor after first loading
    if (!hasLoadedRef.current) {
      navigate("flow-editor");
    }
  }, [isWsLoading, wsError]);

  // 组件卸载时清理workspace状态
  useEffect(() => {
    return () => {
      clearCurrentWorkspace();
    };
  }, [clearCurrentWorkspace]);

  const revalidateWorkspaceFiles = useCallback(() => {
    if (!currentWorkspace || isFileInfoLoading) {
      return;
    }
    if (fileInfoError) {
      toast.warning("file.expirationCheckFailed");
    }
    const currentFileInfo: { id: string; file_info: FileInfo }[] =
      currentWorkspace.files.map((file) => {
        return {
          id: file.id,
          file_info: file.file_info,
        };
      });
    if (newestFileInfo) {
      // 只检查当前工作区中存在的文件，避免已删除文件被重新标记为过期
      const outdatedFileIds = currentFileInfo
        .filter((currentFile) => {
          const newestInfo = newestFileInfo[currentFile.id];
          return (
            newestInfo && !isEqual(newestInfo.file_info, currentFile.file_info)
          );
        })
        .map((file) => file.id);

      // 重置过期文件列表，然后添加当前过期的文件
      useWorkspaceStore.setState((state) => ({
        outdatedFileIds: outdatedFileIds,
      }));
    }
  }, [currentWorkspace, newestFileInfo, isFileInfoLoading, fileInfoError, toast]);

  useEffect(() => {
    revalidateWorkspaceFiles();
  }, [isWsLoading, revalidateWorkspaceFiles]);

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
      toast.error("workspace.no_workspace_loaded");
      return;
    }
    if (isSaving) return;
    await saveWorkspace({
      id: currentWorkspace.id,
      workspace: currentWorkspace,
    });
    queryClient.invalidateQueries([""]);
  }, [currentWorkspace, isSaving, saveWorkspace, queryClient, toast]);

  if (isWsLoading && !currentWorkspace) {
    return (
      <Flex align="center" justify="center" style={{ height: "100vh" }}>
        <Text size="5">{t("workspace.loading")}</Text>
      </Flex>
    );
  }

  if (wsError) {
    return (
      <Flex align="center" justify="center" style={{ height: "100vh" }}>
        <Text size="5" color="red">
          {t("workspace.load_failed", {
            message:
              wsError instanceof Error ? wsError.message : String(wsError),
          })}
        </Text>
      </Flex>
    );
  }

  if (!currentWorkspace) {
    return (
      <Flex align="center" justify="center" style={{ height: "100vh" }}>
        <Text size="5">
          {t("workspace.not_available", { id: workspaceId })}
        </Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" className="h-screen">
      <WorkspaceToolbar
        workspaceName={currentWorkspace.name}
        onNameChange={handleNameChange}
        onSave={handleSaveWorkspace}
        isSaving={isSaving}
        isDirty={isDirty}
        isOutdated={outdatedFileIds.length > 0}
      />
      <Flex className="flex-grow overflow-hidden">
        <Outlet />
      </Flex>
    </Flex>
  );
}
