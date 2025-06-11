import {
  BadgeConfig,
  EnhancedBaseNode,
} from "@/components/flow/nodes/EnhancedBaseNode";
import useToast from "@/hooks/useToast";
import { usePreviewNodeMutation } from "@/hooks/workspaceQueries";
import { convertPreviewToSheets } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FlowNodeProps, OutputNodeDataContext } from "@/types/nodes";
import { FileIcon } from "@radix-ui/react-icons";
import { Flex, Text, TextField } from "@radix-ui/themes";
import { useCallback, useMemo } from "react";
import { useNodeId } from "reactflow";
import { Button } from "@/components/ui/button";

import { useShallow } from "zustand/react/shallow";

export const OutputNode: React.FC<FlowNodeProps> = ({ data }) => {
  const toast = useToast();
  const nodeId = useNodeId()!;
  const nodeData = data as OutputNodeDataContext;

  // 使用新的预览API作为主要方法
  const previewNodeMutation = usePreviewNodeMutation();

  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const updateOutputNodeDataInStore = useWorkspaceStore(
    (state) => state.updateNodeData,
  );

  // 获取连接到当前节点的边数
  const { flow_edges } = useWorkspaceStore(
    useShallow((state) => ({
      flow_edges: state.currentWorkspace?.flow_edges || [],
    })),
  );
  const connectedEdgesCount = flow_edges.filter(
    (edge) => edge.target === nodeId,
  ).length;

  const updateLocalNodeData = useCallback(
    (updates: Partial<OutputNodeDataContext>) => {
      if (nodeId && updateOutputNodeDataInStore) {
        updateOutputNodeDataInStore(nodeId, updates);
      } else {
        console.warn(
          "OutputNode: nodeId or updateFunction in store is not available.",
          {
            nodeId,
            hasUpdater: !!updateOutputNodeDataInStore,
          },
        );
      }
    },
    [nodeId, updateOutputNodeDataInStore],
  );

  const handleOutputPathChange = (path: string) => {
    updateLocalNodeData({
      outputPath: path,
      error: undefined,
      testResult: undefined,
    });
  };

  const handleSelectOutputPath = async () => {
    try {
      // 使用Tauri的文件对话框选择保存路径
      const { save } = await import("@tauri-apps/plugin-dialog");

      const filePath = await save({
        defaultPath: "output.xlsx",
        filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
      });

      if (filePath) {
        handleOutputPathChange(filePath);
      }
    } catch (error) {
      console.error("选择文件路径失败:", error);
      toast.error("选择文件路径失败");
    }
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
            // 转换预览结果为SheetInfo格式
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
    return [
      {
        label: "格式: Excel",
        color: "green",
        variant: "soft",
      },
      {
        label: `保存路径: ${nodeData.outputPath?.split("/").pop() || "未设置"}`,
        color: nodeData.outputPath ? "blue" : "gray",
        variant: "soft",
      },
      {
        label: `工作表数: ${connectedEdgesCount}`,
        color: connectedEdgesCount > 0 ? "orange" : "gray",
        variant: "soft",
      },
    ];
  }, [nodeData.outputPath, connectedEdgesCount]);

  return (
    <EnhancedBaseNode
      data={nodeData}
      onTestRun={previewNode}
      isSource={false}
      isTarget={true}
      testable={true}
      badges={badges}
    >
      <Flex direction="column" gap="3">
        {/* 输出格式信息（只读显示） */}
        <Flex align="center" gap="2">
          <Text size="1" weight="bold">
            输出格式:
          </Text>
          <Text size="1" color="green" weight="medium">
            Excel (.xlsx)
          </Text>
        </Flex>

        {/* 输出路径选择 */}
        <Flex direction="column" gap="1">
          <Text size="1" weight="medium">
            保存路径
          </Text>
          <Flex gap="1">
            <TextField.Root
              value={nodeData.outputPath || ""}
              onChange={(e) => handleOutputPathChange(e.target.value)}
              placeholder="选择 Excel 文件保存路径..."
              style={{ flex: 1 }}
            />
            <Button size="1" variant="soft" onClick={handleSelectOutputPath}>
              <FileIcon />
            </Button>
          </Flex>
        </Flex>
      </Flex>
    </EnhancedBaseNode>
  );
};
