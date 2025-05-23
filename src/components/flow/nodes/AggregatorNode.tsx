import { useCallback, useRef, useState } from "react";
import { FlowNodeProps, AggregatorNodeDataContext } from "@/types/nodes";
import { BaseNode } from "./BaseNode";
import {
  Select,
  Flex,
  Text,
  TextArea,
  TextField,
  Badge,
} from "@radix-ui/themes";
import { useNodeId } from "reactflow";
import _ from "lodash";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useTestPipelineNodeMutation } from "@/hooks/workspaceQueries";
import { toast } from "react-toastify";

const AGGREGATION_METHODS = [
  { value: "sum", label: "求和" },
  { value: "avg", label: "平均值" },
  { value: "count", label: "计数" },
  { value: "min", label: "最小值" },
  { value: "max", label: "最大值" },
];

export const AggregatorNode: React.FC<FlowNodeProps> = ({ data }) => {
  const isComposing = useRef(false);
  const nodeId = useNodeId();
  const nodeData = data as AggregatorNodeDataContext;
  const [innerValue, setInnerValue_] = useState(nodeData.outputAs || "");
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const testPipelineNodeMutation = useTestPipelineNodeMutation();

  const setInnerValue = (value: string) => {
    console.log("setInnerValue", value);
    setInnerValue_(value);
  };
  const [availableColumns] = useState<string[]>([
    "型号",
    "废料重量",
    "类型",
    "数量",
    "金额",
  ]);

  const updateAggregatorNodeDataInStore = useWorkspaceStore(
    (state) => state.updateNodeData,
  );

  const updateLocalNodeData = useCallback(
    (updates: Partial<AggregatorNodeDataContext>) => {
      if (nodeId && updateAggregatorNodeDataInStore) {
        updateAggregatorNodeDataInStore(nodeId, updates);
      } else {
        console.warn(
          "AggregatorNode: nodeId or updateFunction in store is not available.",
          {
            nodeId,
            hasUpdater: !!updateAggregatorNodeDataInStore,
          },
        );
      }
    },
    [nodeId, updateAggregatorNodeDataInStore],
  );

  const handleSelectColumn = (column: string) => {
    updateLocalNodeData({
      statColumn: column,
      error: undefined,
      testResult: undefined,
    });
  };

  const handleSelectMethod = (method: string) => {
    updateLocalNodeData({
      method: method as "sum" | "avg" | "count" | "min" | "max",
      error: undefined,
      testResult: undefined,
    });
  };

  const testRun = async () => {
    try {
      if (!nodeData.statColumn) {
        updateLocalNodeData({
          error: "请选择要统计的列",
          testResult: undefined,
        });
        return;
      }

      if (!nodeData.method) {
        updateLocalNodeData({ error: "请选择统计方法", testResult: undefined });
        return;
      }

      const mockData = [
        { 型号: "型号A", 废料重量: 100, 类型: "废料", 数量: 2, 金额: 500 },
        { 型号: "型号A", 废料重量: 300, 类型: "原料", 数量: 1, 金额: 800 },
        { 型号: "型号B", 废料重量: 150, 类型: "废料", 数量: 3, 金额: 750 },
      ];

      const groupedData = _.groupBy(mockData, "型号");
      const result = Object.entries(groupedData).map(([key, values]) => {
        let aggregated: number;
        const statCol = nodeData.statColumn as string;

        switch (nodeData.method) {
          case "sum":
            aggregated = _.sumBy(values, statCol);
            break;
          case "avg":
            aggregated = _.meanBy(values, statCol);
            break;
          case "count":
            aggregated = values.length;
            break;
          case "min":
            aggregated =
              Number(
                _.minBy(values, statCol)?.[statCol as keyof (typeof values)[0]],
              ) || 0;
            break;
          case "max":
            aggregated =
              Number(
                _.maxBy(values, statCol)?.[statCol as keyof (typeof values)[0]],
              ) || 0;
            break;
          default:
            aggregated = 0;
        }

        return [key, aggregated];
      });

      updateLocalNodeData({
        testResult: {
          columns: [
            "索引",
            nodeData.method + "_" + (nodeData.statColumn || ""),
          ],
          data: result,
        },
        error: undefined,
      });
    } catch (error) {
      console.error("测试运行失败:", error);
      updateLocalNodeData({ error: "测试运行失败", testResult: undefined });
    }
  };

  const testPipelineRun = async () => {
    if (!currentWorkspace) {
      toast.error("未找到当前工作区");
      return;
    }

    testPipelineNodeMutation.mutate(
      {
        workspaceId: currentWorkspace.id,
        nodeId: nodeData.id,
      },
      {
        onSuccess: (result) => {
          const nodeResults = result.results[nodeData.id];
          if (nodeResults && nodeResults.length > 0) {
            const formattedData: any[][] = [];
            let columns: string[] = [];
            
            nodeResults.forEach((nodeResult: any) => {
              if (nodeResult.result_data && nodeResult.result_data.data) {
                if (columns.length === 0 && nodeResult.result_data.columns) {
                  columns = nodeResult.result_data.columns;
                }
                
                const resultData = nodeResult.result_data.data;
                if (resultData.length > 0) {
                  resultData.forEach((row: Record<string, any>) => {
                    const indexValue = row.index_value || "";
                    const resultValue = row.result || 0;
                    formattedData.push([indexValue, resultValue]);
                  });
                }
              }
            });
            
            updateLocalNodeData({
              testResult: {
                columns: ["索引", nodeData.method + "_" + (nodeData.statColumn || "")],
                data: formattedData,
              },
              error: undefined,
            });
          } else {
            updateLocalNodeData({
              testResult: undefined,
              error: "无结果数据",
            });
          }
        },
        onError: (error) => {
          updateLocalNodeData({
            testResult: undefined,
            error: `Pipeline测试失败: ${error.message}`,
          });
        },
      },
    );
  };

  return (
    <>
      <BaseNode
        data={nodeData}
        onTestRun={testPipelineRun}
        isSource={true}
        isTarget={true}
        testable
      >
        <Flex direction="column" gap="2">
          <Flex align="center" gap="2">
            <Text size="1" weight="bold">
              统计列:
            </Text>
            <Select.Root
              size="1"
              value={nodeData.statColumn || ""}
              onValueChange={handleSelectColumn}
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Group>
                  {availableColumns.map((col) => (
                    <Select.Item key={col} value={col}>
                      {col}
                    </Select.Item>
                  ))}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Flex>

          <Flex align="center" gap="2">
            <Text size="1" weight="bold">
              统计方法:
            </Text>
            <Select.Root
              size="1"
              value={nodeData.method || "sum"}
              onValueChange={handleSelectMethod}
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Group>
                  {AGGREGATION_METHODS.map((method) => (
                    <Select.Item key={method.value} value={method.value}>
                      {method.label}
                    </Select.Item>
                  ))}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Flex>
          <Flex align="center" gap="2">
            <Text size="1" weight="bold">
              输出列名:
            </Text>
            <TextField.Root
              value={innerValue}
              onChange={(e) => {
                // 只在没有 composition 的情况下同步
                setInnerValue(e.target.value);
              }}
              onBlur={() => {
                // trim 一下
                setInnerValue(innerValue.trim());
              }}
            >
              <TextField.Slot />
            </TextField.Root>
          </Flex>

          {nodeData.statColumn && nodeData.method && (
            <Text size="1" color="gray">
              此节点将对列 "{nodeData.statColumn}" 进行
              {AGGREGATION_METHODS.find((m) => m.value === nodeData.method)
                ?.label || "统计"}
            </Text>
          )}
        </Flex>
      </BaseNode>

      {/* Pipeline测试按钮 */}
      {/* <Flex justify="center" mt="2">
        <Badge
          color="green"
          className="inline-block cursor-pointer"
          onClick={testPipelineRun}
          style={{ opacity: testPipelineNodeMutation.isLoading ? 0.6 : 1 }}
        >
          {testPipelineNodeMutation.isLoading ? "测试中..." : "Pipeline测试运行"}
        </Badge>
      </Flex> */}
    </>
  );
};
