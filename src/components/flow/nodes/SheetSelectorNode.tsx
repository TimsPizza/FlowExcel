import { EnhancedBaseNode } from "@/components/flow/nodes/EnhancedBaseNode";
import {
  usePreviewNodeMutation,
  useTestPipelineNodeMutation,
} from "@/hooks/workspaceQueries";
import {
  convertPreviewToSheets,
  getPreviewMetadata
} from "@/lib/utils";
import { fileSelector, useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { SheetInfo } from "@/types";
import { FlowNodeProps, SheetSelectorNodeDataContext } from "@/types/nodes";
import { Button, Flex, RadioGroup, Select, Text } from "@radix-ui/themes";
import { useNodeId } from "reactflow";
import { useShallow } from "zustand/react/shallow";

export const SheetSelectorNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId()!;
  const nodeData = data as SheetSelectorNodeDataContext;
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const { files } = useWorkspaceStore(useShallow(fileSelector));
  const testPipelineNodeMutation = useTestPipelineNodeMutation();
  const previewNodeMutation = usePreviewNodeMutation();
  const updateSheetSelectorNodeData = useWorkspaceStore(
    (state) => state.updateNodeData,
  );

  const handleSelectFile = async (fileId: string) => {
    try {
      updateSheetSelectorNodeData(nodeId, {
        targetFileID: fileId,
        error: undefined,
      });

      // Reset manual sheet name if file changed
      if (nodeData.mode === "manual" && nodeData.manualSheetName) {
        updateSheetSelectorNodeData(nodeId, { manualSheetName: undefined });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSheetModeChange = (mode: "auto_by_index" | "manual") => {
    updateSheetSelectorNodeData(nodeId, {
      mode,
      manualSheetName: undefined, // Reset when changing mode
      error: undefined,
    });
  };

  const handleSelectSheet = (sheetName: string) => {
    updateSheetSelectorNodeData(nodeId, {
      manualSheetName: sheetName,
      error: undefined,
    });
  };

  const previewNode = async () => {
    console.log("test run sheet selector node");
    try {
      // Validate required fields
      if (!nodeData.targetFileID) {
        updateSheetSelectorNodeData(nodeId, { error: "请选择目标Excel文件" });
        return;
      }

      if (nodeData.mode === "manual" && !nodeData.manualSheetName) {
        updateSheetSelectorNodeData(nodeId, {
          error: "请选择手动指定的sheet名称",
        });
        return;
      }

      previewNodeMutation.mutate(
        {
          workspaceId: currentWorkspace?.id || "",
          nodeId: nodeData.id,
          testModeMaxRows: 50,
        },
        {
          onSuccess: (result) => {
            console.log("previewNode result", result);

            if (result.success) {
              const sheets = convertPreviewToSheets(result);
              const metadata = getPreviewMetadata(result);

              console.log("Preview sheets:", sheets);
              console.log("Preview metadata:", metadata);

              updateSheetSelectorNodeData(nodeId, {
                testResult: sheets,
                error: undefined,
              });
            } else {
              updateSheetSelectorNodeData(nodeId, {
                error: result.error || "预览失败",
              });
            }
          },
          onError: (error) => {
            console.error("预览失败:", error);
            updateSheetSelectorNodeData(nodeId, {
              error: `预览失败: ${error.message}`,
            });
          },
        },
      );
    } catch (error) {
      console.error("预览运行失败:", error);
      updateSheetSelectorNodeData(nodeId, { error: "预览运行失败" });
    }
  };

  const testRun = async () => {
    try {
      // Validate required fields
      if (!nodeData.targetFileID) {
        updateSheetSelectorNodeData(nodeId, { error: "请选择目标Excel文件" });
        return;
      }

      if (nodeData.mode === "manual" && !nodeData.manualSheetName) {
        updateSheetSelectorNodeData(nodeId, {
          error: "请选择手动指定的sheet名称",
        });
        return;
      }

      testPipelineNodeMutation.mutate(
        {
          workspaceId: currentWorkspace?.id || "",
          nodeId: nodeData.id,
        },
        {
          onSuccess: (result) => {
            console.log("testPipelineNode result", result);
            // @ts-ignore
            const resultsData = result.results[nodeData.id];
            let sheets: SheetInfo[] = [];
            for (const result of resultsData) {
              sheets.push({
                sheet_name: result.index_value,
                data: result.result_data.data,
                columns: result.result_data.columns,
              });
            }
            console.log("transformed sheets", sheets);
            updateSheetSelectorNodeData(nodeId, {
              testResult: sheets,
              error: undefined,
            });
          },
        },
      );
    } catch (error) {
      console.error("测试运行失败:", error);
      updateSheetSelectorNodeData(nodeId, { error: "测试运行失败" });
    }
  };

  return (
    <EnhancedBaseNode
      data={nodeData}
      isSource={true}
      isTarget={true}
      onTestRun={previewNode}
      testable
    >
      <Flex direction="column" gap="2">
        <Flex align="center" gap="2">
          <Text size="1" weight="bold">
            目标文件:
          </Text>
          <Select.Root
            value={nodeData.targetFileID || ""}
            onValueChange={(v) => handleSelectFile(v)}
          >
            <Select.Trigger />
            <Select.Content>
              <Select.Group>
                {files && files.length > 0 ? (
                  files.map((file) => (
                    <Select.Item value={file.id} key={file.id}>
                      {file.name}
                    </Select.Item>
                  ))
                ) : (
                  <Text size="1">暂无文件</Text>
                )}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </Flex>

        <Flex direction="column" gap="1">
          <Text size="1" weight="bold">
            Sheet定位模式:
          </Text>
          <RadioGroup.Root
            value={nodeData.mode || "auto_by_index"}
            onValueChange={(value) =>
              handleSheetModeChange(value as "auto_by_index" | "manual")
            }
          >
            <Flex direction="column" gap="1">
              <RadioGroup.Item value="auto_by_index">
                自动匹配索引到sheet名
              </RadioGroup.Item>
              <RadioGroup.Item value="manual">手动指定sheet名</RadioGroup.Item>
            </Flex>
          </RadioGroup.Root>
        </Flex>

        {nodeData.mode === "manual" && (
          <Flex align="center" gap="2">
            <Text size="1" weight="bold">
              Sheet名称:
            </Text>
            <Select.Root
              size="1"
              value={nodeData.manualSheetName || ""}
              onValueChange={handleSelectSheet}
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Group>
                  {nodeData.targetFileID &&
                    files &&
                    files.length > 0 &&
                    files
                      .find((file) => file.id === nodeData.targetFileID)
                      ?.sheet_metas?.map((sheet) => (
                        <Select.Item
                          value={sheet.sheet_name}
                          key={sheet.sheet_name}
                        >
                          {sheet.sheet_name}
                        </Select.Item>
                      ))}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Flex>
        )}

        <Flex gap="2" style={{ marginTop: "8px" }}>
          <Button
            size="1"
            variant="outline"
            onClick={testRun}
            disabled={testPipelineNodeMutation.isLoading}
          >
            {testPipelineNodeMutation.isLoading ? "测试中..." : "旧版测试"}
          </Button>
        </Flex>
      </Flex>
    </EnhancedBaseNode>
  );
};
