import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FlowNodeProps, RowFilterNodeDataContext, NodeType } from "@/types/nodes";
import { PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import {
  Button,
  Flex,
  Grid,
  IconButton,
  ScrollArea,
  Select,
  Text,
  TextField,
  Badge,
} from "@radix-ui/themes";
import { useState } from "react";
import { useNodeId } from "reactflow";
import { BaseNode } from "./BaseNode";
import { useNodeColumns } from "@/hooks/useNodeColumns";
import { useTestPipelineNodeMutation } from "@/hooks/workspaceQueries";
import { transformSingleNodeResults, PipelineNodeResult } from "@/lib/dataTransforms";
import { SimpleDataframe } from "@/types";
import { toast } from "react-toastify";

const OPERATORS = [
  { value: "==", label: "等于" },
  { value: "!=", label: "不等于" },
  { value: ">", label: "大于" },
  { value: ">=", label: "大于等于" },
  { value: "<", label: "小于" },
  { value: "<=", label: "小于等于" },
  { value: "contains", label: "包含" },
  { value: "not_contains", label: "不包含" },
];

export const RowFilterNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId()!;
  const nodeData = data as RowFilterNodeDataContext;
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const testPipelineNodeMutation = useTestPipelineNodeMutation();

  // 使用真实的列数据
  const { columns: availableColumns, isLoading: isLoadingColumns, error: columnsError } = useNodeColumns();

  const updateRowFilterNodeDataInStore = useWorkspaceStore(
    (state) => state.updateNodeData,
  );

  const updateCondition = (index: number, field: string, value: any) => {
    const updatedConditions = [...(nodeData.conditions || [])];
    updatedConditions[index] = { ...updatedConditions[index], [field]: value };
    updateRowFilterNodeDataInStore(nodeId, {
      conditions: updatedConditions as any,
      error: undefined,
      testResult: undefined,
    });
  };

  const addCondition = () => {
    const newCondition = {
      column: "",
      operator: "==",
      value: "",
      logic: "AND" as "AND" | "OR",
    };
    updateRowFilterNodeDataInStore(nodeId, {
      conditions: [...(nodeData.conditions || []), newCondition],
      error: undefined,
      testResult: undefined,
    });
  };

  const removeCondition = (index: number) => {
    const updatedConditions = [...(nodeData.conditions || [])];
    updatedConditions.splice(index, 1);
    updateRowFilterNodeDataInStore(nodeId, {
      conditions: updatedConditions,
      error: undefined,
      testResult: undefined,
    });
  };

  const testPipelineRun = async () => {
    if (!currentWorkspace) {
      toast.error("未找到当前工作区");
      return;
    }

    if (!nodeData.conditions?.length) {
      updateRowFilterNodeDataInStore(nodeId, {
        error: "请至少添加一个过滤条件",
        testResult: undefined,
      });
      return;
    }

    // 验证每个条件是否完整
    const incomplete = nodeData.conditions.some(
      (condition) => !condition.column || !condition.operator,
    );

    if (incomplete) {
      updateRowFilterNodeDataInStore(nodeId, { 
        error: "过滤条件不完整",
        testResult: undefined,
      });
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
            // 使用数据转换函数处理结果
            const transformed = transformSingleNodeResults(
              nodeData.id,
              NodeType.ROW_FILTER,
              nodeResults as PipelineNodeResult[]
            );

            if (transformed.error) {
              updateRowFilterNodeDataInStore(nodeId, {
                error: transformed.error,
                testResult: undefined,
              });
            } else {
              // 转换为SimpleDataframe格式
              const simpleDataframe: SimpleDataframe = Array.isArray(transformed.displayData) 
                ? { columns: [], data: [] }  // 如果是多sheet，转为空dataframe
                : transformed.displayData || { columns: [], data: [] };
              
              updateRowFilterNodeDataInStore(nodeId, {
                testResult: simpleDataframe,
                error: undefined,
              });
            }
          } else {
            updateRowFilterNodeDataInStore(nodeId, {
              error: "未获取到测试结果",
              testResult: undefined,
            });
          }
        },
        onError: (error: Error) => {
          updateRowFilterNodeDataInStore(nodeId, {
            error: `测试运行失败: ${error.message}`,
            testResult: undefined,
          });
        },
      },
    );
  };

  return (
    <BaseNode
      data={nodeData}
      onTestRun={testPipelineRun}
      isSource={true}
      isTarget={true}
      testable={true}
    >
      <ScrollArea className="react-flow__node-scrollable max-h-60">
        <Flex direction="column" gap="2">
          <Flex justify="between" align="center">
            <Text size="1" weight="bold">
              过滤条件
            </Text>
            <Button size="1" variant="soft" onClick={addCondition}>
              <PlusIcon /> 添加条件
            </Button>
          </Flex>

          {/* 列加载状态 */}
          {isLoadingColumns && (
            <Text size="1" color="gray">
              加载列名中...
            </Text>
          )}
          
          {columnsError && (
            <Text size="1" color="red">
              无法获取列名：{columnsError.message}
            </Text>
          )}

          {(!nodeData.conditions || nodeData.conditions.length === 0) && (
            <Text size="1" color="gray">
              请添加过滤条件以筛选数据
            </Text>
          )}

          {(nodeData.conditions || []).map((condition, index) => (
            <Flex key={index} direction="column" gap="1">
              {index > 0 && (
                <Select.Root
                  size="1"
                  value={condition.logic || "AND"}
                  onValueChange={(value) =>
                    updateCondition(index, "logic", value)
                  }
                >
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="AND">且 (AND)</Select.Item>
                    <Select.Item value="OR">或 (OR)</Select.Item>
                  </Select.Content>
                </Select.Root>
              )}

              <Grid columns="4" gap="1" align="center">
                {/* 列选择 */}
                <Select.Root
                  size="1"
                  value={condition.column || ""}
                  onValueChange={(value) => updateCondition(index, "column", value)}
                >
                  <Select.Trigger />
                  <Select.Content>
                    {availableColumns.map((column) => (
                      <Select.Item key={column} value={column}>
                        {column}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>

                {/* 操作符选择 */}
                <Select.Root
                  size="1"
                  value={condition.operator || "=="}
                  onValueChange={(value) => updateCondition(index, "operator", value)}
                >
                  <Select.Trigger />
                  <Select.Content>
                    {OPERATORS.map((op) => (
                      <Select.Item key={op.value} value={op.value}>
                        {op.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>

                {/* 值输入 */}
                <TextField.Root
                  size="1"
                  value={condition.value || ""}
                  onChange={(e) => updateCondition(index, "value", e.target.value)}
                  placeholder="值"
                />

                {/* 删除按钮 */}
                <IconButton
                  size="1"
                  variant="soft"
                  color="red"
                  onClick={() => removeCondition(index)}
                >
                  <TrashIcon />
                </IconButton>
              </Grid>
            </Flex>
          ))}

          {/* 状态指示 */}
          {nodeData.conditions && nodeData.conditions.length > 0 && (
            <Flex gap="1" wrap="wrap">
              <Badge color="blue" size="1">
                {nodeData.conditions.length} 个条件
              </Badge>
              {availableColumns.length > 0 && (
                <Badge color="green" size="1">
                  {availableColumns.length} 个可用列
                </Badge>
              )}
            </Flex>
          )}
        </Flex>
      </ScrollArea>
    </BaseNode>
  );
};
