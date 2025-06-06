import {
  BadgeConfig,
  EnhancedBaseNode,
} from "@/components/flow/nodes/EnhancedBaseNode";
import { useNodeColumns } from "@/hooks/useNodeColumns";
import { usePreviewNodeMutation } from "@/hooks/workspaceQueries";
import { convertPreviewToSheets } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FlowNodeProps, RowLookupNodeDataContext } from "@/types/nodes";
import { Flex, ScrollArea, Select, Text } from "@radix-ui/themes";
import { useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import { useNodeId } from "reactflow";

export const RowLookupNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId()!;
  const nodeData = data as RowLookupNodeDataContext;
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const previewNodeMutation = usePreviewNodeMutation();

  // 使用真实的列数据
  const {
    columns: availableColumns,
    isLoading: isLoadingColumns,
    error: columnsError,
  } = useNodeColumns();

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

  const handleSelectMatchColumn = (column: string) => {
    updateLocalNodeData({
      matchColumn: column,
      error: undefined,
      testResult: undefined,
    });
  };

  // 新的预览函数，使用新API
  const previewNode = async () => {
    if (!currentWorkspace) {
      toast.error("未找到当前工作区");
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
            const sheets = convertPreviewToSheets(result);

            updateLocalNodeData({
              testResult: sheets,
              error: undefined,
            });
          } else {
            updateLocalNodeData({
              error: result.error || "预览失败",
              testResult: undefined,
            });
          }
        },
        onError: (error: Error) => {
          updateLocalNodeData({
            error: `预览失败: ${error.message}`,
            testResult: undefined,
          });
        },
      },
    );
  };

  const badges: BadgeConfig[] = useMemo(() => {
    const badges: BadgeConfig[] = [];
    if (nodeData.matchColumn) {
      badges.push({
        color: "green",
        variant: "soft",
        label: "匹配列: " + nodeData.matchColumn,
      });
    }
    return badges;
  }, [nodeData.matchColumn]);

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
                  {availableColumns.map((col: string) => (
                    <Select.Item key={col} value={col}>
                      {col}
                    </Select.Item>
                  ))}
                </ScrollArea>
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </Flex>

        {!!nodeData.matchColumn && (
          <Text size="1" color="gray">
            此节点将在表格中查找列 "{nodeData.matchColumn}"
            中与索引值匹配的所有行
          </Text>
        )}
      </Flex>
    </EnhancedBaseNode>
  );
};
