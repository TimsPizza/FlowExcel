import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTryReadHeaderRow } from "@/hooks/workspaceQueries";
import { fileSelector, useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FileMeta } from "@/types";
import {
  Button,
  Dialog,
  Flex,
  Select,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useState } from "react";
import { useShallow } from "zustand/shallow";

interface FileMetaEditorModalProps {
  file: FileMeta;
}

const FileMetaEditorModal = ({ file }: FileMetaEditorModalProps) => {
  const { updateFileMeta } = useWorkspaceStore(useShallow(fileSelector));
  const [open, setOpen] = useState(false);
  const [headerRowIndex, setHeaderRowIndex] = useState<string>("0");
  const [selectedSheet, setSelectedSheet] = useState<string | null>(
    file.sheet_metas.length > 0 ? file.sheet_metas[0].sheet_name : null,
  );
  const {
    headerRow: detectedHeaderRow,
    isHeaderRowLoading,
    headerRowError,
  } = useTryReadHeaderRow(
    file.path,
    selectedSheet && selectedSheet !== "all-sheets" ? selectedSheet : "",
    parseInt(headerRowIndex), // if not a number, will not run
  );

  const handleHeaderRowChange = (value: string) => {
    setHeaderRowIndex(value);
  };

  const handleSave = () => {
    let updatedSheetMetas = file.sheet_metas;

    if (selectedSheet && selectedSheet !== "all-sheets") {
      // 找到目标 sheet
      const targetSheet = updatedSheetMetas.find(
        (sheet) => sheet.sheet_name === selectedSheet,
      );
      if (targetSheet) {
        targetSheet.header_row = parseInt(headerRowIndex);
      }
      // 这里不用 map，直接改原对象即可
    } else {
      // “all-sheets”模式，批量 map 更新
      updatedSheetMetas = file.sheet_metas.map((sheet) => ({
        ...sheet,
        header_row: parseInt(headerRowIndex),
      }));
    }

    // 更新 metadata
    updateFileMeta(file.id, { sheet_metas: updatedSheetMetas });
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <Button variant="soft" size="1">
          设置
        </Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Card>
          <CardHeader>
            <CardTitle>元数据编辑器</CardTitle>
          </CardHeader>
          <CardContent>
            <Flex direction="column" gap="3">
              <Flex align="center" gap="2">
                <Text size="2" weight="bold">
                  文件名:
                </Text>
                <Text size="2">{file.name}</Text>
              </Flex>

              <Flex align="center" gap="2">
                <Text size="2" weight="bold">
                  工作表:
                </Text>
                <Select.Root
                  value={selectedSheet || ""}
                  onValueChange={setSelectedSheet}
                >
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item key={"all-sheets"} value={"all-sheets"}>
                      所有工作表
                    </Select.Item>
                    {file.sheet_metas.map((sheet) => (
                      <Select.Item
                        key={sheet.sheet_name}
                        value={sheet.sheet_name}
                      >
                        {sheet.sheet_name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Flex>

              {selectedSheet && (
                <Flex direction="column" gap="3">
                  <Flex align="center" gap="2">
                    <Text size="2" weight="bold">
                      标题行:
                    </Text>
                    <TextField.Root
                      size="2"
                      type="number"
                      value={headerRowIndex}
                      onChange={(e) => handleHeaderRowChange(e.target.value)}
                    />
                  </Flex>

                  <Text size="1" color="gray">
                    标题行用于识别列名称。0表示第一行，1表示第二行，以此类推。
                  </Text>

                  <Text size="2" weight="bold">
                    检测到的列:
                  </Text>
                  {isHeaderRowLoading ? (
                    <Text size="1" color="gray">
                      正在检测标题行...
                    </Text>
                  ) : (
                    <Flex gap="1" wrap="wrap">
                      {detectedHeaderRow?.column_names.map((column) => (
                        <Text
                          key={column}
                          size="1"
                          style={{
                            border: "1px solid var(--gray-5)",
                            borderRadius: "var(--radius-1)",
                            padding: "2px 6px",
                          }}
                        >
                          {column}
                        </Text>
                      ))}
                    </Flex>
                  )}
                </Flex>
              )}

              <Flex justify="end" gap="2" mt="4">
                <Dialog.Close>
                  <Button variant="soft" color="gray">
                    取消
                  </Button>
                </Dialog.Close>
                <Button onClick={handleSave}>保存</Button>
              </Flex>
            </Flex>
          </CardContent>
        </Card>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default FileMetaEditorModal;
