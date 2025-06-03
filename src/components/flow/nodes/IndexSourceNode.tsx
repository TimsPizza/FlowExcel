import {
  useGetIndexValues,
  usePreviewNodeMutation,
  useTryReadHeaderRow,
  useTryReadSheetNames,
} from "@/hooks/workspaceQueries";
import {
  convertPreviewToSheets,
  getPreviewMetadata,
  isIndexSourcePreview,
} from "@/lib/utils";
import { fileSelector, useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FlowNodeProps, IndexSourceNodeDataContext } from "@/types/nodes";
import { Button, Flex, RadioGroup, Select, Text } from "@radix-ui/themes";
import { useMemo, useState } from "react";
import { useNodeId } from "reactflow";
import { useShallow } from "zustand/react/shallow";
import { BaseNode } from "./BaseNode";
import {
  BadgeConfig,
  EnhancedBaseNode,
} from "@/components/flow/nodes/EnhancedBaseNode";

export const IndexSourceNode: React.FC<FlowNodeProps> = ({ data }) => {
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

  const { headerRow, isHeaderRowLoading, headerRowError } = useTryReadHeaderRow(
    files?.find((file) => file.id === nodeData.sourceFileID)?.path || "",
    nodeData.sheetName || "",
    nodeData.sourceFileID && nodeData.sheetName
      ? files
          ?.find((file) => file.id === nodeData.sourceFileID)
          ?.sheet_metas.find((sheet) => sheet.sheet_name === nodeData.sheetName)
          ?.header_row || 0
      : 0,
  );

  const {
    indexValuesArr: indexValues,
    isIndexValuesLoading,
    indexValuesError,
  } = useGetIndexValues(
    files?.find((file) => file.id === nodeData.sourceFileID)?.path || "",
    nodeData.sheetName || "",
    nodeData.sourceFileID && nodeData.sheetName
      ? files
          ?.find((file) => file.id === nodeData.sourceFileID)
          ?.sheet_metas.find((sheet) => sheet.sheet_name === nodeData.sheetName)
          ?.header_row || 0
      : 0,
    nodeData.columnName ? [nodeData.columnName] : [],
  );

  const handleSelectFile = async (fileId: string) => {
    updateIndexSourceNodeData(nodeId, {
      sourceFileID: fileId,
      sheetName: undefined,
      columnName: "",
      testResult: undefined,
      error: undefined,
    });
  };

  const handleModeChange = (newMode: "sheet" | "column") => {
    setIndexMode(newMode);
    if (newMode === "sheet") {
      updateIndexSourceNodeData(nodeId, {
        bySheetName: true,
        byColumn: false,
        columnName: "",
        error: undefined,
        testResult: undefined,
      });
    } else {
      updateIndexSourceNodeData(nodeId, {
        bySheetName: false,
        byColumn: true,
        error: undefined,
        testResult: undefined,
      });
    }
  };

  const handleSheetChange = (newSheetName: string) => {
    if (indexMode === "column") {
      updateIndexSourceNodeData(nodeId, {
        sheetName: newSheetName,
        columnName: "",
        error: undefined,
        testResult: undefined,
      });
    } else {
      updateIndexSourceNodeData(nodeId, {
        sheetName: newSheetName,
        error: undefined,
        testResult: undefined,
      });
    }
  };

  const handleColumnNameChange = (newColumnName: string) => {
    updateIndexSourceNodeData(nodeId, {
      columnName: newColumnName,
      error: undefined,
      testResult: undefined,
    });
  };

  const previewNode = async () => {
    if (!currentWorkspace) {
      console.error("未找到当前工作区");
      return;
    }

    if (!nodeData.sourceFileID) {
      updateIndexSourceNodeData(nodeId, { error: "请选择源文件" });
      return;
    }

    previewNodeMutation.mutate(
      {
        nodeId: nodeData.id,
        testModeMaxRows: 100,
        workspaceConfig: currentWorkspace || undefined,
      },
      {
        onSuccess: (result) => {
          console.log("IndexSource Preview result:", result);

          if (result.success) {
            if (isIndexSourcePreview(result)) {
              console.log("Index values:", result.index_values);
              console.log("Source column:", result.source_column);

              const sheets = convertPreviewToSheets(result);
              console.log("sheets", sheets);

              updateIndexSourceNodeData(nodeId, {
                testResult: sheets,
                error: undefined,
              });
            }
          } else {
            updateIndexSourceNodeData(nodeId, {
              error: result.error || "预览失败",
              testResult: undefined,
            });
          }
        },
        onError: (error: Error) => {
          console.error("Preview failed:", error);
          updateIndexSourceNodeData(nodeId, {
            error: `预览失败: ${error.message}`,
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
          "未指定!",
      });
    }

    if (indexMode === "column") {
      badges.push({
        color: "orange",
        variant: "soft",
        label: "列名索引",
      });
    } else {
      badges.push({
        color: "blue",
        variant: "soft",
        label: "工作表索引",
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
              源文件:
            </Text>
            <Select.Root
              value={nodeData.sourceFileID || ""}
              onValueChange={handleSelectFile}
            >
              <Select.Trigger placeholder="选择文件" />
              <Select.Content>
                <Select.Group>
                  {files && files.length > 0 ? (
                    files.map((file) => (
                      <Select.Item value={file.id} key={file.id}>
                        {file.name}
                      </Select.Item>
                    ))
                  ) : (
                    <Text size="1">暂无文件</Text>
                  )}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Flex>

          <Flex align="center" gap="2">
            <Text size="1" weight="bold" style={{ width: "60px" }}>
              索引方式:
            </Text>
            <RadioGroup.Root
              value={indexMode}
              onValueChange={(val: string) =>
                handleModeChange(val as "sheet" | "column")
              }
              size="1"
            >
              <Flex gap="2">
                <RadioGroup.Item value="sheet">工作表名</RadioGroup.Item>
                <RadioGroup.Item value="column">列名</RadioGroup.Item>
              </Flex>
            </RadioGroup.Root>
          </Flex>

          {indexMode === "column" && (
            <>
              <Flex align="center" gap="2">
                <Text size="1" weight="bold" style={{ width: "60px" }}>
                  工作表:
                </Text>
                <Select.Root
                  size="1"
                  value={nodeData.sheetName || ""}
                  onValueChange={handleSheetChange}
                  disabled={!nodeData.sourceFileID}
                >
                  <Select.Trigger placeholder="选择工作表" />
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
                  索引列:
                </Text>
                <Select.Root
                  size="1"
                  value={nodeData.columnName || ""}
                  onValueChange={handleColumnNameChange}
                  disabled={!nodeData.sourceFileID || !nodeData.sheetName}
                >
                  <Select.Trigger placeholder="选择索引列" />
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
          {(headerRowError || indexValuesError) && (
            <Text color="red" size="1">
              {headerRowError && (
                <span>
                  {headerRowError instanceof Error
                    ? headerRowError.message
                    : String(headerRowError)}
                </span>
              )}
              {headerRowError && indexValuesError ? <br /> : null}
              {indexValuesError && (
                <span>
                  {indexValuesError instanceof Error
                    ? indexValuesError.message
                    : String(indexValuesError)}
                </span>
              )}
            </Text>
          )}
        </Flex>
      </EnhancedBaseNode>
    </>
  );
};
