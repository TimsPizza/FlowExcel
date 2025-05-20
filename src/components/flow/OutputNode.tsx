import { useCallback } from "react";
import { FlowNodeProps, OutputNodeData } from "@/types/nodes";
import { BaseNode } from "./BaseNode";
import {
  Select,
  Flex,
  Button,
  Text,
  Table,
  ScrollArea,
} from "@radix-ui/themes";
import { useNodeId, useReactFlow } from "reactflow";
import { CopyIcon, DownloadIcon } from "@radix-ui/react-icons";
import _ from "lodash";

export const OutputNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId();
  const { setNodes } = useReactFlow();
  const nodeData = data as OutputNodeData;

  const updateNodeData = useCallback(
    (updates: Partial<OutputNodeData>) => {
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

  const handleSelectFormat = (format: string) => {
    updateNodeData({
      outputFormat: format as "table" | "csv" | "excel",
      error: undefined,
    });
  };

  const handleCopyToClipboard = async () => {
    try {
      if (!nodeData.testResult) {
        updateNodeData({ error: "没有可复制的数据" });
        return;
      }

      // 模拟将结果转换为CSV格式
      const data = nodeData.testResult;
      const headers = data.columns.join(",");
      const rows = data.data.map(row => row.join(",")).join("\n");
      const csvContent = `${headers}\n${rows}`;

      // 复制到剪贴板
      await navigator.clipboard.writeText(csvContent);
      console.log("已复制到剪贴板");
    } catch (error) {
      console.error("复制失败:", error);
      updateNodeData({ error: "复制数据失败" });
    }
  };

  const handleExport = async () => {
    try {
      if (!nodeData.testResult) {
        updateNodeData({ error: "没有可导出的数据" });
        return;
      }

      console.log(`导出数据为 ${nodeData.outputFormat} 格式`);
      // 模拟导出操作，实际项目中应调用 Tauri API
    } catch (error) {
      console.error("导出失败:", error);
      updateNodeData({ error: "导出数据失败" });
    }
  };

  const testRun = async () => {
    try {
      // 模拟从上游节点获取的结果数据
      const mockResult = {
        columns: ["型号", "废料总重", "数量"],
        data: [
          ["A型", 400, 3],
          ["B型", 200, 1],
          ["C型", 600, 4],
        ]
      };

      updateNodeData({ testResult: mockResult, error: undefined });
    } catch (error) {
      console.error("测试运行失败:", error);
      updateNodeData({ error: "测试运行失败" });
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
