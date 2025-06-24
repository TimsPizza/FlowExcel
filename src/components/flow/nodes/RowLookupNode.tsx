import {
  BadgeConfig,
  EnhancedBaseNode,
} from "@/components/flow/nodes/EnhancedBaseNode";
import { useNodeColumns } from "@/hooks/useNodeColumns";
import useI18nToast from "@/hooks/useI18nToast";
import { usePreviewNodeMutation } from "@/hooks/workspaceQueries";
import { convertPreviewToSheets } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FlowNodeProps, RowLookupNodeDataContext } from "@/types/nodes";
import { Flex, ScrollArea, Select, Text } from "@radix-ui/themes";
import { useCallback, useMemo } from "react";
import { useNodeId } from "reactflow";
import { useTranslation } from "react-i18next";

export const RowLookupNode: React.FC<FlowNodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const toast = useI18nToast();
  const nodeId = useNodeId()!;
  const nodeData = data as RowLookupNodeDataContext;
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const previewNodeMutation = usePreviewNodeMutation();

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

  const previewNode = async () => {
    if (!currentWorkspace) {
      toast.error("node.common.noWorkspaceFound");
      return;
    }
    // clear existing test result
    updateLocalNodeData({
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

            updateLocalNodeData({
              testResult: sheets,
              error: undefined,
            });
          } else {
            updateLocalNodeData({
              error: result.error || t("node.common.previewFailed"),
              testResult: undefined,
            });
          }
        },
        onError: (error: Error) => {
          updateLocalNodeData({
            error: t("node.common.previewFailedWithError", {
              error: error.message,
            }),
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
        label: nodeData.matchColumn,
      });
    }
    return badges;
  }, [nodeData.matchColumn, t]);

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
            {t("node.rowLookupNode.loadingColumns")}
          </Text>
        )}

        {columnsError && (
          <Text size="1" color="red">
            {t("node.rowLookupNode.columnsError", {
              message: columnsError.message,
            })}
          </Text>
        )}

        <Flex align="center" gap="2">
          <Text size="1" weight="bold">
            {t("node.rowLookupNode.matchColumn")}
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
            {t("node.rowLookupNode.description", {
              column: nodeData.matchColumn,
            })}
          </Text>
        )}
      </Flex>
    </EnhancedBaseNode>
  );
};
