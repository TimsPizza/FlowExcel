import { useCallback, useRef, useState } from "react";
import { FlowNodeProps, AggregatorNodeDataContext, NodeType } from "@/types/nodes";
import { BaseNode } from "./BaseNode";
import {
  Select,
  Flex,
  Text,
  TextArea,
  TextField,
  Badge,
} from "@radix-ui/themes";
import { useNodeId } from "reactflow";
import _ from "lodash";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useTestPipelineNodeMutation } from "@/hooks/workspaceQueries";
import { useNodeColumns } from "@/hooks/useNodeColumns";
import { transformSingleNodeResults, PipelineNodeResult, TransformedNodeResult } from "@/lib/dataTransforms";
import { toast } from "react-toastify";
import { SimpleDataframe } from "@/types";

const AGGREGATION_METHODS = [
  { value: "sum", label: "求和" },
  { value: "avg", label: "平均值" },
  { value: "count", label: "计数" },
  { value: "min", label: "最小值" },
  { value: "max", label: "最大值" },
];

export const AggregatorNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId();
  const nodeData = data as AggregatorNodeDataContext;
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const testPipelineNodeMutation = useTestPipelineNodeMutation();
  
  // 保存转换后的结果
  const [transformedResult, setTransformedResult] = useState<TransformedNodeResult | null>(null);

  // 使用真实的列数据
  const { columns: availableColumns, isLoading: isLoadingColumns, error: columnsError } = useNodeColumns();

  const updateAggregatorNodeDataInStore = useWorkspaceStore(
    (state) => state.updateNodeData,
  );

  const updateLocalNodeData = useCallback(
    (updates: Partial<AggregatorNodeDataContext>) => {
      if (nodeId && updateAggregatorNodeDataInStore) {
        updateAggregatorNodeDataInStore(nodeId, updates);
      } else {
        console.warn(
          "AggregatorNode: nodeId or updateFunction in store is not available.",
          {
            nodeId,
            hasUpdater: !!updateAggregatorNodeDataInStore,
          },
        );
      }
    },
    [nodeId, updateAggregatorNodeDataInStore],
  );

  const handleSelectColumn = (column: string) => {
    updateLocalNodeData({
      statColumn: column,
      error: undefined,
      testResult: undefined,
    });
  };

  const handleSelectMethod = (method: string) => {
    updateLocalNodeData({
      method: method as "sum" | "avg" | "count" | "min" | "max",
      error: undefined,
      testResult: undefined,
    });
  };

  const handleOutputAsChange = (value: string) => {
    updateLocalNodeData({
      outputAs: value,
      error: undefined,
      testResult: undefined,
    });
  };

  const testPipelineRun = async () => {
    if (!currentWorkspace) {
      toast.error("未找到当前工作区");
      return;
    }

    if (!nodeData.statColumn) {
      updateLocalNodeData({
        error: "请选择要统计的列",
        testResult: undefined,
      });
      return;
    }

    if (!nodeData.method) {
      updateLocalNodeData({ error: "请选择统计方法", testResult: undefined });
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
              NodeType.AGGREGATOR,
              nodeResults as PipelineNodeResult[]
            );

            setTransformedResult(transformed);

            if (transformed.error) {
              updateLocalNodeData({
                error: transformed.error,
                testResult: undefined,
              });
            } else {
              // 转换为SimpleDataframe格式
              const simpleDataframe: SimpleDataframe = Array.isArray(transformed.displayData) 
                ? { columns: [], data: [] }  // 如果是多sheet，转为空dataframe
                : transformed.displayData || { columns: [], data: [] };
              
              updateLocalNodeData({
                testResult: simpleDataframe,
                error: undefined,
              });
            }
          } else {
            updateLocalNodeData({
              error: "未获取到测试结果",
              testResult: undefined,
            });
          }
        },
        onError: (error: Error) => {
          updateLocalNodeData({
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
      <Flex direction="column" gap="2">
        {/* 列选择 */}
        <Flex direction="column" gap="1">
          <Text size="1" weight="medium">
            统计列
          </Text>
          {isLoadingColumns ? (
            <Text size="1" color="gray">
              加载列名中...
            </Text>
          ) : columnsError ? (
            <Text size="1" color="red">
              无法获取列名：{columnsError.message}
            </Text>
          ) : availableColumns.length === 0 ? (
            <Text size="1" color="gray">
              未找到可用列，请检查上游节点配置
            </Text>
          ) : (
            <Select.Root
              value={nodeData.statColumn || ""}
              onValueChange={handleSelectColumn}
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
          )}
        </Flex>

        {/* 统计方法选择 */}
        <Flex direction="column" gap="1">
          <Text size="1" weight="medium">
            统计方法
          </Text>
          <Select.Root
            value={nodeData.method || ""}
            onValueChange={handleSelectMethod}
          >
            <Select.Trigger />
            <Select.Content>
              {AGGREGATION_METHODS.map((method) => (
                <Select.Item key={method.value} value={method.value}>
                  {method.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>

        {/* 输出列名 */}
        <Flex direction="column" gap="1">
          <Text size="1" weight="medium">
            输出列名（可选）
          </Text>
          <TextField.Root
            value={nodeData.outputAs || ""}
            onChange={(e) => handleOutputAsChange(e.target.value)}
            placeholder={`${nodeData.method || "method"}_${nodeData.statColumn || "column"}`}
          />
        </Flex>

        {/* 状态指示 */}
        <Flex gap="1" align="center">
          {nodeData.statColumn && (
            <Badge color="green" size="1">
              列: {nodeData.statColumn}
            </Badge>
          )}
          {nodeData.method && (
            <Badge color="blue" size="1">
              方法: {AGGREGATION_METHODS.find(m => m.value === nodeData.method)?.label}
            </Badge>
          )}
        </Flex>
      </Flex>
    </BaseNode>
  );
};
