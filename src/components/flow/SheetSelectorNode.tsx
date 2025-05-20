import { fileSelector, useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FlowNodeProps, SheetSelectorNodeData } from "@/types/nodes";
import { 
  Flex, 
  RadioGroup, 
  Select, 
  Text 
} from "@radix-ui/themes";
import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import { useNodeId, useReactFlow } from "reactflow";
import { useShallow } from "zustand/react/shallow";
import { BaseNode } from "./BaseNode";

export const SheetSelectorNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId();
  const { setNodes } = useReactFlow();
  const nodeData = data as SheetSelectorNodeData;
  const { files } = useWorkspaceStore(useShallow(fileSelector));

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

  const handleSelectFile = async (fileId: string) => {
    try {
      updateNodeData({ targetFileID: fileId, error: undefined });
      
      // Reset manual sheet name if file changed
      if (nodeData.mode === 'manual' && nodeData.manualSheetName) {
        updateNodeData({ manualSheetName: undefined });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSheetModeChange = (mode: 'auto_by_index' | 'manual') => {
    updateNodeData({ 
      mode, 
      manualSheetName: undefined, // Reset when changing mode
      error: undefined 
    });
  };

  const handleSelectSheet = (sheetName: string) => {
    updateNodeData({ manualSheetName: sheetName, error: undefined });
  };

  const testRun = async () => {
    try {
      // Validate required fields
      if (!nodeData.targetFileID) {
        updateNodeData({ error: '请选择目标Excel文件' });
        return;
      }
      
      if (nodeData.mode === 'manual' && !nodeData.manualSheetName) {
        updateNodeData({ error: '请选择手动指定的sheet名称' });
        return;
      }
      
      // Mock data for testing
      const mockIndexes = ['型号A', '型号B', '型号C'];
      
      // Call backend API to test sheet selection
      let result;
      
      if (nodeData.mode === 'auto_by_index') {
        // Auto mode: Try to find matching sheets for each index
        result = {
          matchedSheets: {
            '型号A': 'Sheet1',
            '型号B': 'Sheet2',
            '型号C': null
          },
          unmatchedIndexes: ['型号C']
        };
      } else {
        // Manual mode: Use fixed sheet
        const targetFile = files?.find(f => f.id === nodeData.targetFileID);
        const targetSheet = targetFile?.sheet_metas?.find(s => s.sheet_name === nodeData.manualSheetName);
        
        result = {
          sheetName: nodeData.manualSheetName,
          columns: targetSheet?.columns || [],
          rowCount: 42 // Mock data
        };
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
      isSource={false}
      isTarget={true}
      onTestRun={testRun}
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
          <Text size="1" weight="bold">Sheet定位模式:</Text>
          <RadioGroup.Root 
            value={nodeData.mode || 'auto_by_index'} 
            onValueChange={(value) => handleSheetModeChange(value as 'auto_by_index' | 'manual')}
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
        </Flex>
        
        {nodeData.mode === 'manual' && (
          <Flex align="center" gap="2">
            <Text size="1" weight="bold">Sheet名称:</Text>
            <Select.Root 
              size="1"
              value={nodeData.manualSheetName || ''}
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
      </Flex>
    </BaseNode>
  );
}; 