import { useCallback } from 'react';
import { FlowNodeProps, SheetSelectorNodeData } from '@/types/nodes';
import { BaseNode } from './BaseNode';
import { Select, Flex, TextField, Button, Text, RadioGroup } from '@radix-ui/themes';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { toast } from 'react-toastify';
import { useNodeId, useReactFlow } from 'reactflow';
import { basename } from '@tauri-apps/api/path';

export const SheetSelectorNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId();
  const { setNodes } = useReactFlow();
  const nodeData = data as SheetSelectorNodeData;

  const updateNodeData = useCallback(
    (updates: Partial<SheetSelectorNodeData>) => {
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
        updateNodeData({ targetFileID: selected, error: undefined });
        
        // 获取Excel文件的sheet列表，用于手动模式的展示
        const sheets = await invoke('get_excel_sheets', {
          filePath: selected,
        });
        
        // 如果之前有手动选择的sheet，但在新文件中不存在，需要重置
        if (nodeData.mode === 'manual' && nodeData.manualSheetName && 
            Array.isArray(sheets) && !sheets.includes(nodeData.manualSheetName)) {
          updateNodeData({ manualSheetName: undefined });
        }
      }
    } catch (error) {
      toast.error('选择文件失败');
      console.error(error);
    }
  };

  const testRun = async () => {
    try {
      // 验证必要参数是否已配置
      if (!nodeData.targetFileID) {
        updateNodeData({ error: '请选择目标Excel文件' });
        return;
      }
      
      if (nodeData.mode === 'manual' && !nodeData.manualSheetName) {
        updateNodeData({ error: '请选择手动指定的sheet名称' });
        return;
      }
      
      // 模拟获取上游节点的索引数据
      // 实际应用中应通过边连接获取
      const mockIndexes = ['型号A', '型号B', '型号C'];
      
      // 调用后端API测试sheet选择功能
      let result;
      
      if (nodeData.mode === 'auto_by_index') {
        // 自动模式：尝试为每个索引查找匹配的sheet
        result = await invoke('test_sheet_selection_by_index', {
          filePath: nodeData.targetFileID,
          indexes: mockIndexes
        });
      } else {
        // 手动模式：指向固定sheet
        result = await invoke('test_fixed_sheet', {
          filePath: nodeData.targetFileID,
          sheetName: nodeData.manualSheetName
        });
      }
      
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
          <Text size="1" weight="bold">目标文件:</Text>
          <TextField.Root
            size="1" 
            style={{ flex: 1 }}
            placeholder="选择Excel文件..."
            value={nodeData.targetFileID || ''}
            readOnly
          />
          <Button size="1" onClick={handleSelectFile}>
            浏览
          </Button>
        </Flex>
        
        <Text size="1" weight="bold">Sheet定位模式:</Text>
        <RadioGroup.Root 
          value={nodeData.mode} 
          onValueChange={(value) => updateNodeData({ 
            mode: value as 'auto_by_index' | 'manual', 
            error: undefined 
          })}
        >
          <Flex direction="column" gap="1">
            <RadioGroup.Item value="auto_by_index">
              自动匹配索引到sheet名
            </RadioGroup.Item>
            <RadioGroup.Item value="manual">
              手动指定sheet名
            </RadioGroup.Item>
          </Flex>
        </RadioGroup.Root>
        
        {nodeData.mode === 'manual' && (
          <Flex align="center" gap="2" mt="1">
            <Text size="1" weight="bold">Sheet名称:</Text>
            <Select.Root 
              size="1"
              value={nodeData.manualSheetName || ''}
              onValueChange={(sheetName) => updateNodeData({ manualSheetName: sheetName, error: undefined })}
            >
              <Select.Trigger style={{ width: '100%' }} />
              <Select.Content>
                <Select.Group>
                  <Select.Label>选择工作表</Select.Label>
                  {nodeData.targetFileID && (
                    <>
                      <Select.Item value="">-- 请选择 --</Select.Item>
                      {/* 这里会填充从后端获取的sheet列表 */}
                    </>
                  )}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Flex>
        )}
      </Flex>
    </BaseNode>
  );
}; 