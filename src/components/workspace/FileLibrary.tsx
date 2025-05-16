import AddFileModal from "@/components/workspace/AddFileModal";
import { useGetExcelPreview } from "@/hooks/workspaceQueries";
import { FileMeta } from "@/types";
import { Box, Button, Flex, ScrollArea, Text } from "@radix-ui/themes";
import React, { useCallback, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import { useShallow } from "zustand/shallow";
import {
  fileSelector,
  useWorkspaceStore,
} from "../../stores/useWorkspaceStore";

const FileLibrary: React.FC = () => {
  const { files } = useWorkspaceStore(useShallow(fileSelector));

  return (
    <Flex direction="column" gap="4" width={"100%"}>
      <Box p="4">
        <Text weight="bold" size="4" mb="3">
          文件库
        </Text>
        <AddFileModal />

        <Flex direction="column" gap="5">
          <Box>
            <Text weight="medium" size="3" mb="2">
              工作区文件
            </Text>
            {files?.length === 0 ? (
              <Text size="2" color="gray">
                当前工作区还没有添加文件。
              </Text>
            ) : (
              <ScrollArea>
                <Flex direction="column" gap="1">
                  {files?.map((file) => (
                    <Box
                      key={file.id}
                      p="2"
                      style={{
                        border: "1px solid var(--gray-5)",
                        borderRadius: "var(--radius-2)",
                      }}
                    >
                      <Flex justify="between" align="center">
                        <Text size="2">
                          {file.alias} (
                          {file.path.substring(file.path.lastIndexOf("/") + 1)})
                          - 表头: {file.header_row}
                          {file.sheet_name
                            ? `, 工作表: ${file.sheet_name}`
                            : ""}
                        </Text>
                        <Flex gap="1">
                          {/* 编辑和删除按钮 - 待实现 */}
                          <Button size="1" variant="soft">
                            编辑
                          </Button>
                          <Button size="1" variant="soft" color="red">
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
