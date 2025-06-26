import {
  BadgeConfig,
  EnhancedBaseNode,
} from "@/components/flow/nodes/EnhancedBaseNode";
import { Button } from "@/components/ui/button";
import { useNodeColumns } from "@/hooks/useNodeColumns";
import useToast from "@/hooks/useToast";
import { usePreviewNodeMutation } from "@/hooks/workspaceQueries";
import { convertPreviewToSheets } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FlowNodeProps, RowFilterNodeDataContext } from "@/types/nodes";
import { PlusIcon, TrashIcon } from "@radix-ui/react-icons";

import {
  Flex,
  Grid,
  IconButton,
  ScrollArea,
  Select,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useMemo, useState } from "react";
import { useNodeId } from "reactflow";
import { useTranslation } from "react-i18next";

const getOperators = (t: any) => [
  { value: "==", label: t("flow.operators.equals") },
  { value: "!=", label: t("flow.operators.notEquals") },
  { value: ">", label: t("flow.operators.greaterThan") },
  { value: ">=", label: t("flow.operators.greaterThanOrEqual") },
  { value: "<", label: t("flow.operators.lessThan") },
  { value: "<=", label: t("flow.operators.lessThanOrEqual") },
  { value: "contains", label: t("flow.operators.contains") },
  { value: "not_contains", label: t("flow.operators.notContains") },
];

export const RowFilterNode: React.FC<FlowNodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const nodeId = useNodeId()!;
  const nodeData = data as RowFilterNodeDataContext;
  const OPERATORS = getOperators(t);
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const previewNodeMutation = usePreviewNodeMutation();
  const [condValue, setCondValue] = useState("");
  const {
    columns: availableColumns,
    isLoading: isLoadingColumns,
    error: columnsError,
  } = useNodeColumns();

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
    },true);
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
    },true);
  };

  const removeCondition = (index: number) => {
    const updatedConditions = [...(nodeData.conditions || [])];
    updatedConditions.splice(index, 1);
    updateRowFilterNodeDataInStore(nodeId, {
      conditions: updatedConditions,
      error: undefined,
      testResult: undefined,
    },true);
  };

  const handleCondValueChange = (index: number, field: string, value: any) => {
    setCondValue(value);
    updateCondition(index, field, value);
  };

  const previewNode = async () => {
    if (!currentWorkspace) {
      toast.error(t("workspace.no_workspace_loaded"));
      return;
    }

    if (!nodeData.conditions || nodeData.conditions.length === 0) {
      updateRowFilterNodeDataInStore(nodeId, {
        error: t("flow.validation.filter.noConditions"),
        testResult: undefined,
      });
      return;
    }

    // clear existing test result
    updateRowFilterNodeDataInStore(nodeId, {
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
            const sheets = convertPreviewToSheets(result);
            updateRowFilterNodeDataInStore(nodeId, {
              testResult: sheets,
              error: undefined,
            });
          } else {
            updateRowFilterNodeDataInStore(nodeId, {
              error: result.error || t("flow.previewFailed"),
              testResult: undefined,
            });
          }
        },
        onError: (error: Error) => {
          updateRowFilterNodeDataInStore(nodeId, {
            error: t("flow.previewFailedWithError", { error: error.message }),
            testResult: undefined,
          });
        },
      },
    );
  };

  const badges: BadgeConfig[] = useMemo(() => {
    return (
      nodeData.conditions?.map((condition) => ({
        label: `${condition.column} ${condition.operator} ${condition.value}`,
        color: `${condition.logic}` === "AND" ? "blue" : "green",
        variant: "soft",
      })) ?? []
    );
  }, [nodeData.conditions]);

  return (
    <EnhancedBaseNode
      data={nodeData}
      onTestRun={previewNode}
      isSource={true}
      isTarget={true}
      testable={true}
      badges={badges}
    >
      <ScrollArea className="react-flow__node-scrollable max-h-60">
        <Flex direction="column" gap="2">
          <Flex justify="between" align="center">
            <Text size="1" weight="bold">
              {t("flow.filterConditions")}
            </Text>
            <Button size="1" variant="soft" onClick={addCondition}>
              <PlusIcon /> {t("flow.addCondition")}
            </Button>
          </Flex>

          {/* 列加载状态 */}
          {isLoadingColumns && (
            <Text size="1" color="gray">
              {t("flow.loadingColumns")}
            </Text>
          )}

          {columnsError && (
            <Text size="1" color="red">
              {t("flow.columnsError", { message: columnsError.message })}
            </Text>
          )}

          {(!nodeData.conditions || nodeData.conditions.length === 0) && (
            <Text size="1" color="gray">
              {t("flow.addConditionsPrompt")}
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
                    <Select.Item value="AND">{t("flow.logicAnd")}</Select.Item>
                    <Select.Item value="OR">{t("flow.logicOr")}</Select.Item>
                  </Select.Content>
                </Select.Root>
              )}

              <Grid columns="4" gap="1" align="center">
                {/* 列选择 */}
                <Select.Root
                  size="1"
                  value={condition.column || ""}
                  onValueChange={(value) =>
                    updateCondition(index, "column", value)
                  }
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

                {/* 操作符选择 */}
                <Select.Root
                  size="1"
                  value={condition.operator || "=="}
                  onValueChange={(value) =>
                    updateCondition(index, "operator", value)
                  }
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
                  value={condValue || condition.value}
                  onChange={(e) =>
                    handleCondValueChange(index, "value", e.target.value)
                  }
                  placeholder={t("flow.valuePlaceholder")}
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
        </Flex>
      </ScrollArea>
    </EnhancedBaseNode>
  );
};
