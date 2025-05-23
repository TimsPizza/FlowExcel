import {
  useGetIndexValues,
  useTryReadHeaderRow,
  useTryReadSheetNames,
  useTestPipelineNodeMutation,
} from "@/hooks/workspaceQueries";
import { fileSelector, useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FlowNodeProps, IndexSourceNodeDataContext } from "@/types/nodes";
import { Flex, RadioGroup, Select, Text, TextField, Badge } from "@radix-ui/themes";
import { useState } from "react";
import { useNodeId } from "reactflow";
import { useShallow } from "zustand/react/shallow";
import { BaseNode } from "./BaseNode";
import { FileMeta } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "react-toastify";

export const IndexSourceNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId()!;
  const nodeData = data as IndexSourceNodeDataContext;
  const { files } = useWorkspaceStore(useShallow(fileSelector));
  const updateIndexSourceNodeData = useWorkspaceStore(
    (state) => state.updateNodeData,
  );
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  
  const testPipelineNodeMutation = useTestPipelineNodeMutation();

  const { sheetNamesArr, isSheetNamesLoading, sheetNamesError } =
    useTryReadSheetNames(
      files?.find((file) => file.id === nodeData.sourceFileID)?.path || "",
      nodeData.bySheetName || false,
    );

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

  const testRun = async () => {
    if (!nodeData.sourceFileID) {
      updateIndexSourceNodeData(nodeId, { error: "请选择源文件" });
      return;
    }
    if (indexMode === "sheet") {
      updateIndexSourceNodeData(
        nodeId,
        {
          testResult: {
            // columns: ["获取到的sheet名称"],
            data: [sheetNamesArr?.sheet_names || []],
          },
          error: sheetNamesError ? "获取工作表名失败" : undefined,
        },
        false,
      );
    } else {
      if (!nodeData.sheetName || !nodeData.columnName) {
        updateIndexSourceNodeData(nodeId, { error: "请选择工作表和索引列" });
        return;
      }
      updateIndexSourceNodeData(
        nodeId,
        {
          testResult: {
            data:
              indexValues && indexValues.length > 0 && indexValues[0]
                ? [indexValues[0].data]
                : [],
          },
          error: indexValuesError ? "获取索引值失败" : undefined,
        },
        false,
      );
    }
  };

  const testPipelineRun = async () => {
    if (!currentWorkspace) {
      toast.error("未找到当前工作区");
      return;
    }

    testPipelineNodeMutation.mutate(
      {
        workspaceId: currentWorkspace.id,
        nodeId: nodeData.id,
      },
      {
        onSuccess: (result) => {
          const nodeResults = result.results[nodeData.id];
          if (nodeResults && nodeResults.length > 0) {
            // 处理索引源节点的结果数据
            const nodeResult = nodeResults[0]; // 索引源节点只有一个结果
            if (nodeResult.result_data) {
              const { columns, data } = nodeResult.result_data;
              
              // 将数据转换为前端需要的格式
              const formattedData = [];
              if (data && data.length > 0) {
                // 如果是按列索引，提取唯一值
                if (nodeData.byColumn && columns.length > 0) {
                  const columnName = columns[0];
                  const uniqueValues = [...new Set(data.map((row: Record<string, any>) => row[columnName]))];
                  formattedData.push(uniqueValues);
                } 
                // 如果是按工作表名索引
                else if (nodeData.bySheetName) {
                  formattedData.push(data.map((row: Record<string, any>) => Object.values(row)[0]));
                }
              }

              updateIndexSourceNodeData(nodeData.id, {
                testResult: {
                  columns,
                  data: formattedData,
                },
                error: undefined,
              });
            } else {
              updateIndexSourceNodeData(nodeData.id, {
                testResult: undefined,
                error: "无结果数据",
              });
            }
          } else {
            updateIndexSourceNodeData(nodeData.id, {
              testResult: undefined,
              error: "无结果数据",
            });
          }
        },
        onError: (error) => {
          updateIndexSourceNodeData(nodeData.id, {
            testResult: undefined,
            error: `Pipeline测试失败: ${error.message}`,
          });
        },
      }
    );
  };

  return (
    <>
      <BaseNode
        data={nodeData}
        isSource={true}
        isTarget={false}
        onTestRun={testRun}
        testable
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
                      {headerRow?.column_names?.map((column) => (
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
      </BaseNode>
      
      {/* Pipeline测试按钮 */}
      {/* <Flex justify="center" mt="2">
        <Badge
          color="green"
          className="inline-block cursor-pointer"
          onClick={testPipelineRun}
          style={{ opacity: testPipelineNodeMutation.isLoading ? 0.6 : 1 }}
        >
          {testPipelineNodeMutation.isLoading ? "测试中..." : "Pipeline测试运行"}
        </Badge>
      </Flex> */}
    </>
  );
};
