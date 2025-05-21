import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FlowNodeProps, RowFilterNodeDataContext } from "@/types/nodes";
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
} from "@radix-ui/themes";
import { useState } from "react";
import { useNodeId } from "reactflow";
import { BaseNode } from "./BaseNode";

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
  const [availableColumns, setAvailableColumns] = useState<string[]>([
    "型号",
    "废料重量",
    "类型",
    "数量",
    "时间",
  ]);

  const updateRowFilterNodeDataInStore = useWorkspaceStore(
    (state) => state.updateNodeData,
  );

  const updateCondition = (index: number, field: string, value: any) => {
    const updatedConditions = [...(nodeData.conditions || [])];
    updatedConditions[index] = { ...updatedConditions[index], [field]: value };
    updateRowFilterNodeDataInStore(nodeId, {
      conditions: updatedConditions,
      error: undefined,
    });
  };

  const addCondition = () => {
    const newCondition = {
      column: "",
      operator: "==",
      value: "",
      logic: "AND",
    };
    updateRowFilterNodeDataInStore(nodeId, {
      conditions: [...(nodeData.conditions || []), newCondition],
      error: undefined,
    });
  };

  const removeCondition = (index: number) => {
    const updatedConditions = [...(nodeData.conditions || [])];
    updatedConditions.splice(index, 1);
    updateRowFilterNodeDataInStore(nodeId, {
      conditions: updatedConditions,
      error: undefined,
    });
  };

  const testRun = async () => {
    try {
      if (!nodeData.conditions?.length) {
        updateRowFilterNodeDataInStore(nodeId, {
          error: "请至少添加一个过滤条件",
        });
        return;
      }

      // 验证每个条件是否完整
      const incomplete = nodeData.conditions.some(
        (condition) => !condition.column || !condition.operator,
      );

      if (incomplete) {
        updateRowFilterNodeDataInStore(nodeId, { error: "过滤条件不完整" });
        return;
      }

      // 模拟从上游节点获取的数据
      const mockData = [
        { 型号: "A型", 废料重量: 100, 类型: "废料" },
        { 型号: "B型", 废料重量: 0, 类型: "废料" },
        { 型号: "C型", 废料重量: 200, 类型: "原料" },
      ];

      // 应用过滤逻辑
      const filteredData = mockData.filter((row) => {
        return nodeData.conditions.every((condition, idx) => {
          const { column, operator, value, logic } = condition;
          const rowValue = row[column];

          let matches = false;
          switch (operator) {
            case "==":
              matches = rowValue == value;
              break;
            case "!=":
              matches = rowValue != value;
              break;
            case ">":
              matches = rowValue > value;
              break;
            case ">=":
              matches = rowValue >= value;
              break;
            case "<":
              matches = rowValue < value;
              break;
            case "<=":
              matches = rowValue <= value;
              break;
            case "contains":
              matches = String(rowValue).includes(String(value));
              break;
            case "not_contains":
              matches = !String(rowValue).includes(String(value));
              break;
            default:
              matches = false;
          }

          // Apply logic (AND/OR)
          if (idx > 0 && logic === "OR") {
            return matches;
          }
          return matches;
        });
      });

      updateRowFilterNodeDataInStore(nodeId, {
        testResult: {
          columns: Object.keys(mockData[0]),
          data: filteredData,
        },
        error: undefined,
      });
    } catch (error) {
      console.error("测试运行失败:", error);
      updateRowFilterNodeDataInStore(nodeId, { error: "测试运行失败" });
    }
  };

  return (
    <BaseNode
      data={nodeData}
      onTestRun={testRun}
      isSource={true}
      isTarget={true}
      testable
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

              <Grid columns="2" gap="1">
                <Select.Root
                  size="1"
                  value={condition.column || ""}
                  onValueChange={(value) =>
                    updateCondition(index, "column", value)
                  }
                >
                  <Select.Trigger placeholder="选择列" />
                  <Select.Content>
                    <Select.Group>
                      {availableColumns.map((col) => (
                        <Select.Item key={col} value={col}>
                          {col}
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Content>
                </Select.Root>

                <Select.Root
                  size="1"
                  value={condition.operator || "=="}
                  onValueChange={(value) =>
                    updateCondition(index, "operator", value)
                  }
                >
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Group>
                      {OPERATORS.map((op) => (
                        <Select.Item key={op.value} value={op.value}>
                          {op.label}
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </Grid>

              <Flex gap="1">
                <TextField.Root
                  size="1"
                  placeholder="值"
                  style={{ flex: 1 }}
                  value={condition.value?.toString() || ""}
                  onChange={(e) =>
                    updateCondition(index, "value", e.target.value)
                  }
                />

                <IconButton
                  size="1"
                  variant="soft"
                  color="red"
                  onClick={() => removeCondition(index)}
                >
                  <TrashIcon />
                </IconButton>
              </Flex>
            </Flex>
          ))}
        </Flex>
      </ScrollArea>
    </BaseNode>
  );
};
