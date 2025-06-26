import {
  BadgeConfig,
  EnhancedBaseNode,
} from "@/components/flow/nodes/EnhancedBaseNode";
import {
  usePreviewNodeMutation,
  useTryReadHeaderRow,
} from "@/hooks/workspaceQueries";
import { convertPreviewToSheets, isIndexSourcePreview } from "@/lib/utils";
import { fileSelector, useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FlowNodeProps, IndexSourceNodeDataContext } from "@/types/nodes";
import { Flex, TextField, RadioGroup, Select, Text } from "@radix-ui/themes";
import { useMemo, useState } from "react";
import { useNodeId } from "reactflow";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";

export const IndexSourceNode: React.FC<FlowNodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const nodeId = useNodeId()!;
  const nodeData = data as IndexSourceNodeDataContext;
  const { files } = useWorkspaceStore(useShallow(fileSelector));
  const updateIndexSourceNodeData = useWorkspaceStore(
    (state) => state.updateNodeData,
  );
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);

  const previewNodeMutation = usePreviewNodeMutation();

  const [indexMode, setIndexMode] = useState<"sheet" | "column">(() => {
    if (nodeData.bySheetName) return "sheet";
    if (nodeData.byColumn || nodeData.columnName) return "column";
    return "column";
  });

  const { headerRow, headerRowError } = useTryReadHeaderRow(
    files?.find((file) => file.id === nodeData.sourceFileID)?.path || "",
    nodeData.sheetName || "",
    nodeData.sourceFileID && nodeData.sheetName
      ? files
          ?.find((file) => file.id === nodeData.sourceFileID)
          ?.sheet_metas.find((sheet) => sheet.sheet_name === nodeData.sheetName)
          ?.header_row || 0
      : 0,
  );

  const handleSelectFile = async (fileId: string) => {
    updateIndexSourceNodeData(
      nodeId,
      {
        sourceFileID: fileId,
        sheetName: undefined,
        columnName: "",
        testResult: undefined,
        error: undefined,
      },
      true,
    );
  };

  const handleModeChange = (newMode: "sheet" | "column") => {
    setIndexMode(newMode);
    if (newMode === "sheet") {
      updateIndexSourceNodeData(
        nodeId,
        {
          bySheetName: true,
          byColumn: false,
          columnName: "",
          error: undefined,
          testResult: undefined,
        },
        true,
      );
    } else {
      updateIndexSourceNodeData(
        nodeId,
        {
          bySheetName: false,
          byColumn: true,
          error: undefined,
          testResult: undefined,
        },
        true,
      );
    }
  };

  const handleSheetChange = (newSheetName: string) => {
    if (indexMode === "column") {
      updateIndexSourceNodeData(
        nodeId,
        {
          sheetName: newSheetName,
          columnName: "",
          error: undefined,
          testResult: undefined,
        },
        true,
      );
    } else {
      updateIndexSourceNodeData(
        nodeId,
        {
          sheetName: newSheetName,
          error: undefined,
          testResult: undefined,
        },
        true,
      );
    }
  };

  const handleColumnNameChange = (newColumnName: string) => {
    updateIndexSourceNodeData(
      nodeId,
      {
        columnName: newColumnName,
        error: undefined,
        testResult: undefined,
      },
      true,
    );
  };

  const handleDisplayNameChange = (newDisplayName: string) => {
    updateIndexSourceNodeData(
      nodeId,
      {
        displayName: newDisplayName,
      },
      true,
    );
  };

  const previewNode = async () => {
    if (!currentWorkspace) {
      return;
    }

    if (!nodeData.sourceFileID) {
      updateIndexSourceNodeData(nodeId, {
        error: t("node.indexSourceNode.selectSourceFile"),
      });
      return;
    }

    // clear existing test result
    updateIndexSourceNodeData(nodeId, {
      testResult: undefined,
      error: undefined,
    });

    previewNodeMutation.mutate(
      {
        nodeId: nodeData.id,
        testModeMaxRows: 100,
        workspaceConfig: currentWorkspace || undefined,
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            if (isIndexSourcePreview(result)) {
              const sheets = convertPreviewToSheets(result);

              updateIndexSourceNodeData(nodeId, {
                testResult: sheets,
                error: undefined,
              });
            }
          } else {
            updateIndexSourceNodeData(nodeId, {
              error: result.error || t("node.common.previewFailed"),
              testResult: undefined,
            });
          }
        },
        onError: (error: Error) => {
          updateIndexSourceNodeData(nodeId, {
            error: t("node.common.previewFailedWithError", {
              error: error.message,
            }),
            testResult: undefined,
          });
        },
      },
    );
  };

  const badges: BadgeConfig[] = useMemo(() => {
    const badges: BadgeConfig[] = [];
    if (nodeData.sourceFileID) {
      badges.push({
        color: "green",
        variant: "soft",
        label:
          files?.find((file) => file.id === nodeData.sourceFileID)?.name ||
          t("node.indexSourceNode.notSpecified"),
      });
    }

    if (indexMode === "column") {
      badges.push({
        color: "orange",
        variant: "soft",
        label: t("node.indexSourceNode.columnIndex"),
      });
    } else {
      badges.push({
        color: "blue",
        variant: "soft",
        label: t("node.indexSourceNode.sheetIndex"),
      });
    }
    if (indexMode === "column" && nodeData.sheetName) {
      badges.push({
        color: "blue",
        variant: "soft",
        label: nodeData.sheetName,
      });
    }
    if (nodeData.columnName) {
      badges.push({
        color: "green",
        variant: "soft",
        label: nodeData.columnName,
      });
    }
    return badges;
  }, [
    nodeData.sourceFileID,
    nodeData.sheetName,
    nodeData.columnName,
    indexMode,
    files,
    t,
  ]);

  return (
    <>
      <EnhancedBaseNode
        data={nodeData}
        isSource={true}
        isTarget={false}
        onTestRun={previewNode}
        testable
        badges={badges}
      >
        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            <Text size="1" weight="bold" style={{ width: "60px" }}>
              {t("node.indexSourceNode.outputName")}
            </Text>
            <TextField.Root
              value={nodeData.displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
            >
              <TextField.Slot />
            </TextField.Root>
          </Flex>
          <Flex align="center" gap="2">
            <Text size="1" weight="bold" style={{ width: "60px" }}>
              {t("node.indexSourceNode.sourceFile")}
            </Text>
            <Select.Root
              value={nodeData.sourceFileID || ""}
              onValueChange={handleSelectFile}
            >
              <Select.Trigger
                placeholder={t("node.indexSourceNode.selectFile")}
              />
              <Select.Content>
                <Select.Group>
                  {files && files.length > 0 ? (
                    files.map((file) => (
                      <Select.Item value={file.id} key={file.id}>
                        {file.name}
                      </Select.Item>
                    ))
                  ) : (
                    <Text size="1">{t("node.indexSourceNode.noFiles")}</Text>
                  )}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Flex>

          <Flex align="center" gap="2">
            <Text size="1" weight="bold" style={{ width: "60px" }}>
              {t("node.indexSourceNode.indexMode")}
            </Text>
            <RadioGroup.Root
              value={indexMode}
              onValueChange={(val: string) =>
                handleModeChange(val as "sheet" | "column")
              }
              size="1"
            >
              <Flex gap="2">
                <RadioGroup.Item value="sheet">
                  {t("node.indexSourceNode.sheetName")}
                </RadioGroup.Item>
                <RadioGroup.Item value="column">
                  {t("node.indexSourceNode.columnName")}
                </RadioGroup.Item>
              </Flex>
            </RadioGroup.Root>
          </Flex>

          {indexMode === "column" && (
            <>
              <Flex align="center" gap="2">
                <Text size="1" weight="bold" style={{ width: "60px" }}>
                  {t("node.indexSourceNode.worksheet")}
                </Text>
                <Select.Root
                  size="1"
                  value={nodeData.sheetName || ""}
                  onValueChange={handleSheetChange}
                  disabled={!nodeData.sourceFileID}
                >
                  <Select.Trigger
                    placeholder={t("node.indexSourceNode.selectSheet")}
                  />
                  <Select.Content>
                    <Select.Group>
                      {nodeData.sourceFileID &&
                        files
                          ?.find((f) => f.id === nodeData.sourceFileID)
                          ?.sheet_metas?.map((sheet) => (
                            <Select.Item
                              value={sheet.sheet_name}
                              key={sheet.sheet_name}
                            >
                              {sheet.sheet_name}
                            </Select.Item>
                          ))}
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </Flex>

              <Flex align="center" gap="2">
                <Text size="1" weight="bold" style={{ width: "60px" }}>
                  {t("node.indexSourceNode.indexColumn")}
                </Text>
                <Select.Root
                  size="1"
                  value={nodeData.columnName || ""}
                  onValueChange={handleColumnNameChange}
                  disabled={!nodeData.sourceFileID || !nodeData.sheetName}
                >
                  <Select.Trigger
                    placeholder={t("node.indexSourceNode.selectIndexColumn")}
                  />
                  <Select.Content>
                    <Select.Group>
                      {headerRow?.column_names?.map((column: string) => (
                        <Select.Item value={column} key={column}>
                          {column}
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </Flex>
            </>
          )}
          {headerRowError && (
            <Text color="red" size="1">
              <span>
                {headerRowError instanceof Error
                  ? headerRowError.message
                  : String(headerRowError)}
              </span>
            </Text>
          )}
        </Flex>
      </EnhancedBaseNode>
    </>
  );
};
