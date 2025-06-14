import { Button } from "@/components/ui/button";
import AddFileModal from "@/components/workspace/AddFileModal";
import FileMetaEditorModal from "@/components/workspace/FileMetaEditorModal";
import useI18nToast from "@/hooks/useI18nToast";
import { apiClient } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { Box, Flex, ScrollArea, Text } from "@radix-ui/themes";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import {
  fileSelector,
  useWorkspaceStore,
} from "../../stores/useWorkspaceStore";

const FileLibrary: React.FC = () => {
  const toast = useI18nToast();
  const { t } = useTranslation();
  const { files, removeFileFromWorkspace, updateFileMeta, upToDateFileInfo } =
    useWorkspaceStore(useShallow(fileSelector));
  const { outdatedFileIds } = useWorkspaceStore(useShallow(fileSelector));
  const [syncingFileIds, setSyncingFileIds] = useState<string[]>([]);

  const handleSyncFile = async (fileId: string) => {
    const file = files?.find((f) => f.id === fileId);
    if (!file) {
      toast.error("file.syncError.notFound");
      return;
    }

    if (syncingFileIds.includes(fileId)) {
      return; // Prevent duplicate clicks
    }

    setSyncingFileIds((prev) => [...prev, fileId]);

    try {
      // 1. Get latest file info and preview data
      const [fileInfoResponse, previewData] = await Promise.all([
        apiClient.getFileInfo(file.path),
        apiClient.previewExcelData(file.path),
      ]);

      if (!fileInfoResponse?.file_info) {
        toast.error("file.syncError.getInfoFailed");
        setSyncingFileIds((prev) => prev.filter((id) => id !== fileId));
        return;
      }

      if (!previewData?.sheets) {
        toast.error("file.syncError.readFailed");
        setSyncingFileIds((prev) => prev.filter((id) => id !== fileId));
        return;
      }

      // 2. Compare old and new sheet_metas to preserve user-set header row info
      const oldSheetMetas = file.sheet_metas;
      const newSheetMetas = previewData.sheets.map((sheet: any) => {
        const existingSheet = oldSheetMetas.find(
          (old) => old.sheet_name === sheet.sheet_name,
        );
        return {
          sheet_name: sheet.sheet_name,
          header_row: existingSheet?.header_row ?? 0, // Preserve user settings or default to 0
        };
      });

      // 3. Generate change notifications
      const oldSheetNames = new Set(
        oldSheetMetas.map((s: any) => s.sheet_name),
      );
      const newSheetNames = new Set(
        newSheetMetas.map((s: any) => s.sheet_name),
      );

      const addedSheets = newSheetMetas
        .filter((s: any) => !oldSheetNames.has(s.sheet_name))
        .map((s: any) => s.sheet_name);
      const removedSheets = oldSheetMetas
        .filter((s: any) => !newSheetNames.has(s.sheet_name))
        .map((s: any) => s.sheet_name);

      if (addedSheets.length > 0) {
        toast.info("file.sync.sheetsAdded", {
          fileName: file.name,
          sheets: addedSheets.join(", "),
        });
      }
      if (removedSheets.length > 0) {
        toast.warning("file.sync.sheetsRemoved", {
          fileName: file.name,
          sheets: removedSheets.join(", "),
        });
      }

      // 4. Update file metadata
      updateFileMeta(fileId, {
        sheet_metas: newSheetMetas,
      });

      // 5. Update file info (this will remove the file from the outdated list)
      upToDateFileInfo(fileId, fileInfoResponse.file_info);

      toast.success("file.syncSuccess", { fileName: file.name });
    } catch (error) {
      toast.error("file.syncError.generic");
      console.error("File sync error:", error);
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
                {t("file.libraryTitle")}
              </Text>
              <AddFileModal />
            </Flex>
            {files?.length === 0 ? (
              <Text size="2" color="gray">
                {t("file.noFiles")}
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
                          {/* Sync button - only show for outdated files */}
                          {outdatedFileIds.includes(file.id) && (
                            <Button
                              size="1"
                              variant="soft"
                              color="orange"
                              onClick={() => handleSyncFile(file.id)}
                              disabled={syncingFileIds.includes(file.id)}
                            >
                              {syncingFileIds.includes(file.id)
                                ? t("file.syncing")
                                : t("file.sync")}
                            </Button>
                          )}
                          {/* Edit and delete buttons */}
                          <FileMetaEditorModal file={file} />
                          <Button
                            size="1"
                            variant="soft"
                            color="red"
                            onClick={() => {
                              removeFileFromWorkspace(file.id);
                            }}
                          >
                            {t("common.delete")}
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
