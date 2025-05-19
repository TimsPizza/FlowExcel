import { fileSelector, useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FlowNodeProps, IndexSourceNodeData } from "@/types/nodes";
import { CheckboxGroup, Flex, Select, Text } from "@radix-ui/themes";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect } from "react";
import { useNodeId, useReactFlow } from "reactflow";
import { useShallow } from "zustand/react/shallow";
import { BaseNode } from "./BaseNode";

export const IndexSourceNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId();
  const { setNodes } = useReactFlow();
  const nodeData = data as IndexSourceNodeData;
  const { files } = useWorkspaceStore(useShallow(fileSelector));

  useEffect(() => {
    console.log("index source node files", files);
  }, [files]);

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
        }),
      );
    },
    [nodeId, setNodes],
  );

  const handleSelectFile = async (filePath: string) => {
    console.log("index source node handleSelectFile", filePath);
    try {
      updateNodeData({ sourceFileID: filePath, error: undefined });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectSheet = async (sheetName: string) => {
    try {
      updateNodeData({ sheetName, columnNames: undefined, error: undefined });
    } catch (error) {
      console.error(error);
    }
  };

  const testRun = async () => {
    try {
      if (
        !nodeData.sourceFileID ||
        !nodeData.sheetName ||
        !nodeData.columnNames
      ) {
        updateNodeData({ error: "请完成所有配置后再测试" });
        return;
      }

      // 调用后端获取索引数据
      const result = await invoke("get_index_values", {
        filePath: nodeData.sourceFileID,
        sheetName: nodeData.sheetName,
        columnName: nodeData.columnNames,
      });

      updateNodeData({ testResult: result, error: undefined });
    } catch (error) {
      console.error("测试运行失败:", error);
      updateNodeData({ error: "测试运行失败" });
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
          <Text size="1" weight="bold">
            源文件:
          </Text>
          <Select.Root
            onValueChange={(v) => handleSelectFile(v)}
            defaultValue="选择文件"
          >
            <Select.Trigger>
              <Text size="1">{nodeData.sourceFileID ?? "选择文件"}</Text>
            </Select.Trigger>
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

        <Flex align="center" gap="2">
          <Text size="1" weight="bold">
            工作表:
          </Text>
          <Select.Root
            size="1"
            value={nodeData.sheetName || ""}
            onValueChange={handleSelectSheet}
            defaultValue="选择工作表"
          >
            <Select.Trigger style={{ width: "100%" }} />
            <Select.Content>
              <Select.Group>
                {nodeData.sourceFileID &&
                  files &&
                  files.length > 0 &&
                  files
                    .find((file) => file.id === nodeData.sourceFileID)
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

        <Flex align="center" gap="2">
          <Text size="1" weight="bold">
            索引列:
          </Text>
          <CheckboxGroup.Root
            size="1"
            value={nodeData.columnNames ?? []}
            defaultValue={[]}
            onValueChange={(columnNames) =>
              updateNodeData({ columnNames: columnNames, error: undefined })
            }
          >
            {nodeData.sheetName &&
              files &&
              files.length > 0 &&
              files
                .find((file) => file.id === nodeData.sourceFileID)
                ?.sheet_metas?.map((sheet) => {
                  return sheet.columns.map((column) => (
                    <CheckboxGroup.Item value={column} key={column}>
                      {column}
                    </CheckboxGroup.Item>
                  ));
                })}
          </CheckboxGroup.Root>
        </Flex>
      </Flex>
    </BaseNode>
  );
};
