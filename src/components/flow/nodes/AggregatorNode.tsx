import { useNodeColumns } from "@/hooks/useNodeColumns";
import useToast from "@/hooks/useToast";
import { usePreviewNodeMutation } from "@/hooks/workspaceQueries";
import { convertPreviewToSheets, isAggregationPreview } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { AggregatorNodeDataContext, FlowNodeProps } from "@/types/nodes";
import { Flex, Select, Text, TextField } from "@radix-ui/themes";
import { useCallback, useMemo } from "react";
import { useNodeId } from "reactflow";
import { BadgeConfig, EnhancedBaseNode } from "./EnhancedBaseNode";

const AGGREGATION_METHODS = [
  { value: "sum", label: "求和" },
  { value: "avg", label: "平均值" },
  { value: "count", label: "计数" },
  { value: "min", label: "最小值" },
  { value: "max", label: "最大值" },
];

export const AggregatorNode: React.FC<FlowNodeProps> = ({ data }) => {
  const toast = useToast();
  const nodeId = useNodeId();
  const nodeData = data as AggregatorNodeDataContext;
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);

  // 使用新的预览API作为主要方法
  const previewNodeMutation = usePreviewNodeMutation();

  // 使用真实的列数据
  const {
    columns: availableColumns,
    isLoading: isLoadingColumns,
    error: columnsError,
  } = useNodeColumns();

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

  const badges: BadgeConfig[] = useMemo(() => {
    const badges: BadgeConfig[] = [];
    if (nodeData.statColumn) {
      badges.push({
        color: "green",
        variant: "soft",
        label: nodeData.statColumn,
      });
    }

    if (nodeData.method) {
      badges.push({
        color: "blue",
        variant: "soft",
        label:
          "方法: " +
          AGGREGATION_METHODS.find((m) => m.value === nodeData.method)?.label,
      });
    }

    return badges;
  }, [nodeData.statColumn, nodeData.method]);

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

  // 新的预览函数，使用新API
  const previewNode = async () => {
    console.log("test run aggregator node");
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

    previewNodeMutation.mutate(
      {
        nodeId: nodeData.id,
        testModeMaxRows: 100,
        workspaceConfig: currentWorkspace || undefined,
      },
      {
        onSuccess: (result) => {
          console.log("Preview result:", result);

          if (result.success) {
            if (isAggregationPreview(result)) {
              // 新API返回的聚合结果，直接使用预览数据
              const sheets = convertPreviewToSheets(result);

              console.log("Aggregation results:", result.aggregation_results);
              console.log("Preview sheets:", sheets);

              updateLocalNodeData({
                testResult: sheets,
                error: undefined,
              });
            } else {
              // 通用处理，转换为SheetInfo格式
              const sheets = convertPreviewToSheets(result);
              updateLocalNodeData({
                testResult: sheets,
                error: undefined,
              });
            }
          } else {
            updateLocalNodeData({
              error: result.error || "预览失败",
              testResult: undefined,
            });
          }
        },
        onError: (error: Error) => {
          console.error("Preview failed:", error);
          updateLocalNodeData({
            error: `预览失败: ${error.message}`,
            testResult: undefined,
          });
        },
      },
    );
  };

  return (
    <EnhancedBaseNode
      data={nodeData}
      onTestRun={previewNode}
      isSource={true}
      isTarget={true}
      testable={true}
      badges={badges}
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
                {availableColumns.map((column: string) => (
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
      </Flex>
    </EnhancedBaseNode>
  );
};
