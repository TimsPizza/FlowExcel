import { useNodeColumns } from "@/hooks/useNodeColumns";
import useI18nToast from "@/hooks/useI18nToast";
import { usePreviewNodeMutation } from "@/hooks/workspaceQueries";
import { convertPreviewToSheets, isAggregationPreview } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { AggregatorNodeDataContext, FlowNodeProps } from "@/types/nodes";
import { Flex, Select, Text, TextField } from "@radix-ui/themes";
import { useCallback, useMemo } from "react";
import { useNodeId } from "reactflow";
import { BadgeConfig, EnhancedBaseNode } from "./EnhancedBaseNode";
import { useTranslation } from "react-i18next";

export const AggregatorNode: React.FC<FlowNodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const toast = useI18nToast();
  const nodeId = useNodeId()!;
  const nodeData = data as AggregatorNodeDataContext;
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);

  const previewNodeMutation = usePreviewNodeMutation();

  const {
    columns: availableColumns,
    isLoading: isLoadingColumns,
    error: columnsError,
  } = useNodeColumns();

  const updateAggregatorNodeData = useWorkspaceStore(
    (state) => state.updateNodeData,
  );

  const AGGREGATION_METHODS = [
    { value: "sum", label: t("node.aggregatorNode.methods.sum") },
    { value: "avg", label: t("node.aggregatorNode.methods.avg") },
    { value: "count", label: t("node.aggregatorNode.methods.count") },
    { value: "min", label: t("node.aggregatorNode.methods.min") },
    { value: "max", label: t("node.aggregatorNode.methods.max") },
  ];

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
          AGGREGATION_METHODS.find((m) => m.value === nodeData.method)?.label ??
          t("node.aggregatorNode.methodPrefix"),
      });
    }

    return badges;
  }, [nodeData.statColumn, nodeData.method, t, AGGREGATION_METHODS]);

  const handleSelectColumn = (column: string) => {
    updateAggregatorNodeData(nodeId, {
      statColumn: column,
      error: undefined,
      testResult: undefined,
    },true);
  };

  const handleSelectMethod = (method: string) => {
    updateAggregatorNodeData(nodeId, {
      method: method as "sum" | "avg" | "count" | "min" | "max",
      error: undefined,
      testResult: undefined,
    },true);
  };

  const handleOutputAsChange = (value: string) => {
    updateAggregatorNodeData(nodeId, {
      outputAs: value,
      error: undefined,
      testResult: undefined,
    },true);
  };

  const previewNode = async () => {
    if (!currentWorkspace) {
      toast.error("node.common.noWorkspaceFound");
      return;
    }

    if (!nodeData.statColumn) {
      updateAggregatorNodeData(nodeId, {
        error: t("node.aggregatorNode.selectStatColumn"),
        testResult: undefined,
      });
      return;
    }

    if (!nodeData.method) {
      updateAggregatorNodeData(nodeId, {
        error: t("node.aggregatorNode.selectStatMethod"),
        testResult: undefined,
      });
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
          if (result.success) {
            if (isAggregationPreview(result)) {
              // 新API返回的聚合结果，直接使用预览数据
              const sheets = convertPreviewToSheets(result);

              updateAggregatorNodeData(nodeId, {
                testResult: sheets,
                error: undefined,
              });
            } else {
              // 通用处理，转换为SheetInfo格式
              const sheets = convertPreviewToSheets(result);
              updateAggregatorNodeData(nodeId, {
                testResult: sheets,
                error: undefined,
              });
            }
          } else {
            updateAggregatorNodeData(nodeId, {
              error: result.error || t("node.common.previewFailed"),
              testResult: undefined,
            });
          }
        },
        onError: (error: Error) => {
          updateAggregatorNodeData(nodeId, {
            error: t("node.common.previewFailedWithError", {
              error: error.message,
            }),
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
            {t("node.aggregatorNode.statColumn")}
          </Text>
          {isLoadingColumns ? (
            <Text size="1" color="gray">
              {t("node.aggregatorNode.loadingColumns")}
            </Text>
          ) : columnsError ? (
            <Text size="1" color="red">
              {t("node.aggregatorNode.columnsError", {
                message: columnsError.message,
              })}
            </Text>
          ) : availableColumns.length === 0 ? (
            <Text size="1" color="gray">
              {t("node.aggregatorNode.noColumnsFound")}
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
            {t("node.aggregatorNode.statMethod")}
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
            {t("node.aggregatorNode.outputColumnName")}
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
