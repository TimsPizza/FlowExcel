import AddFileModal from "@/components/workspace/AddFileModal";
import { Box, Button, Flex, ScrollArea, Text } from "@radix-ui/themes";
import React from "react";
import { useShallow } from "zustand/shallow";
import {
  fileSelector,
  useWorkspaceStore,
} from "../../stores/useWorkspaceStore";
import FileMetaEditorModal from "@/components/workspace/FileMetaEditorModal";

const FileLibrary: React.FC = () => {
  const { files, removeFileFromWorkspace } = useWorkspaceStore(
    useShallow(fileSelector),
  );

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
                      style={{
                        border: "1px solid var(--gray-5)",
                        borderRadius: "var(--radius-2)",
                      }}
                    >
                      <Flex justify="between" align="center">
                        <Text size="2">
                          {file.path.substring(file.path.lastIndexOf("/") + 1)}
                        </Text>
                        <Flex gap="1">
                          {/* 编辑和删除按钮 - 待实现 */}
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
