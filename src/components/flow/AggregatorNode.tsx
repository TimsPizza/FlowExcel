import { useCallback, useState } from 'react';
import { FlowNodeProps, AggregatorNodeData } from '@/types/nodes';
import { BaseNode } from './BaseNode';
import { Select, Flex, Text } from '@radix-ui/themes';
import { invoke } from '@tauri-apps/api/core';
import { useNodeId, useReactFlow } from 'reactflow';

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
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);

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

  // 获取可用列名（假设是从上游节点传递）
  const fetchAvailableColumns = async () => {
    try {
      // 实际项目中，应该从上游节点获取或后端获取
      const columns = ['型号', '废料重量', '类型'];
      setAvailableColumns(columns);
    } catch (error) {
      console.error('获取列名失败:', error);
    }
  };

  // 组件挂载时调用
  useCallback(() => {
    fetchAvailableColumns();
  }, []);

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

      // 模拟从上游节点获取的索引数据
      const mockIndex = '型号A';

      // 模拟从上游节点获取的筛选后数据
      const mockFilteredData = [
        { '型号': '型号A', '废料重量': 100, '类型': '废料' },
        { '型号': '型号A', '废料重量': 300, '类型': '原料' },
      ];
      
      // 调用后端API测试统计功能
      const result = await invoke('test_aggregation', {
        data: mockFilteredData,
        indexValue: mockIndex,
        column: nodeData.statColumn,
        method: nodeData.method
      });
      
      updateNodeData({ testResult: result, error: undefined });
    } catch (error) {
      console.error('测试运行失败:', error);
      updateNodeData({ error: '测试运行失败' });
    }
  };

  return (
    <BaseNode
      data={nodeData}
      onTestRun={testRun}
    >
      <Flex direction="column" gap="2">
        <Flex align="center" gap="2">
          <Text size="1" weight="bold">统计列:</Text>
          <Select.Root 
            size="1"
            value={nodeData.statColumn || ''}
            onValueChange={(value) => updateNodeData({ statColumn: value, error: undefined })}
          >
            <Select.Trigger placeholder="选择列" />
            <Select.Content>
              <Select.Group>
                <Select.Label>选择列</Select.Label>
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
            value={nodeData.method || 'sum'}
            onValueChange={(value) => 
              updateNodeData({ 
                method: value as 'sum' | 'avg' | 'count' | 'min' | 'max',
                error: undefined 
              })
            }
          >
            <Select.Trigger />
            <Select.Content>
              <Select.Group>
                <Select.Label>选择方法</Select.Label>
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
            此节点将对列 "{nodeData.statColumn}" 进行{
              AGGREGATION_METHODS.find(m => m.value === nodeData.method)?.label || '统计'
            }
          </Text>
        )}
      </Flex>
    </BaseNode>
  );
}; 