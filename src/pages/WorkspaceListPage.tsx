import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import useI18nToast from "@/hooks/useI18nToast";
import {
  useDeleteWorkspaceMutation,
  useSaveWorkspaceMutation,
  useWorkspaceListQuery,
} from "@/hooks/workspaceQueries";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { PlusCircledIcon, UploadIcon } from "@radix-ui/react-icons";
import { Box, Flex, Heading, Text } from "@radix-ui/themes";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "react-query";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import LanguageSelector from "@/components/ui/LanguageSelector";
import { useTranslation } from "react-i18next";
import AlertDelete from "@/components/workspace/AlertDelete";
import { open } from "@tauri-apps/plugin-dialog";
import { apiClient } from "@/lib/apiClient";

type WorkspaceListItem = {
  id: string;
  name: string;
};

export function WorkspaceListPage() {
  const toast = useI18nToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleNavigate = (id: string) => {
    navigate(`/workspace/${id}`);
  };

  const createWorkspace = useWorkspaceStore((state) => state.createWorkspace);
  const resetDirty = useWorkspaceStore((state) => state.resetDirty);

  const { workspaces, isLoading, error, refetch } = useWorkspaceListQuery();
  const { saveWorkspace, isSaving } = useSaveWorkspaceMutation();
  const { deleteWorkspace, isDeleting } = useDeleteWorkspaceMutation();

  const handleDelete = async (id: string) => {
    if (isDeleting) return;
    try {
      await deleteWorkspace(id);
      queryClient.invalidateQueries(["workspaces"]);
    } catch (error) {
      toast.error("workspace.delete_failed");
      console.error(error);
    } finally {
      refetch();
    }
  };

  const handleCreateNew = async () => {
    if (isSaving) return;

    const newId = uuidv4();
    const defaultNewName = t("workspace.defaultName", {
      date: new Date().toLocaleDateString(),
    });

    // 在zustand中创建新工作区
    createWorkspace(newId, defaultNewName);

    // 获取当前工作区状态
    const newWorkspace = useWorkspaceStore.getState().currentWorkspace;

    if (newWorkspace) {
      try {
        await saveWorkspace({ id: newId, workspace: newWorkspace });
        resetDirty();
        queryClient.invalidateQueries(["workspaces"]);
        toast.success("workspace.create_success");
        navigate(`/workspace/${newId}`);
      } catch (error) {
        toast.error("workspace.create_failed");
        console.error(error);
      }
    }
  };

  // 导入工作区功能
  const handleImportWorkspace = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Excel Flow Package",
            extensions: ["fxw", "zip"],
          },
        ],
      });

      if (selected) {
        const result = await apiClient.importWorkspace(selected);
        queryClient.invalidateQueries(["workspaces"]);
        toast.success("workspace.importSuccess");
        navigate(`/workspace/${result.workspace_id}`);
      }
    } catch (error) {
      toast.error("workspace.importFailed");
      console.error("Import workspace error:", error);
    }
  };

  if (isLoading)
    return (
      <Flex align="center" justify="center" style={{ height: "100vh" }}>
        <Text size="4">{t("workspace.loadingList")}</Text>
      </Flex>
    );

  if (error)
    return (
      <Flex align="center" justify="center" style={{ height: "100vh" }}>
        <Text size="4" color="red">
          {t("workspace.loadListFailed", { message: error.message })}
        </Text>
        <Button size="3" color="red" onClick={() => refetch()}>
          {t("common.retry")}
        </Button>
      </Flex>
    );

  return (
    <Box className="container mx-auto h-screen p-8">
      <Flex direction="column" gap="6" className="h-full">
        <Flex justify="between" align="center">
          <img src="/light.svg" alt="logo" className="mr-2 h-10 w-10" />
          <Heading size="6" className="mr-auto">
            FlowExcel
          </Heading>
          <Flex gap="2">
            <Button
              size="3"
              color="green"
              variant="soft"
              onClick={handleImportWorkspace}
              title={t("workspace.importTooltip")}
            >
              <UploadIcon /> {t("workspace.import")}
            </Button>
            <Button
              size="3"
              color="blue"
              variant="soft"
              onClick={handleCreateNew}
              disabled={isSaving}
            >
              <PlusCircledIcon /> {t("workspace.createNew")}
            </Button>
          </Flex>
        </Flex>

        <Text size="2" color="gray">
          {t("workspace.description")}
        </Text>

        {workspaces && workspaces.length > 0 ? (
          <Flex direction="column" gap="4" className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((ws: WorkspaceListItem) => (
                <Card
                  key={ws.id}
                  className="overflow-hidden border border-gray-200 transition-shadow hover:shadow-md"
                >
                  <CardHeader className="bg-gray-50">
                    <CardTitle>{ws.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <Text size="1" color="gray">
                      ID: {ws.id.substring(0, 8)}...
                    </Text>
                  </CardContent>
                  <CardFooter className="!flex !items-center gap-2 bg-gray-50 !py-2">
                    <Button
                      variant="soft"
                      onClick={() => handleNavigate(ws.id)}
                      className="cursor-pointer"
                    >
                      {t("workspace.open")}
                    </Button>

                    <AlertDelete
                      title={t("common.delete")}
                      description={t("workspace.deleteDescription")}
                      onConfirm={() => handleDelete(ws.id)}
                    />
                  </CardFooter>
                </Card>
              ))}
            </div>
          </Flex>
        ) : (
          <Flex
            direction="column"
            align="center"
            justify="center"
            gap="4"
            className="h-[300px] flex-1 rounded-md border border-dashed border-[var(--gray-5)]"
          >
            <Text size="5" color="gray">
              {t("workspace.noWorkspaces")}
            </Text>
            <Button
              size="3"
              color="green"
              variant="outline"
              onClick={handleCreateNew}
              disabled={isSaving}
            >
              <PlusCircledIcon className="h-5 w-5" />{" "}
              {t("workspace.createFirst")}
            </Button>
          </Flex>
        )}

        <Flex justify="end">
          <LanguageSelector />
        </Flex>
      </Flex>
    </Box>
  );
}
