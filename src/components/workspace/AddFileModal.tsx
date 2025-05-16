import {
  useGetExcelPreview,
  useSaveWorkspaceMutation,
} from "@/hooks/workspaceQueries";
import ExcelPreview from "@/routes/ExcelPreview";
import {
  fileSelector,
  useWorkspaceStore,
  workspaceSelector,
} from "@/stores/useWorkspaceStore";
import { FileMeta } from "@/types";
import { Box, Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import { useShallow } from "zustand/shallow";
const AddFileModal = () => {
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileAlias, setFileAlias] = useState<string>("");
  const [headerRow, setHeaderRow] = useState<number>(1);
  const { saveWorkspace, isSaving, saveError } = useSaveWorkspaceMutation();
  const { previewData, isPreviewLoading, previewError } = useGetExcelPreview(
    selectedFilePath ?? "",
  );
  const { addFileToWorkspace, files } = useWorkspaceStore(
    useShallow(fileSelector),
  );
  const { currentWorkspace } = useWorkspaceStore(useShallow(workspaceSelector));

  const handleAddFileToWorkspace = useCallback(() => {
    if (!selectedFilePath || !fileAlias || !previewData) {
      toast.error("无法添加文件: 缺少路径、别名或有效的预览数据。");
      return;
    }
    if (previewError) {
      toast.error("无法添加文件: 请先解决预览错误。");
      return;
    }

    const newFile: FileMeta = {
      id: uuidv4(), // Generate unique ID
      alias: fileAlias,
      path: selectedFilePath,
      sheet_metas: previewData.sheets.map((sheet) => ({
        sheet_name: sheet.sheet_name,
        header_row: 0,
      })),
    };

    // Check if a file with the same path or alias already exists
    if (files?.some((f) => f.path === newFile.path)) {
      toast.warning(`文件路径 '${newFile.path}' 已存在于工作区中。`);
    }
    if (files?.some((f) => f.alias === newFile.alias)) {
      toast.warning(`文件别名 '${newFile.alias}' 已存在。请使用唯一的别名。`);
    }

    try {
      const newWorkspace = addFileToWorkspace(newFile);
      console.log("currentWorkspace", currentWorkspace);
      if (currentWorkspace) {
        saveWorkspace({
          id: currentWorkspace.id,
          // @ts-ignore as it will never be null
          workspace: newWorkspace,
        });
      } else {
        toast.error("无法保存工作区: 工作区不存在。这个提示不应该发生");
        return;
      }
      toast.success(`文件 "${newFile.alias}" 添加成功!`);
    } catch (error) {
      console.error("Error adding file to workspace:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`添加文件失败: ${errorMsg}`);
    }
  }, [selectedFilePath, fileAlias, previewData, previewError, currentWorkspace]);

  const handleFileSelect = useCallback(async () => {
    setSelectedFilePath(null); // Reset path on new selection attempt
    setFileAlias("");
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Excel Files",
            extensions: ["xlsx", "xls", "csv"],
          },
        ],
      });
      if (typeof selected === "string" && selected !== null) {
        setSelectedFilePath(selected);
        const fileName = selected.substring(selected.lastIndexOf("/") + 1);
        const aliasSuggestion = fileName.substring(
          0,
          fileName.lastIndexOf(".") || fileName.length,
        );
        setFileAlias(aliasSuggestion);
        // Automatically preview file with default values
        handlePreviewFile(selected);
      } else {
        // User cancelled dialog
        setSelectedFilePath(null);
        setFileAlias("");
      }
    } catch (err) {
      console.error("Error selecting file:", err);
      const errorMsg = typeof err === "string" ? err : (err as Error).message;
      toast.error(`选择文件失败: ${errorMsg}`);
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
      toast.error(`预览文件失败: ${errorMsg}`);
    }
  };

  return (
    <Dialog.Root
      onOpenChange={() => {
        setSelectedFilePath(null);
        setFileAlias("");
      }}
    >
      <Dialog.Trigger>
        <Button>添加文件</Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>
          <Flex direction="row" justify="between">
            <Text>{selectedFilePath?.split("/").pop()}</Text>
            <Dialog.Close>
              <Button variant="soft">关闭</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Title>
        <Dialog.Content className="min-h-48 max-w-2xl px-4 py-2">
          {!selectedFilePath && (
            <Flex direction="column" justify="between" gap="2" flexGrow={"1"}>
              <Text align="center">请选择文件</Text>
              <Button onClick={handleFileSelect}>选择文件</Button>
            </Flex>
          )}
          {selectedFilePath && isPreviewLoading && (
            <Flex direction="row" justify="between">
              <Text>加载中...</Text>
            </Flex>
          )}
          {selectedFilePath && !previewData && !isPreviewLoading && (
            <Flex direction="row" justify="between">
              <Text>加载失败</Text>
              <Button
                onClick={() => {
                  setSelectedFilePath(null);
                  handleFileSelect();
                }}
              >
                重新加载
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
                <Button variant="soft">添加文件</Button>
              </Dialog.Close>
            </Flex>
          )}
        </Dialog.Content>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default AddFileModal;
