import { useCallback } from "react";
import { FlowNodeProps, OutputNodeDataContext, NodeType } from "@/types/nodes";
import { BaseNode } from "./BaseNode";
import {
  Select,
  Flex,
  Button,
  Text,
  TextField,
  Badge,
  ScrollArea,
  Card,
} from "@radix-ui/themes";
import { useNodeId } from "reactflow";
import { CopyIcon, DownloadIcon, FileIcon } from "@radix-ui/react-icons";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useTestPipelineNodeMutation } from "@/hooks/workspaceQueries";
import {
  transformOutputResults,
  PipelineNodeResult,
  isMultiSheetResult,
  isDataFrameResult,
} from "@/lib/dataTransforms";
import { SimpleDataframe, SheetInfo } from "@/types";
import useToast from "@/hooks/useToast";

export const OutputNode: React.FC<FlowNodeProps> = ({ data }) => {
  const toast = useToast();
  const nodeId = useNodeId()!;
  const nodeData = data as OutputNodeDataContext;
  const { mutate: testPipelineMutation } = useTestPipelineNodeMutation();
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const updateOutputNodeDataInStore = useWorkspaceStore(
    (state) => state.updateNodeData,
  );

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

  const handleSelectFormat = (format: string) => {
    updateLocalNodeData({
      outputFormat: format as "table" | "csv" | "excel",
      error: undefined,
      testResult: undefined,
    });
  };

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

      const defaultExtension =
        nodeData.outputFormat === "excel" ? "xlsx" : "csv";
      const filters =
        nodeData.outputFormat === "excel"
          ? [{ name: "Excel Files", extensions: ["xlsx"] }]
          : [{ name: "CSV Files", extensions: ["csv"] }];

      const filePath = await save({
        defaultPath: `output.${defaultExtension}`,
        filters,
      });

      if (filePath) {
        handleOutputPathChange(filePath);
      }
    } catch (error) {
      console.error("选择文件路径失败:", error);
      toast.error("选择文件路径失败");
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      if (!nodeData.testResult) {
        updateLocalNodeData({
          error: "没有可复制的数据",
          testResult: nodeData.testResult,
        });
        return;
      }

      let csvContent = "";

      // 检查是否为多sheet结果
      if (isMultiSheetResult(nodeData.testResult)) {
        // 多sheet结果：将所有sheet合并为一个CSV
        const sheets = nodeData.testResult as SheetInfo[];
        for (const sheet of sheets) {
          csvContent += `# ${sheet.sheet_name}\n`;
          if (sheet.columns.length > 0) {
            csvContent += sheet.columns.join(",") + "\n";
            for (const row of sheet.preview_data) {
              csvContent += row.map((cell) => String(cell)).join(",") + "\n";
            }
          }
          csvContent += "\n";
        }
      } else if (isDataFrameResult(nodeData.testResult)) {
        // 单sheet结果
        const resultData = nodeData.testResult as SimpleDataframe;
        const headers = resultData.columns?.join(",") || "";
        const rows =
          resultData.data
            ?.map((row) => row.map((cell) => String(cell)).join(","))
            .join("\n") || "";
        csvContent = `${headers}\n${rows}`;
      }

      if (csvContent) {
        await navigator.clipboard.writeText(csvContent);
        toast.success("已复制到剪贴板");
        updateLocalNodeData({ error: undefined });
      } else {
        updateLocalNodeData({
          error: "没有可复制的数据",
          testResult: nodeData.testResult,
        });
      }
    } catch (error) {
      console.error("复制失败:", error);
      updateLocalNodeData({
        error: "复制数据失败",
        testResult: nodeData.testResult,
      });
    }
  };

  const testPipelineRun = async () => {
    if (!currentWorkspace) {
      toast.error("未找到当前工作区");
      return;
    }

    testPipelineMutation(
      { workspaceId: currentWorkspace.id, nodeId },
      {
        onSuccess: (result) => {
          const nodeResults = result.results[nodeData.id];
          if (nodeResults && nodeResults.length > 0) {
            // 使用数据转换函数处理结果
            const transformed = transformOutputResults(
              nodeData.id,
              NodeType.OUTPUT,
              nodeResults as PipelineNodeResult[],
            );

            if (transformed.error) {
              updateLocalNodeData({
                error: transformed.error,
                testResult: undefined,
              });
            } else {
              // 直接使用转换后的displayData
              updateLocalNodeData({
                testResult: transformed.displayData || undefined,
                error: undefined,
              });

              // 如果设置了输出路径且有数据，显示保存成功消息
              if (nodeData.outputPath && transformed.displayData) {
                if (
                  isMultiSheetResult(transformed.displayData) &&
                  transformed.displayData.length > 0
                ) {
                  toast.success("多sheet数据已保存到指定路径");
                } else if (
                  isDataFrameResult(transformed.displayData) &&
                  transformed.displayData.data &&
                  transformed.displayData.data.length > 0
                ) {
                  toast.success("数据已保存到指定路径");
                }
              }
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

  // 计算总行数用于显示
  const getTotalRows = () => {
    if (!nodeData.testResult) return 0;

    if (isMultiSheetResult(nodeData.testResult)) {
      return nodeData.testResult.reduce(
        (total, sheet) => total + sheet.preview_data.length,
        0,
      );
    } else if (isDataFrameResult(nodeData.testResult)) {
      return nodeData.testResult.data?.length || 0;
    }
    return 0;
  };

  const renderDataPreview = () => {
    if (!nodeData.testResult) return null;

    if (isMultiSheetResult(nodeData.testResult)) {
      // 多sheet显示
      const sheets = nodeData.testResult as SheetInfo[];
      return (
        <ScrollArea className="max-h-48">
          <Flex direction="column" gap="2">
            {sheets.map((sheet, index) => (
              <Card key={index} size="1">
                <Flex direction="column" gap="1">
                  <Text size="1" weight="bold">
                    {sheet.sheet_name}
                  </Text>
                  <Text size="1" color="gray">
                    {sheet.columns.length} 列 × {sheet.preview_data.length} 行
                  </Text>
                  {sheet.columns.length > 0 && (
                    <Text size="1" style={{ fontFamily: "monospace" }}>
                      {sheet.columns.slice(0, 3).join(", ")}
                      {sheet.columns.length > 3 && "..."}
                    </Text>
                  )}
                </Flex>
              </Card>
            ))}
          </Flex>
        </ScrollArea>
      );
    } else if (isDataFrameResult(nodeData.testResult)) {
      // 单sheet显示
      const resultData = nodeData.testResult as SimpleDataframe;
      return (
        <Flex direction="column" gap="1">
          <Text size="1" color="gray">
            {resultData.columns?.length || 0} 列 ×{" "}
            {resultData.data?.length || 0} 行
          </Text>
          {resultData.columns && resultData.columns.length > 0 && (
            <Text size="1" style={{ fontFamily: "monospace" }}>
              {resultData.columns.slice(0, 3).join(", ")}
              {resultData.columns.length > 3 && "..."}
            </Text>
          )}
        </Flex>
      );
    }

    return null;
  };

  return (
    <BaseNode
      data={nodeData}
      isSource={false}
      isTarget={true}
      onTestRun={testPipelineRun}
      testable={true}
    >
      <Flex direction="column" gap="3">
        {/* 输出格式选择 */}
        <Flex align="center" gap="2">
          <Text size="1" weight="bold">
            输出格式:
          </Text>
          <Select.Root
            size="1"
            value={nodeData.outputFormat || "table"}
            onValueChange={handleSelectFormat}
          >
            <Select.Trigger />
            <Select.Content>
              <Select.Group>
                <Select.Item value="table">表格</Select.Item>
                <Select.Item value="csv">CSV</Select.Item>
                <Select.Item value="excel">Excel</Select.Item>
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </Flex>

        {/* 输出路径选择 */}
        {(nodeData.outputFormat === "csv" ||
          nodeData.outputFormat === "excel") && (
          <Flex direction="column" gap="1">
            <Text size="1" weight="medium">
              保存路径
            </Text>
            <Flex gap="1">
              <TextField.Root
                value={nodeData.outputPath || ""}
                onChange={(e) => handleOutputPathChange(e.target.value)}
                placeholder="选择文件保存路径..."
                style={{ flex: 1 }}
              />
              <Button size="1" variant="soft" onClick={handleSelectOutputPath}>
                <FileIcon />
              </Button>
            </Flex>
          </Flex>
        )}

        {/* 数据预览 */}
        {nodeData.testResult && (
          <Flex direction="column" gap="2">
            <Text size="1" weight="medium">
              数据预览
            </Text>
            {renderDataPreview()}
          </Flex>
        )}

        {/* 操作按钮 */}
        <Flex gap="2">
          <Button
            size="1"
            onClick={handleCopyToClipboard}
            disabled={!nodeData.testResult}
          >
            <CopyIcon /> 复制
          </Button>
        </Flex>

        {/* 状态指示 */}
        <Flex gap="1" wrap="wrap">
          <Badge color="blue" size="1">
            格式: {nodeData.outputFormat || "table"}
          </Badge>
          {nodeData.outputPath && (
            <Badge color="green" size="1">
              已设置保存路径
            </Badge>
          )}
          {nodeData.testResult && (
            <>
              {isMultiSheetResult(nodeData.testResult) && (
                <Badge color="purple" size="1">
                  {nodeData.testResult.length} 个Pipeline
                </Badge>
              )}
              <Badge color="orange" size="1">
                {getTotalRows()} 行数据
              </Badge>
            </>
          )}
        </Flex>
      </Flex>
    </BaseNode>
  );
};
