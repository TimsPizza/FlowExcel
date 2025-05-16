import { useCallback } from 'react';
import { FlowNodeProps, IndexSourceNodeData, NodeType } from '@/types/nodes';
import { BaseNode } from './BaseNode';
import { Select, Flex, TextField, Button, Text } from '@radix-ui/themes';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { toast } from 'react-toastify';
import { useNodeId, useReactFlow } from 'reactflow';
import { basename } from '@tauri-apps/api/path';

export const IndexSourceNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId();
  const { setNodes } = useReactFlow();
  const nodeData = data as IndexSourceNodeData;

  const updateNodeData = useCallback(
    (updates: Partial<IndexSourceNodeData>) => {
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

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Excel',
            extensions: ['xlsx', 'xls', 'csv'],
          },
        ],
      });

      if (selected && typeof selected === 'string') {
        const filename = await basename(selected);
        updateNodeData({ sourceFile: selected, error: undefined });
        
        // 获取Excel文件的sheet列表
        const sheets = await invoke('get_excel_sheets', {
          filePath: selected,
        });

        // 更新表单选择列表
        if (Array.isArray(sheets)) {
          // 如果当前选择的sheet不在列表中，重置选择
          if (nodeData.sheetName && !sheets.includes(nodeData.sheetName)) {
            updateNodeData({ sheetName: undefined, columnName: undefined });
          }
        }
      }
    } catch (error) {
      toast.error('选择文件失败');
      console.error(error);
    }
  };

  const handleSelectSheet = async (sheetName: string) => {
    try {
      updateNodeData({ sheetName, columnName: undefined, error: undefined });
      
      // 获取选定sheet中的列名
      if (nodeData.sourceFile) {
        const columns = await invoke('get_excel_columns', {
          filePath: nodeData.sourceFile,
          sheetName,
        });
        
        // 这里已获取列信息，可以在UI中展示
      }
    } catch (error) {
      toast.error('获取sheet信息失败');
      console.error(error);
      updateNodeData({ error: '获取sheet信息失败' });
    }
  };

  const testRun = async () => {
    try {
      if (!nodeData.sourceFile || !nodeData.sheetName || !nodeData.columnName) {
        updateNodeData({ error: '请完成所有配置后再测试' });
        return;
      }

      // 调用后端获取索引数据
      const result = await invoke('get_index_values', {
        filePath: nodeData.sourceFile,
        sheetName: nodeData.sheetName,
        columnName: nodeData.columnName,
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
      isSource={true}
      isTarget={false}
      onTestRun={testRun}
    >
      <Flex direction="column" gap="2">
        <Flex align="center" gap="2">
          <Text size="1" weight="bold">源文件:</Text>
          <TextField.Root
            size="1" 
            style={{ flex: 1 }}
            placeholder="选择Excel文件..."
            value={nodeData.sourceFile ? nodeData.sourceFile : ''}
            readOnly
          />
          <Button size="1" onClick={handleSelectFile}>
            浏览
          </Button>
        </Flex>
        
        <Flex align="center" gap="2">
          <Text size="1" weight="bold">工作表:</Text>
          <Select.Root 
            size="1"
            value={nodeData.sheetName || ''}
            onValueChange={handleSelectSheet}
          >
            <Select.Trigger style={{ width: '100%' }} />
            <Select.Content>
              <Select.Group>
                <Select.Label>选择工作表</Select.Label>
                {/* 这里会动态填充工作表列表 */}
                {nodeData.sourceFile && (
                  <>
                    <Select.Item value="">-- 请选择 --</Select.Item>
                    {/* 从后端获取的工作表列表 */}
                  </>
                )}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </Flex>
        
        <Flex align="center" gap="2">
          <Text size="1" weight="bold">索引列:</Text>
          <Select.Root 
            size="1"
            value={nodeData.columnName || ''}
            onValueChange={(columnName) => updateNodeData({ columnName, error: undefined })}
          >
            <Select.Trigger style={{ width: '100%' }} />
            <Select.Content>
              <Select.Group>
                <Select.Label>选择索引列</Select.Label>
                {nodeData.sheetName && (
                  <>
                    <Select.Item value="">-- 请选择 --</Select.Item>
                    {/* 从后端获取的列名列表 */}
                  </>
                )}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </Flex>
      </Flex>
    </BaseNode>
  );
}; 