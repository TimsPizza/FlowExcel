import { ExcelPreview } from "@/components/flow";
import useToast from "@/hooks/useToast";
import { useGetExcelPreview } from "@/hooks/workspaceQueries";
import { apiClient } from "@/lib/apiClient";
import {
  fileSelector,
  useWorkspaceStore,
  workspaceSelector,
} from "@/stores/useWorkspaceStore";
import { FileMeta } from "@/types";
import { Button } from "@/components/ui/button";
import { Box, Dialog, Flex, Text } from "@radix-ui/themes";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";

const AddFileModal = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileName, setFilename] = useState<string>("");
  const [isAddingFile, setIsAddingFile] = useState(false);
  const { previewData, isPreviewLoading, previewError } = useGetExcelPreview(
    selectedFilePath ?? "",
  );
  const { addFileToWorkspace, files } = useWorkspaceStore(
    useShallow(fileSelector),
  );
  const { currentWorkspace } = useWorkspaceStore(useShallow(workspaceSelector));

  const handleAddFileToWorkspace = useCallback(async () => {
    if (!selectedFilePath || !fileName || !previewData) {
      toast.error(t("file.add.missingData"));
      return;
    }
    if (previewError) {
      toast.error(t("file.add.previewError"));
      return;
    }

    // Check if a file with the same path or alias already exists
    if (files?.some((f) => f.path === selectedFilePath)) {
      toast.warning(t("file.add.alreadyExists", { fileName }));
      return;
    }

    setIsAddingFile(true);
    try {
      // 获取文件信息
      const fileInfoResponse = await apiClient.getFileInfo(selectedFilePath);
      if (!fileInfoResponse?.file_info) {
        toast.error(t("file.add.fileInfoError"));
        return;
      }

      const newFile: FileMeta = {
        id: uuidv4(),
        name: fileName,
        path: selectedFilePath,
        sheet_metas: previewData.sheets.map((sheet) => ({
          sheet_name: sheet.sheet_name,
          header_row: 0,
        })),
        file_info: fileInfoResponse.file_info, // 添加文件信息
      };

      addFileToWorkspace(newFile);
      setSelectedFilePath(null);
      setFilename("");
    } catch (error) {
      console.error("Error adding file to workspace:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(t("file.add.failed", { error: errorMsg }));
    } finally {
      setIsAddingFile(false);
    }
  }, [
    selectedFilePath,
    fileName,
    previewData,
    previewError,
    currentWorkspace,
    files,
    addFileToWorkspace,
  ]);

  const handleFileSelect = useCallback(async () => {
    setSelectedFilePath(null); // Reset path on new selection attempt
    setFilename("");
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: t("file.excelFiles"),
            extensions: ["xlsx", "xls", "csv"],
          },
        ],
      });
      if (typeof selected === "string" && selected !== null) {
        setSelectedFilePath(selected);
        const fileName = selected.substring(selected.lastIndexOf("/") + 1);
        setFilename(fileName);
        // Automatically preview file with default values
        handlePreviewFile(selected);
      } else {
        // User cancelled dialog
        setSelectedFilePath(null);
        setFilename("");
      }
    } catch (err) {
      console.error("Error selecting file:", err);
      const errorMsg = typeof err === "string" ? err : (err as Error).message;
      toast.error(t("file.select.failed", { error: errorMsg }));
    }
  }, []);

  const handlePreviewFile = async (filePath: string | null) => {
    if (!filePath) {
      return;
    }
    try {
      if (previewError) {
        // setFileError(previewError.message || "预览错误");
      }
    } catch (error) {
      console.error("Error previewing file:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(t("file.preview.failed", { error: errorMsg }));
    }
  };

  return (
    <Dialog.Root
      onOpenChange={() => {
        setSelectedFilePath(null);
        setFilename("");
      }}
    >
      <Dialog.Trigger>
        <Button variant="soft" size="2">
          {t("file.add.title")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>
          <Flex direction="row" justify="between">
            <Text>{selectedFilePath?.split("/").pop()}</Text>
            <Dialog.Close>
              <Button variant="soft">{t("common.close")}</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Title>
        <Dialog.Content className="min-h-48 max-w-2xl px-4 py-2">
          {!selectedFilePath && (
            <Flex direction="column" justify="between" gap="2" flexGrow={"1"}>
              <Text align="center">{t("file.select.prompt")}</Text>
              <Button onClick={handleFileSelect}>{t("file.select.button")}</Button>
            </Flex>
          )}
          {selectedFilePath && isPreviewLoading && (
            <Flex direction="row" justify="between">
              <Text>{t("common.loading")}</Text>
            </Flex>
          )}
          {selectedFilePath && !previewData && !isPreviewLoading && (
            <Flex direction="row" justify="between">
              <Text>{t("file.preview.loadFailed")}</Text>
              <Button
                onClick={() => {
                  setSelectedFilePath(null);
                  handleFileSelect();
                }}
              >
                {t("file.preview.reload")}
              </Button>
            </Flex>
          )}
          {selectedFilePath && previewData && !isPreviewLoading && (
            <Flex direction="column" justify="between" className="w-full">
              <Box className="h-full w-full">
                <ExcelPreview
                  sheets={previewData.sheets}
                  hide={false}
                  loading={isPreviewLoading}
                />
              </Box>
              <Dialog.Close onClick={handleAddFileToWorkspace}>
                <Button variant="soft" disabled={isAddingFile}>
                  {isAddingFile ? t("file.add.adding") : t("file.add.button")}
                </Button>
              </Dialog.Close>
            </Flex>
          )}
        </Dialog.Content>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default AddFileModal;
