import { useCallback, useState } from "react";
import { FlowNodeProps, RowLookupNodeData } from "@/types/nodes";
import { BaseNode } from "./BaseNode";
import { Select, Flex, Text, Checkbox } from "@radix-ui/themes";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "react-toastify";
import { useNodeId, useReactFlow } from "reactflow";

export const RowLookupNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId();
  const { setNodes } = useReactFlow();
  const nodeData = data as RowLookupNodeData;
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [enableLookup, setEnableLookup] = useState<boolean>(
    !!nodeData.matchColumn,
  );

  const updateNodeData = useCallback(
    (updates: Partial<RowLookupNodeData>) => {
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

  const handleEnableLookup = (checked: boolean) => {
    setEnableLookup(checked);
    if (!checked) {
      updateNodeData({ matchColumn: undefined, error: undefined });
    }
  };

  const testRun = async () => {
    try {
      // 如果启用了查找但未选择列，则报错
      if (enableLookup && !nodeData.matchColumn) {
        updateNodeData({ error: "请选择查找匹配的列" });
        return;
      }

      // 模拟从上游节点获取的索引数据
      const mockIndex = "型号A";

      // 模拟从上游节点获取的sheet数据
      const mockSheetData = [
        { 型号: "型号A", 废料重量: 100, 类型: "废料" },
        { 型号: "型号B", 废料重量: 200, 类型: "废料" },
        { 型号: "型号A", 废料重量: 300, 类型: "原料" },
      ];

      let result;

      if (enableLookup && nodeData.matchColumn) {
        // 调用后端API测试行查找功能
        result = await invoke("test_row_lookup", {
          data: mockSheetData,
          indexValue: mockIndex,
          matchColumn: nodeData.matchColumn,
        });
      } else {
        // 如果未启用查找，则直接传递数据
        result = mockSheetData;
      }

      updateNodeData({ testResult: result, error: undefined });

      // 如果结果是空的，给出提示
      if (Array.isArray(result) && result.length === 0) {
        toast.info("未找到匹配的数据行");
      }
    } catch (error) {
      console.error("测试运行失败:", error);
      updateNodeData({ error: "测试运行失败" });
    }
  };

  return (
    <BaseNode data={nodeData} onTestRun={testRun}>
      <Flex direction="column" gap="2">
        <Flex align="center" gap="2">
          <Checkbox
            checked={enableLookup}
            onCheckedChange={handleEnableLookup}
          />
          <Text size="2">启用行查找/列匹配</Text>
        </Flex>

        {enableLookup && (
          <Flex align="center" gap="2">
            <Text size="1" weight="bold">
              匹配列:
            </Text>
            <Select.Root
              size="1"
              value={nodeData.matchColumn || ""}
              onValueChange={(value) =>
                updateNodeData({ matchColumn: value, error: undefined })
              }
            >
              <Select.Trigger placeholder="选择匹配的列" />
              <Select.Content>
                <Select.Group>
                  <Select.Label>选择列</Select.Label>
                  {availableColumns.map((col) => (
                    <Select.Item key={col} value={col}>
                      {col}
                    </Select.Item>
                  ))}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Flex>
        )}

        {enableLookup && (
          <Text size="1" color="gray">
            此节点将在表格中查找列 "{nodeData.matchColumn || "未选择"}"
            中与索引值匹配的所有行
          </Text>
        )}

        {!enableLookup && (
          <Text size="1" color="gray">
            此节点将直接传递所有数据行，不进行索引匹配
          </Text>
        )}
      </Flex>
    </BaseNode>
  );
};
