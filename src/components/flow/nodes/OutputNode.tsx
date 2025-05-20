import { useCallback } from "react";
import { FlowNodeProps, OutputNodeDataContext } from "@/types/nodes";
import { BaseNode } from "./BaseNode";
import {
  Select,
  Flex,
  Button,
  Text,
  Table,
  ScrollArea,
} from "@radix-ui/themes";
import { useNodeId } from "reactflow";
import { CopyIcon, DownloadIcon } from "@radix-ui/react-icons";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export const OutputNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId();
  const nodeData = data as OutputNodeDataContext;

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
    });
  };

  const handleCopyToClipboard = async () => {
    try {
      if (!nodeData.testResult || !nodeData.testResult.data) {
        updateLocalNodeData({
          error: "没有可复制的数据",
          testResult: nodeData.testResult,
        });
        return;
      }

      const resultData = nodeData.testResult;
      const headers = resultData.columns.join(",");
      const rows = resultData.data
        .map((row) => row.map((cell) => String(cell)).join(","))
        .join("\n");
      const csvContent = `${headers}\n${rows}`;

      await navigator.clipboard.writeText(csvContent);
      console.log("已复制到剪贴板");
      updateLocalNodeData({ error: undefined });
    } catch (error) {
      console.error("复制失败:", error);
      updateLocalNodeData({
        error: "复制数据失败",
        testResult: nodeData.testResult,
      });
    }
  };

  const handleExport = async () => {
    try {
      if (!nodeData.testResult) {
        updateLocalNodeData({
          error: "没有可导出的数据",
          testResult: nodeData.testResult,
        });
        return;
      }
      console.log(`导出数据为 ${nodeData.outputFormat} 格式`);
      updateLocalNodeData({ error: undefined });
    } catch (error) {
      console.error("导出失败:", error);
      updateLocalNodeData({
        error: "导出数据失败",
        testResult: nodeData.testResult,
      });
    }
  };

  const testRun = async () => {
    try {
      const mockResult = {
        columns: ["型号", "废料总重", "数量"],
        data: [
          ["A型", 400, 3],
          ["B型", 200, 1],
          ["C型", 600, 4],
        ],
      };
      updateLocalNodeData({ testResult: mockResult, error: undefined });
    } catch (error) {
      console.error("测试运行失败:", error);
      updateLocalNodeData({ error: "测试运行失败", testResult: undefined });
    }
  };

  return (
    <BaseNode
      data={nodeData}
      isSource={false}
      isTarget={true}
      onTestRun={testRun}
      testable
    >
      <Flex direction="column" gap="2">
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

        <Flex gap="2">
          <Button
            size="1"
            onClick={handleCopyToClipboard}
            disabled={!nodeData.testResult}
          >
            <CopyIcon /> 复制
          </Button>
          <Button
            size="1"
            onClick={handleExport}
            disabled={!nodeData.testResult}
          >
            <DownloadIcon /> 导出
          </Button>
        </Flex>

        {nodeData.testResult && (
          <ScrollArea className="react-flow__node-scrollable max-h-60">
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  {nodeData.testResult.columns.map((column) => (
                    <Table.ColumnHeaderCell key={column}>
                      {column}
                    </Table.ColumnHeaderCell>
                  ))}
                </Table.Row>
              </Table.Header>

              <Table.Body>
                {nodeData.testResult.data.map((row, rowIndex) => (
                  <Table.Row key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <Table.Cell key={cellIndex}>{String(cell)}</Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </ScrollArea>
        )}
      </Flex>
    </BaseNode>
  );
};
