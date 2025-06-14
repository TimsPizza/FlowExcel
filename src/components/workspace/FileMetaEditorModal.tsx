import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTryReadHeaderRow } from "@/hooks/workspaceQueries";
import { fileSelector, useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FileMeta } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, Flex, Select, Text, TextField } from "@radix-ui/themes";
import { useState } from "react";
import { useShallow } from "zustand/shallow";
import { useTranslation } from "react-i18next";

interface FileMetaEditorModalProps {
  file: FileMeta;
}

const FileMetaEditorModal = ({ file }: FileMetaEditorModalProps) => {
  const { t } = useTranslation();
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
          {t("file.meta.edit")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Card>
          <CardHeader>
            <CardTitle>{t("file.meta.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Flex direction="column" gap="3">
              <Flex align="center" gap="2">
                <Text size="2" weight="bold">
                  {t("file.meta.alias")}:
                </Text>
                <Text size="2">{file.name}</Text>
              </Flex>

              <Flex align="center" gap="2">
                <Text size="2" weight="bold">
                  {t("file.meta.selectSheet")}:
                </Text>
                <Select.Root
                  value={selectedSheetSt || ""}
                  onValueChange={setSelectedSheetSt}
                >
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item key={"all-sheets"} value={"all-sheets"}>
                      {t("file.meta.allSheets")}
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
                  {t("file.meta.headerRowTooltip")} {headerRowIndexSt}
                </Text>
              )}

              {selectedSheetSt && (
                <Flex direction="column" gap="3">
                  <Flex align="center" gap="2">
                    <Text size="2" weight="bold">
                      {t("file.meta.headerRowIndex")}:
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
                      {t("file.meta.headerRowTooltip")}
                    </Text>
                    <Text size="1" color="amber">
                      {t("file.meta.headerRowWarning")}
                    </Text>
                  </Flex>

                  <Text size="2" weight="bold">
                    {t("file.meta.detectedHeader")}:
                  </Text>
                  {isHeaderRowLoading ? (
                    <Text size="1" color="gray">
                      {t("file.meta.detectingHeader")}
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
                    {t("common.cancel")}
                  </Button>
                </Dialog.Close>
                <Button onClick={handleSave}>{t("common.save")}</Button>
              </Flex>
            </Flex>
          </CardContent>
        </Card>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default FileMetaEditorModal;
