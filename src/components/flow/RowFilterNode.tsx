import { useCallback, useState } from "react";
import { FlowNodeProps, RowFilterNodeData } from "@/types/nodes";
import { BaseNode } from "./BaseNode";
import {
  Select,
  Flex,
  TextField,
  Button,
  Text,
  IconButton,
} from "@radix-ui/themes";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "react-toastify";
import { useNodeId, useReactFlow } from "reactflow";
import { PlusIcon, TrashIcon } from "@radix-ui/react-icons";

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
  const nodeId = useNodeId();
  const { setNodes } = useReactFlow();
  const nodeData = data as RowFilterNodeData;
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);

  const updateNodeData = useCallback(
    (updates: Partial<RowFilterNodeData>) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...updates,
              },
            };
          }
          return node;
        }),
      );
    },
    [nodeId, setNodes],
  );

  const updateCondition = (index: number, field: string, value: any) => {
    const updatedConditions = [...nodeData.conditions];
    updatedConditions[index] = { ...updatedConditions[index], [field]: value };
    updateNodeData({ conditions: updatedConditions, error: undefined });
  };

  const addCondition = () => {
    const newCondition = {
      column: "",
      operator: "==",
      value: "",
      logic: "AND",
    };
    updateNodeData({
      conditions: [...(nodeData.conditions || []), newCondition],
      error: undefined,
    });
  };

  const removeCondition = (index: number) => {
    const updatedConditions = [...nodeData.conditions];
    updatedConditions.splice(index, 1);
    updateNodeData({ conditions: updatedConditions, error: undefined });
  };

  const testRun = async () => {
    try {
      if (!nodeData.conditions?.length) {
        updateNodeData({ error: "请至少添加一个过滤条件" });
        return;
      }

      // 验证每个条件是否完整
      const incomplete = nodeData.conditions.some(
        (condition) => !condition.column || !condition.operator,
      );

      if (incomplete) {
        updateNodeData({ error: "过滤条件不完整" });
        return;
      }

      // 模拟从上游节点获取的数据
      const mockData = [
        { 型号: "A型", 废料重量: 100, 类型: "废料" },
        { 型号: "B型", 废料重量: 0, 类型: "废料" },
        { 型号: "C型", 废料重量: 200, 类型: "原料" },
      ];

      // 调用后端API测试过滤功能
      const result = await invoke("test_row_filter", {
        data: mockData,
        conditions: nodeData.conditions,
      });

      updateNodeData({ testResult: result, error: undefined });

      // 如果结果是空的，给出提示
      if (Array.isArray(result) && result.length === 0) {
        toast.info("过滤后没有数据满足条件");
      }
    } catch (error) {
      console.error("测试运行失败:", error);
      updateNodeData({ error: "测试运行失败" });
    }
  };

  // 获取可用列名（假设是从上游节点传递）
  const fetchAvailableColumns = async () => {
    try {
      // 实际项目中，应该从上游节点获取或后端获取
      const columns = ["型号", "废料重量", "类型"];
      setAvailableColumns(columns);
    } catch (error) {
      console.error("获取列名失败:", error);
    }
  };

  // 组件挂载时调用
  useCallback(() => {
    fetchAvailableColumns();
  }, []);

  return (
    <BaseNode data={nodeData} onTestRun={testRun}>
      <Flex direction="column" gap="2">
        <Flex justify="between" align="center">
          <Text size="2" weight="bold">
            过滤条件
          </Text>
          <Button size="1" variant="soft" onClick={addCondition}>
            <PlusIcon /> 添加条件
          </Button>
        </Flex>

        {(nodeData.conditions || []).length === 0 && (
          <Text size="1" color="gray">
            请添加过滤条件以筛选数据
          </Text>
        )}

        {(nodeData.conditions || []).map((condition, index) => (
          <Flex key={index} direction="column" gap="1">
            {index > 0 && (
              <Flex align="center" p="1">
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
              </Flex>
            )}

            <Flex align="center" gap="1">
              <Select.Root
                size="1"
                value={condition.column}
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
                value={condition.operator}
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

              <TextField.Root
                size="1"
                placeholder="值"
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
    </BaseNode>
  );
};
