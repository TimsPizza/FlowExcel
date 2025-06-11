import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTryReadHeaderRow } from "@/hooks/workspaceQueries";
import { fileSelector, useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FileMeta } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, Flex, Select, Text, TextField } from "@radix-ui/themes";
import { useState } from "react";
import { useShallow } from "zustand/shallow";

interface FileMetaEditorModalProps {
  file: FileMeta;
}

const FileMetaEditorModal = ({ file }: FileMetaEditorModalProps) => {
  const { updateFileMeta } = useWorkspaceStore(useShallow(fileSelector));
  const [open, setOpen] = useState(false);
  const [selectedSheetSt, setSelectedSheetSt] = useState<string | null>(
    file.sheet_metas.length > 0 ? file.sheet_metas[0].sheet_name : null,
  );
  const [headerRowIndexSt, setHeaderRowIndexSt] = useState<string>(
    file.sheet_metas
      .find((sheet) => sheet.sheet_name === selectedSheetSt)
      ?.header_row?.toString() || "0",
  );

  const { headerRow: detectedHeaderRow, isHeaderRowLoading } =
    useTryReadHeaderRow(
      file.path,
      selectedSheetSt && selectedSheetSt !== "all-sheets"
        ? selectedSheetSt
        : "",
      parseInt(
        file.sheet_metas
          .find((sheet) => sheet.sheet_name === selectedSheetSt)
          ?.header_row?.toString() || "0",
      ), // if not a number, will not run
    );

  const handleHeaderRowChange = (selectedSheet: string, value: string) => {
    // setHeaderRowIndex(value);
    if (selectedSheet === "all-sheets") {
      console.log("changing all sheets header row to", value);
      updateFileMeta(file.id, {
        sheet_metas: file.sheet_metas.map((sheet) => ({
          ...sheet,
          header_row: parseInt(value),
        })),
      });
    } else {
      updateFileMeta(file.id, {
        sheet_metas: file.sheet_metas.map((sheet) =>
          sheet.sheet_name === selectedSheet
            ? { ...sheet, header_row: parseInt(value) }
            : sheet,
        ),
      });
    }
    setHeaderRowIndexSt(parseInt(value).toString());
  };

  const handleSave = () => {
    let updatedSheetMetas = file.sheet_metas;

    if (selectedSheetSt && selectedSheetSt !== "all-sheets") {
      // 找到目标 sheet
      const targetSheet = updatedSheetMetas.find(
        (sheet) => sheet.sheet_name === selectedSheetSt,
      );
      if (targetSheet) {
        targetSheet.header_row = parseInt(headerRowIndexSt);
      }
    } else {
      updatedSheetMetas = file.sheet_metas.map((sheet) => ({
        ...sheet,
        header_row: parseInt(headerRowIndexSt),
      }));
    }
    console.log("new sheet metas", updatedSheetMetas);

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
                  value={selectedSheetSt || ""}
                  onValueChange={setSelectedSheetSt}
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
              {selectedSheetSt === "all-sheets" && (
                <Text size="1" color="amber">
                  所有工作表的标题行将统一设置为{headerRowIndexSt}
                  （覆盖现有设置）
                </Text>
              )}

              {selectedSheetSt && (
                <Flex direction="column" gap="3">
                  <Flex align="center" gap="2">
                    <Text size="2" weight="bold">
                      标题行:
                    </Text>
                    <TextField.Root
                      size="2"
                      type="number"
                      value={
                        selectedSheetSt === "all-sheets"
                          ? headerRowIndexSt
                          : file.sheet_metas
                              .find(
                                (sheet) => sheet.sheet_name === selectedSheetSt,
                              )
                              ?.header_row?.toString() || "0"
                      }
                      onChange={(e) =>
                        handleHeaderRowChange(selectedSheetSt, e.target.value)
                      }
                    />
                  </Flex>

                  <Flex direction="column" gap="1">
                    <Text size="1" color="gray">
                      标题行用于识别列名称。0表示第一行，1表示第二行，以此类推。
                    </Text>
                    <Text size="1" color="amber">
                      注意！错误的标题行号将导致执行结果异常甚至无法执行！
                    </Text>
                  </Flex>

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
                          className="border-gray-5 rounded-md border px-2 py-1"
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
