import {
  useGetIndexValues,
  useTryReadHeaderRow,
} from "@/hooks/workspaceQueries";
import { fileSelector, useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FlowNodeProps, IndexSourceNodeDataContext } from "@/types/nodes";
import {
  CheckboxGroup,
  Flex,
  Grid,
  ScrollArea,
  Select,
  Text,
} from "@radix-ui/themes";
import _ from "lodash";
import { useEffect } from "react";
import { useNodeId } from "reactflow";
import { useShallow } from "zustand/react/shallow";
import { BaseNode } from "./BaseNode";

export const IndexSourceNode: React.FC<FlowNodeProps> = ({ data }) => {
  const nodeId = useNodeId()!;
  const nodeData = data as IndexSourceNodeDataContext;
  const { files } = useWorkspaceStore(useShallow(fileSelector));
  const updateIndexSourceNodeData = useWorkspaceStore(
    (state) => state.updateNodeData,
  );
  const { headerRow, isHeaderRowLoading, headerRowError } = useTryReadHeaderRow(
    files!.find((file) => file.id === nodeData.sourceFileID)?.path || "",
    nodeData.sheetName || "",
    nodeData.sheetName
      ? files!
          .find((file) => file.id === nodeData.sourceFileID)
          ?.sheet_metas.find((sheet) => sheet.sheet_name === nodeData.sheetName)
          ?.header_row || 0
      : 0,
  );
  const {
    indexValuesArr: indexValues,
    isIndexValuesLoading,
    indexValuesError,
  } = useGetIndexValues(
    // suppress type error
    files!.find((file) => file.id === nodeData.sourceFileID)?.path || "",
    nodeData.sheetName || "",
    nodeData.columnNames || [],
  );

  const handleSelectFile = async (fileId: string) => {
    console.log("index source node handleSelectFile", fileId);
    try {
      updateIndexSourceNodeData(nodeId, {
        sourceFileID: fileId,
        error: undefined,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectSheet = async (sheetName: string) => {
    try {
      updateIndexSourceNodeData(nodeId, {
        sheetName,
        columnNames: undefined,
        error: undefined,
      });
    } catch (error) {
      console.error(error);
    }
  };

  // show index values of current settings, render is handled by BaseNode.tsx
  const testRun = async () => {
    try {
      if (
        !nodeData.sourceFileID ||
        !nodeData.sheetName ||
        !nodeData.columnNames
      ) {
        updateIndexSourceNodeData(nodeId, { error: "请完成所有配置后再测试" });
        return;
      }

      updateIndexSourceNodeData(nodeId, {
        testResult: {
          columns: indexValues?.map((item) => item.column) || [],
          data: _.zip(...(indexValues?.map((item) => item.data) || [])),
        },
        error: undefined,
      });
    } catch (error) {
      console.error("测试运行失败:", error);
      updateIndexSourceNodeData(nodeId, { error: "测试运行失败" });
    }
  };

  return (
    <BaseNode
      data={nodeData}
      isSource={true}
      isTarget={false}
      onTestRun={testRun}
      testable
    >
      <Flex direction="column" gap="2">
        <Flex align="center" gap="2">
          <Text size="1" weight="bold">
            源文件:
          </Text>
          <Select.Root
            onValueChange={(v) => handleSelectFile(v)}
            defaultValue={nodeData.sourceFileID || "选择文件"}
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
            <Select.Trigger />
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
          <ScrollArea className="react-flow__node-scrollable max-h-40">
            <CheckboxGroup.Root
              size="1"
              value={nodeData.columnNames ?? []}
              defaultValue={[]}
              onValueChange={(columnNames) =>
                updateIndexSourceNodeData(nodeId, {
                  columnNames: columnNames,
                  error: undefined,
                })
              }
            >
              <Grid columns="2" gap="1">
                {nodeData.sheetName &&
                  files &&
                  files.length > 0 &&
                  headerRow?.column_names.map((column) => {
                    return (
                      <CheckboxGroup.Item value={column} key={column}>
                        {column}
                      </CheckboxGroup.Item>
                    );
                  })}
              </Grid>
            </CheckboxGroup.Root>
          </ScrollArea>
        </Flex>
      </Flex>
    </BaseNode>
  );
};
