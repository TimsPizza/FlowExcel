import { EnhancedBaseNode } from "@/components/flow/nodes/EnhancedBaseNode";
import { useNodeColumns } from "@/hooks/useNodeColumns";
import {
  usePreviewNodeMutation
} from "@/hooks/workspaceQueries";
import { convertPreviewToSheets, getPreviewMetadata } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FlowNodeProps, RowFilterNodeDataContext } from "@/types/nodes";
import { PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import {
  Badge,
  Button,
  Flex,
  Grid,
  IconButton,
  ScrollArea,
  Select,
  Text,
  TextField,
} from "@radix-ui/themes";
import { toast } from "react-toastify";
import { useNodeId } from "reactflow";

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
  const previewNodeMutation = usePreviewNodeMutation();

  // 使用真实的列数据
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

  const previewNode = async () => {
    console.log("test run row filter node");
    if (!currentWorkspace) {
      toast.error("未找到当前工作区");
      return;
    }

    if (!nodeData.conditions || nodeData.conditions.length === 0) {
      updateRowFilterNodeDataInStore(nodeId, {
        error: "请至少添加一个过滤条件",
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
          console.log("Preview result:", result);

          if (result.success) {
            const sheets = convertPreviewToSheets(result);

            console.log("Preview sheets:", sheets);

            updateRowFilterNodeDataInStore(nodeId, {
              testResult: sheets,
              error: undefined,
            });
          } else {
            updateRowFilterNodeDataInStore(nodeId, {
              error: result.error || "预览失败",
              testResult: undefined,
            });
          }
        },
        onError: (error: Error) => {
          console.error("Preview failed:", error);
          updateRowFilterNodeDataInStore(nodeId, {
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
                  value={condition.value || ""}
                  onChange={(e) =>
                    updateCondition(index, "value", e.target.value)
                  }
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
    </EnhancedBaseNode>
  );
};
