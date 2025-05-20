import { useCallback, useState } from "react";
import { FlowNodeProps, RowLookupNodeData } from "@/types/nodes";
import { BaseNode } from "./BaseNode";
import { Select, Flex, Text, Checkbox, ScrollArea } from "@radix-ui/themes";
import { useNodeId, useReactFlow } from "reactflow";
import _ from "lodash";

export const RowLookupNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId();
  const { setNodes } = useReactFlow();
  const nodeData = data as RowLookupNodeData;
  // Mock available columns that would come from upstream nodes
  const [availableColumns] = useState<string[]>([
    "型号", "废料重量", "类型", "数量", "金额"
  ]);
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

  const handleEnableLookup = (checked: boolean) => {
    setEnableLookup(checked);
    if (!checked) {
      updateNodeData({ matchColumn: undefined, error: undefined });
    }
  };

  const handleSelectMatchColumn = (column: string) => {
    updateNodeData({ matchColumn: column, error: undefined });
  };

  const testRun = async () => {
    try {
      // 如果启用了查找但未选择列，则报错
      if (enableLookup && !nodeData.matchColumn) {
        updateNodeData({ error: "请选择查找匹配的列" });
        return;
      }

      // 模拟从上游节点获取的数据
      const mockIndexValues = ["型号A", "型号C"];
      
      // 模拟目标数据
      const mockTargetData = [
        { "型号": "型号A", "废料重量": 100, "类型": "废料", "数量": 2, "金额": 500 },
        { "型号": "型号B", "废料重量": 200, "类型": "废料", "数量": 1, "金额": 200 },
        { "型号": "型号A", "废料重量": 300, "类型": "原料", "数量": 3, "金额": 900 },
        { "型号": "型号C", "废料重量": 150, "类型": "原料", "数量": 1, "金额": 450 },
      ];

      let result;

      if (enableLookup && nodeData.matchColumn) {
        // 执行查找匹配
        result = mockTargetData.filter(row => 
          mockIndexValues.includes(row[nodeData.matchColumn as keyof typeof row] as string)
        );
      } else {
        // 如果未启用查找，则直接传递数据
        result = mockTargetData;
      }

      updateNodeData({ 
        testResult: {
          columns: Object.keys(mockTargetData[0]),
          data: result
        }, 
        error: undefined 
      });
    } catch (error) {
      console.error("测试运行失败:", error);
      updateNodeData({ error: "测试运行失败" });
    }
  };

  return (
    <BaseNode 
      data={nodeData} 
      onTestRun={testRun}
      isSource={false}
      isTarget={true}
      testable
    >
      <Flex direction="column" gap="2">
        <Flex align="center" gap="2">
          <Checkbox
            checked={enableLookup}
            onCheckedChange={handleEnableLookup}
          />
          <Text size="1">启用行查找/列匹配</Text>
        </Flex>

        {enableLookup && (
          <Flex align="center" gap="2">
            <Text size="1" weight="bold">
              匹配列:
            </Text>
            <Select.Root
              size="1"
              value={nodeData.matchColumn || ""}
              onValueChange={handleSelectMatchColumn}
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Group>
                  <ScrollArea className="max-h-60">
                    {availableColumns.map((col) => (
                      <Select.Item key={col} value={col}>
                        {col}
                      </Select.Item>
                    ))}
                  </ScrollArea>
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Flex>
        )}

        {enableLookup && nodeData.matchColumn && (
          <Text size="1" color="gray">
            此节点将在表格中查找列 "{nodeData.matchColumn}"
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
