import { useCallback, useState } from 'react';
import { FlowNodeProps, AggregatorNodeData } from '@/types/nodes';
import { BaseNode } from './BaseNode';
import { Select, Flex, Text } from '@radix-ui/themes';
import { useNodeId, useReactFlow } from 'reactflow';
import _ from 'lodash';

const AGGREGATION_METHODS = [
  { value: 'sum', label: '求和' },
  { value: 'avg', label: '平均值' },
  { value: 'count', label: '计数' },
  { value: 'min', label: '最小值' },
  { value: 'max', label: '最大值' },
];

export const AggregatorNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId();
  const { setNodes } = useReactFlow();
  const nodeData = data as AggregatorNodeData;
  // Mock columns that would come from upstream nodes
  const [availableColumns] = useState<string[]>([
    "型号", "废料重量", "类型", "数量", "金额"
  ]);

  const updateNodeData = useCallback(
    (updates: Partial<AggregatorNodeData>) => {
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
        })
      );
    },
    [nodeId, setNodes]
  );

  const handleSelectColumn = (column: string) => {
    updateNodeData({ statColumn: column, error: undefined });
  };

  const handleSelectMethod = (method: string) => {
    updateNodeData({ 
      method: method as 'sum' | 'avg' | 'count' | 'min' | 'max', 
      error: undefined 
    });
  };

  const testRun = async () => {
    try {
      if (!nodeData.statColumn) {
        updateNodeData({ error: '请选择要统计的列' });
        return;
      }

      if (!nodeData.method) {
        updateNodeData({ error: '请选择统计方法' });
        return;
      }

      // 模拟从上游节点获取的数据
      const mockData = [
        { "型号": "型号A", "废料重量": 100, "类型": "废料", "数量": 2, "金额": 500 },
        { "型号": "型号A", "废料重量": 300, "类型": "原料", "数量": 1, "金额": 800 },
        { "型号": "型号B", "废料重量": 150, "类型": "废料", "数量": 3, "金额": 750 },
      ];
      
      // 执行聚合计算
      const groupedData = _.groupBy(mockData, "型号");
      const result = Object.entries(groupedData).map(([key, values]) => {
        let aggregated: number;
        
        switch(nodeData.method) {
          case "sum":
            aggregated = _.sumBy(values, nodeData.statColumn as string);
            break;
          case "avg":
            aggregated = _.meanBy(values, nodeData.statColumn as string);
            break;
          case "count":
            aggregated = values.length;
            break;
          case "min":
            aggregated = _.minBy(values, nodeData.statColumn as string)?.[nodeData.statColumn as string] || 0;
            break;
          case "max":
            aggregated = _.maxBy(values, nodeData.statColumn as string)?.[nodeData.statColumn as string] || 0;
            break;
          default:
            aggregated = 0;
        }
        
        return {
          "索引": key,
          [nodeData.method + "_" + nodeData.statColumn]: aggregated
        };
      });

      updateNodeData({ 
        testResult: {
          columns: ["索引", nodeData.method + "_" + nodeData.statColumn],
          data: result
        }, 
        error: undefined 
      });
    } catch (error) {
      console.error('测试运行失败:', error);
      updateNodeData({ error: '测试运行失败' });
    }
  };

  return (
    <BaseNode
      data={nodeData}
      onTestRun={testRun}
      isSource={false}
      isTarget={true}
      testable
    >
      <Flex direction="column" gap="2">
        <Flex align="center" gap="2">
          <Text size="1" weight="bold">统计列:</Text>
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
          <Text size="1" weight="bold">统计方法:</Text>
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
        
        {nodeData.statColumn && nodeData.method && (
          <Text size="1" color="gray">
            此节点将对列 "{nodeData.statColumn}" 进行
            {AGGREGATION_METHODS.find(m => m.value === nodeData.method)?.label || "统计"}
          </Text>
        )}
      </Flex>
    </BaseNode>
  );
}; 