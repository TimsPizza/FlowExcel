import { useCallback, useState } from "react";
import { FlowNodeProps, RowLookupNodeDataContext } from "@/types/nodes";
import { BaseNode } from "./BaseNode";
import { Select, Flex, Text, Checkbox, ScrollArea } from "@radix-ui/themes";
import { useNodeId } from "reactflow";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export const RowLookupNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId();
  const nodeData = data as RowLookupNodeDataContext;
  const [availableColumns] = useState<string[]>([
    "型号", "废料重量", "类型", "数量", "金额"
  ]);
  const [enableLookup, setEnableLookup] = useState<boolean>(
    !!nodeData.matchColumn,
  );

  const updateRowLookupNodeDataInStore = useWorkspaceStore(
    (state) => state.updateNodeData,
  );

  const updateLocalNodeData = useCallback(
    (updates: Partial<RowLookupNodeDataContext>) => {
      if (nodeId && updateRowLookupNodeDataInStore) {
        updateRowLookupNodeDataInStore(nodeId, updates);
      } else {
        console.warn(
          "RowLookupNode: nodeId or updateFunction in store is not available.",
          {
            nodeId,
            hasUpdater: !!updateRowLookupNodeDataInStore,
          },
        );
      }
    },
    [nodeId, updateRowLookupNodeDataInStore],
  );

  const handleEnableLookup = (checked: boolean | "indeterminate") => {
    const isChecked = checked === true;
    setEnableLookup(isChecked);
    if (!isChecked) {
      updateLocalNodeData({ matchColumn: undefined, error: undefined, testResult: undefined });
    } else {
      updateLocalNodeData({ error: undefined, testResult: undefined }); 
    }
  };

  const handleSelectMatchColumn = (column: string) => {
    updateLocalNodeData({ matchColumn: column, error: undefined, testResult: undefined });
  };

  const testRun = async () => {
    try {
      if (enableLookup && !nodeData.matchColumn) {
        updateLocalNodeData({ error: "请选择查找匹配的列", testResult: undefined });
        return;
      }

      const mockIndexValues = ["型号A", "型号C"];
      const mockTargetData = [
        { "型号": "型号A", "废料重量": 100, "类型": "废料", "数量": 2, "金额": 500 },
        { "型号": "型号B", "废料重量": 200, "类型": "废料", "数量": 1, "金额": 200 },
        { "型号": "型号A", "废料重量": 300, "类型": "原料", "数量": 3, "金额": 900 },
        { "型号": "型号C", "废料重量": 150, "类型": "原料", "数量": 1, "金额": 450 },
      ];

      let result;
      if (enableLookup && nodeData.matchColumn) {
        result = mockTargetData.filter(row => 
          mockIndexValues.includes(row[nodeData.matchColumn as keyof typeof row] as string)
        );
      } else {
        result = mockTargetData;
      }

      updateLocalNodeData({ 
        testResult: {
          columns: mockTargetData.length > 0 ? Object.keys(mockTargetData[0]) : [],
          data: result
        }, 
        error: undefined 
      });
    } catch (error) {
      console.error("测试运行失败:", error);
      updateLocalNodeData({ error: "测试运行失败", testResult: undefined });
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
