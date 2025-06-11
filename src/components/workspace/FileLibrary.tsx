import { Button } from "@/components/ui/button";
import AddFileModal from "@/components/workspace/AddFileModal";
import FileMetaEditorModal from "@/components/workspace/FileMetaEditorModal";
import { cn } from "@/lib/utils";
import useToast from "@/hooks/useToast";
import { apiClient } from "@/lib/apiClient";
import { Box, Flex, ScrollArea, Text } from "@radix-ui/themes";
import React, { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  fileSelector,
  useWorkspaceStore,
} from "../../stores/useWorkspaceStore";

const FileLibrary: React.FC = () => {
  const toast = useToast();
  const { files, removeFileFromWorkspace, updateFileMeta, upToDateFileInfo } =
    useWorkspaceStore(useShallow(fileSelector));
  const { outdatedFileIds } = useWorkspaceStore(useShallow(fileSelector));
  const [syncingFileIds, setSyncingFileIds] = useState<string[]>([]);

  const handleSyncFile = async (fileId: string) => {
    const file = files?.find((f) => f.id === fileId);
    if (!file) {
      toast.error("文件不存在");
      return;
    }

    if (syncingFileIds.includes(fileId)) {
      return; // 防止重复点击
    }

    setSyncingFileIds((prev) => [...prev, fileId]);

    try {
      // 1. 获取最新文件信息和预览数据
      const [fileInfoResponse, previewData] = await Promise.all([
        apiClient.getFileInfo(file.path),
        apiClient.previewExcelData(file.path),
      ]);

      if (!fileInfoResponse?.file_info) {
        toast.error("无法获取文件信息，文件可能已被删除");
        return;
      }

      if (!previewData?.sheets) {
        toast.error("无法读取文件内容，文件可能已损坏");
        return;
      }

      // 2. 对比新旧 sheet_metas，保护用户设置的表头行信息
      const oldSheetMetas = file.sheet_metas;
      const newSheetMetas = previewData.sheets.map((sheet: any) => {
        const existingSheet = oldSheetMetas.find(
          (old) => old.sheet_name === sheet.sheet_name,
        );
        return {
          sheet_name: sheet.sheet_name,
          header_row: existingSheet?.header_row ?? 0, // 保留用户设置或默认为0
        };
      });

      // 3. 生成变动通知
      const oldSheetNames = new Set(
        oldSheetMetas.map((s: any) => s.sheet_name),
      );
      const newSheetNames = new Set(
        newSheetMetas.map((s: any) => s.sheet_name),
      );

      const addedSheets = newSheetMetas.filter(
        (s: any) => !oldSheetNames.has(s.sheet_name),
      );
      const removedSheets = oldSheetMetas.filter(
        (s: any) => !newSheetNames.has(s.sheet_name),
      );

      // 4. 更新文件元数据
      updateFileMeta(fileId, {
        sheet_metas: newSheetMetas,
      });

      // 5. 更新文件信息（这会将文件从过期列表中移除）
      upToDateFileInfo(fileId, fileInfoResponse.file_info);

      // 6. 通知用户变动
      let changeMessage = `文件 "${file.name}" 同步完成`;
      if (addedSheets.length > 0) {
        changeMessage += `\n新增工作表: ${addedSheets.map((s: any) => s.sheet_name).join(", ")}`;
      }
      if (removedSheets.length > 0) {
        changeMessage += `\n删除工作表: ${removedSheets.map((s: any) => s.sheet_name).join(", ")}`;
      }
      if (addedSheets.length === 0 && removedSheets.length === 0) {
        changeMessage += "\n工作表结构无变化";
      }

      toast.success(changeMessage);
    } catch (error) {
      console.error("Error syncing file:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`同步文件失败: ${errorMsg}`);
    } finally {
      setSyncingFileIds((prev) => prev.filter((id) => id !== fileId));
    }
  };

  return (
    <Flex direction="column" gap="4" width={"100%"}>
      <Box p="4">
        <Flex direction="column" gap="5">
          <Box>
            <Flex justify="start" align="baseline" gap="2">
              <Text weight="medium" size="3" mb="2">
                工作区文件
              </Text>
              <AddFileModal />
            </Flex>
            {files?.length === 0 ? (
              <Text size="2" color="gray">
                当前工作区还没有添加文件。
              </Text>
            ) : (
              <ScrollArea className="mt-4">
                <Flex direction="column" gap="1">
                  {files?.map((file) => (
                    <Box
                      key={file.id}
                      p="2"
                      className={cn(
                        "border-gray-5 rounded-2 border",
                        outdatedFileIds.includes(file.id) && "!border-red-300",
                      )}
                    >
                      <Flex justify="between" align="center">
                        <Text size="2">
                          {file.path.substring(file.path.lastIndexOf("/") + 1)}
                        </Text>
                        <Flex gap="1">
                          {/* 同步按钮 - 仅为过期文件显示 */}
                          {outdatedFileIds.includes(file.id) && (
                            <Button
                              size="1"
                              variant="soft"
                              color="orange"
                              onClick={() => handleSyncFile(file.id)}
                              disabled={syncingFileIds.includes(file.id)}
                            >
                              {syncingFileIds.includes(file.id)
                                ? "同步中..."
                                : "同步文件"}
                            </Button>
                          )}
                          {/* 编辑和删除按钮 */}
                          <FileMetaEditorModal file={file} />
                          <Button
                            size="1"
                            variant="soft"
                            color="red"
                            onClick={() => {
                              removeFileFromWorkspace(file.id);
                            }}
                          >
                            删除
                          </Button>
                        </Flex>
                      </Flex>
                    </Box>
                  ))}
                </Flex>
              </ScrollArea>
            )}
          </Box>
        </Flex>
      </Box>
    </Flex>
  );
};

export default FileLibrary;
