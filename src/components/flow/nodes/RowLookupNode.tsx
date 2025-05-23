import { useCallback, useState } from "react";
import { FlowNodeProps, RowLookupNodeDataContext, NodeType } from "@/types/nodes";
import { BaseNode } from "./BaseNode";
import { Select, Flex, Text, Checkbox, ScrollArea, Badge } from "@radix-ui/themes";
import { useNodeId } from "reactflow";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useTestPipelineNodeMutation } from "@/hooks/workspaceQueries";
import { useNodeColumns } from "@/hooks/useNodeColumns";
import { transformSingleNodeResults, PipelineNodeResult } from "@/lib/dataTransforms";
import { SimpleDataframe } from "@/types";
import { toast } from "react-toastify";

export const RowLookupNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId()!;
  const nodeData = data as RowLookupNodeDataContext;
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const testPipelineMutation = useTestPipelineNodeMutation();
  
  // 使用真实的列数据
  const { columns: availableColumns, isLoading: isLoadingColumns, error: columnsError } = useNodeColumns();
  
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
      updateLocalNodeData({
        matchColumn: undefined,
        error: undefined,
        testResult: undefined,
      });
    } else {
      updateLocalNodeData({ error: undefined, testResult: undefined });
    }
  };

  const handleSelectMatchColumn = (column: string) => {
    updateLocalNodeData({
      matchColumn: column,
      error: undefined,
      testResult: undefined,
    });
  };

  const testPipelineRun = async () => {
    if (!currentWorkspace) {
      toast.error("未找到当前工作区");
      return;
    }

    testPipelineMutation.mutate(
      { workspaceId: currentWorkspace.id, nodeId },
      {
        onSuccess: (result) => {
          const nodeResults = result.results[nodeData.id];
          if (nodeResults && nodeResults.length > 0) {
            // 使用数据转换函数处理结果
            const transformed = transformSingleNodeResults(
              nodeData.id,
              NodeType.ROW_LOOKUP,
              nodeResults as PipelineNodeResult[]
            );

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
        onError: (error) => {
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
        <Flex align="center" gap="2">
          <Checkbox
            checked={enableLookup}
            onCheckedChange={handleEnableLookup}
          />
          <Text size="1">启用行查找/列匹配</Text>
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

        {/* 状态指示 */}
        <Flex gap="1" wrap="wrap">
          {enableLookup && (
            <Badge color="blue" size="1">
              查找模式
            </Badge>
          )}
          {!enableLookup && (
            <Badge color="gray" size="1">
              透传模式
            </Badge>
          )}
          {nodeData.matchColumn && (
            <Badge color="green" size="1">
              匹配列: {nodeData.matchColumn}
            </Badge>
          )}
          {availableColumns.length > 0 && (
            <Badge color="orange" size="1">
              {availableColumns.length} 个可用列
            </Badge>
          )}
        </Flex>
      </Flex>
    </BaseNode>
  );
};
