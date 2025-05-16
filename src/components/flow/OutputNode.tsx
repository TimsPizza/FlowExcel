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
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "react-toastify";
import { useNodeId, useReactFlow } from "reactflow";
import { CopyIcon, DownloadIcon } from "@radix-ui/react-icons";

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

  const handleCopyToClipboard = async () => {
    try {
      if (!nodeData.testResult) {
        toast.error("没有可复制的数据");
        return;
      }

      // 将结果转换为CSV格式
      const csvContent = await invoke("convert_to_csv", {
        data: nodeData.testResult,
      });

      // 复制到剪贴板
      await navigator.clipboard.writeText(csvContent as string);
      toast.success("已复制到剪贴板");
    } catch (error) {
      console.error("复制失败:", error);
      toast.error("复制失败");
    }
  };

  const handleExport = async () => {
    try {
      if (!nodeData.testResult) {
        toast.error("没有可导出的数据");
        return;
      }

      // 选择保存位置和格式
      const format = nodeData.outputFormat || "excel";
      const extension =
        format === "excel" ? "xlsx" : format === "csv" ? "csv" : "txt";

      const filePath = await save({
        filters: [
          {
            name: format.toUpperCase(),
            extensions: [extension],
          },
        ],
      });

      if (!filePath) return; // 用户取消操作

      // 导出数据
      await invoke("export_data", {
        data: nodeData.testResult,
        filePath,
        format,
      });

      toast.success("导出成功");
    } catch (error) {
      console.error("导出失败:", error);
      toast.error("导出失败");
    }
  };

  const testRun = async () => {
    try {
      // 模拟从上游节点获取的结果数据
      const mockResult = [
        { 型号: "A型", 废料总重: 400 },
        { 型号: "B型", 废料总重: 200 },
        { 型号: "C型", 废料总重: 600 },
      ];

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
    >
      <Flex direction="column" gap="2">
        <Flex align="center" gap="2">
          <Text size="1" weight="bold">
            输出格式:
          </Text>
          <Select.Root
            size="1"
            value={nodeData.outputFormat || "table"}
            onValueChange={(value) =>
              updateNodeData({
                outputFormat: value as "table" | "csv" | "excel",
                error: undefined,
              })
            }
          >
            <Select.Trigger />
            <Select.Content>
              <Select.Group>
                <Select.Label>选择格式</Select.Label>
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

        {nodeData.testResult &&
          Array.isArray(nodeData.testResult) &&
          nodeData.testResult.length > 0 && (
            <ScrollArea scrollbars="vertical" style={{ maxHeight: "200px" }}>
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    {Object.keys(nodeData.testResult[0]).map((key) => (
                      <Table.ColumnHeaderCell key={key}>
                        {key}
                      </Table.ColumnHeaderCell>
                    ))}
                  </Table.Row>
                </Table.Header>

                <Table.Body>
                  {nodeData.testResult.map((row, idx) => (
                    <Table.Row key={idx}>
                      {Object.values(row).map((value, i) => (
                        <Table.Cell key={i}>{String(value)}</Table.Cell>
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
