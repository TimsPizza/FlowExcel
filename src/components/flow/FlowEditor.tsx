import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import {
  AggregatorNodeDataContext,
  FlowNodeData,
  IndexSourceNodeDataContext,
  NodeType,
  OutputNodeDataContext,
  RowFilterNodeDataContext,
  RowLookupNodeDataContext,
  SheetSelectorNodeDataContext,
} from "@/types/nodes";
import { SimpleDataframe } from "@/types";
import {
  FilePlusIcon,
  PlayIcon,
  PlusIcon,
  SizeIcon,
} from "@radix-ui/react-icons";
import { Button, Dialog, Flex, Select, Text } from "@radix-ui/themes";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Connection,
  Edge,
  EdgeChange,
  EdgeRemoveChange,
  Node,
  NodeChange,
  NodePositionChange,
  NodeSelectionChange,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  Panel,
  useEdgesState,
  useNodesState,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import { v4 as uuidv4 } from "uuid";
import nodeTypes from "./nodes/NodeFactory";
import { useExecutePipelineMutation } from "@/hooks/workspaceQueries";
import useToast from "@/hooks/useToast";
import { isValidConnection, validateFlow } from "@/lib/flowValidation";
import { FlowValidationPanel } from "./FlowValidationPanel";
import { getAutoLayoutedElements } from "@/lib/flowLayout";

function isNodePositionChange(
  change: NodeChange,
): change is NodePositionChange {
  return "position" in change;
}
function isNodeSelectionChange(
  change: NodeChange,
): change is NodeSelectionChange {
  return "selected" in change;
}
function isEdgeOnRemove(change: EdgeChange): change is EdgeRemoveChange {
  return "type" in change && change.type === "remove";
}

const NODE_TYPES = [
  { value: NodeType.INDEX_SOURCE, label: "索引源" },
  { value: NodeType.SHEET_SELECTOR, label: "Sheet定位" },
  { value: NodeType.ROW_FILTER, label: "行过滤" },
  { value: NodeType.ROW_LOOKUP, label: "行查找/列匹配" },
  { value: NodeType.AGGREGATOR, label: "统计" },
  { value: NodeType.OUTPUT, label: "输出" },
];

// 初始节点默认数据
const getInitialNodeData = (type: NodeType, nodeId: string): FlowNodeData => {
  switch (type) {
    case NodeType.INDEX_SOURCE:
      return {
        id: nodeId,
        nodeType: NodeType.INDEX_SOURCE,
        label: "索引源",
        sourceFileID: undefined,
        bySheetName: false,
        sheetName: undefined,
        byColumn: true,
        columnName: "",
        testResult: undefined,
        error: undefined,
      } as IndexSourceNodeDataContext;
    case NodeType.SHEET_SELECTOR:
      return {
        id: nodeId,
        nodeType: NodeType.SHEET_SELECTOR,
        label: "Sheet定位",
        targetFileID: undefined,
        mode: "auto_by_index",
        manualSheetName: undefined,
        testResult: undefined,
        error: undefined,
      } as SheetSelectorNodeDataContext;
    case NodeType.ROW_FILTER:
      return {
        id: nodeId,
        nodeType: NodeType.ROW_FILTER,
        label: "行过滤",
        conditions: [],
        testResult: undefined,
        error: undefined,
      } as RowFilterNodeDataContext;
    case NodeType.ROW_LOOKUP:
      return {
        id: nodeId,
        nodeType: NodeType.ROW_LOOKUP,
        label: "行查找/列匹配",
        matchColumn: undefined,
        testResult: undefined,
        error: undefined,
      } as RowLookupNodeDataContext;
    case NodeType.AGGREGATOR:
      return {
        id: nodeId,
        nodeType: NodeType.AGGREGATOR,
        label: "统计/聚合",
        statColumn: undefined,
        method: "sum",
        outputAs: "",
        testResult: undefined,
        error: undefined,
      } as AggregatorNodeDataContext;
    case NodeType.OUTPUT:
      return {
        id: nodeId,
        nodeType: NodeType.OUTPUT,
        label: "输出",
        outputFormat: "table",
        testResult: undefined,
        error: undefined,
      } as OutputNodeDataContext;
  }
};

interface FlowEditorProps {
  initialNodes?: Node<FlowNodeData>[];
  initialEdges?: Edge[];
  workspaceId?: string;
}

// 内部FlowEditor组件，在ReactFlowProvider内部
const FlowEditorInner: React.FC<FlowEditorProps> = ({ workspaceId }) => {
  const toast = useToast();
  const addFlowNode = useWorkspaceStore((state) => state.addFlowNode);
  const updateNodeData = useWorkspaceStore((state) => state.updateNodeData);
  const onConnect = useWorkspaceStore((state) => state.onConnect);
  const removeFlowEdge = useWorkspaceStore((state) => state.removeFlowEdge);
  const wsFlowNodes = useWorkspaceStore(
    (state) => state.currentWorkspace?.flow_nodes,
  );
  const wsFlowEdges = useWorkspaceStore(
    (state) => state.currentWorkspace?.flow_edges,
  );
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);

  const executePipelineMutation = useExecutePipelineMutation();
  const { fitView } = useReactFlow();

  const [nodes, setNodes, rfOnNodesChange] = useNodesState<FlowNodeData>([]);
  const [edges, setEdges, rfOnEdgesChange] = useEdgesState([]);
  const [selectedNodeType, setSelectedNodeType] = useState<NodeType>(
    NodeType.INDEX_SOURCE,
  );
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [layoutDirection, setLayoutDirection] = useState<"TB" | "LR">("LR");
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const activelyDraggedNodeId = useRef<string | null>(null);

  // 初始化或同步节点和边
  useEffect(() => {
    console.log(
      "FlowEditor sync zustand store to reactflow nodes",
      wsFlowNodes,
    );
    if (wsFlowNodes) {
      const correctlyTypedNodes = wsFlowNodes.map((node) => ({
        ...node,
        data: node.data,
      }));
      setNodes(correctlyTypedNodes);
    } else {
      setNodes([]);
    }
  }, [wsFlowNodes, setNodes]);

  useEffect(() => {
    console.log(
      "FlowEditor sync zustand store to reactflow edges",
      wsFlowEdges,
    );
    setEdges(wsFlowEdges || []);
  }, [wsFlowEdges, setEdges]);

  // 添加节点
  const handleAddNode = useCallback(() => {
    const id = uuidv4();
    const nodeData = getInitialNodeData(selectedNodeType, id);

    const randomPosition = {
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
    };

    const newNode: Node<FlowNodeData> = {
      id: id,
      type: selectedNodeType,
      position: randomPosition,
      data: nodeData,
    };

    console.log("Adding new node:", newNode);
    addFlowNode(newNode);
  }, [selectedNodeType, addFlowNode]);

  // 自动排版功能
  const handleAutoLayout = useCallback(
    (direction: "TB" | "LR" = layoutDirection) => {
      if (nodes.length === 0) {
        toast.warning("没有节点需要排版");
        return;
      }

      try {
        // 使用Dagre算法进行自动排版
        const layoutedNodes = getAutoLayoutedElements(nodes, edges, direction);

        // 更新节点位置
        setNodes(layoutedNodes);

        // 同步更新到工作区store
        layoutedNodes.forEach((node) => {
          addFlowNode(node);
        });

        // 调整视图以适应新的布局
        setTimeout(() => {
          fitView({ duration: 500 });
        }, 100);

        toast.success(
          `已使用${direction === "TB" ? "垂直" : "水平"}布局重新排版`,
        );
      } catch (error) {
        console.error("自动排版失败:", error);
        toast.error("自动排版失败，请检查节点连接是否正确");
      }
    },
    [nodes, edges, layoutDirection, setNodes, addFlowNode, fitView, toast],
  );

  // 处理节点变更并同步到zustand store
  const handleOnNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // console.log("FlowEditor handleOnNodesChanges", changes);
      rfOnNodesChange(changes);

      changes.forEach((change) => {
        if (
          isNodePositionChange(change) &&
          change.position &&
          change.type === "position"
        ) {
          if (
            change.id === activelyDraggedNodeId.current ||
            !activelyDraggedNodeId.current
          ) {
            const nodeFromRfState = nodes.find((n) => n.id === change.id);
            if (nodeFromRfState) {
              const updatedNode: Node<FlowNodeData> = {
                ...nodeFromRfState,
                position: change.position,
              };
              addFlowNode(updatedNode);
            }
          }
        } else if (isNodeSelectionChange(change)) {
          const nodeFromRfState = nodes.find((n) => n.id === change.id);
          if (nodeFromRfState) {
            const updatedNode: Node<FlowNodeData> = {
              ...nodeFromRfState,
              selected: change.selected,
            };
            addFlowNode(updatedNode);
          }
        }
      });
    },
    [rfOnNodesChange, nodes, addFlowNode],
  );

  // Update handleOnEdgesChange to better handle edge changes
  const handleOnEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      console.log("FlowEditor handleOnEdgesChange", changes);

      // Apply changes to local ReactFlow state
      rfOnEdgesChange(changes);

      changes.forEach((change) => {
        if (isEdgeOnRemove(change)) {
          const edgeFromRfState = edges.find((e) => e.id === change.id);
          if (edgeFromRfState) {
            removeFlowEdge(edgeFromRfState.id);
          }
        }
      });
    },
    [rfOnEdgesChange, edges, removeFlowEdge],
  );

  // just call zustand store onConnect as changes are handled by useEffect
  const handleOnConnect: OnConnect = useCallback(
    (connection: Connection) => {
      console.log("FlowEditor handleOnConnect", connection);

      // 验证连接是否有效
      const validation = isValidConnection(connection, nodes, edges);
      if (!validation.isValid) {
        toast.error(`连接失败: ${validation.reason}`);
        return;
      }

      onConnect(connection);
    },
    [onConnect, nodes, edges, toast],
  );

  // 保存为模板
  const saveAsTemplate = useCallback(async () => {
    if (!templateName.trim()) {
      toast.error("请输入模板名称");
      return;
    }

    try {
      await invoke("save_flow_template", {
        name: templateName,
        nodes,
        edges,
        workspaceId,
      });

      toast.success("模板保存成功");
      setIsTemplateDialogOpen(false);
      setTemplateName("");
    } catch (error) {
      console.error("保存模板失败:", error);
      toast.error("保存模板失败");
    }
  }, [templateName, nodes, edges, workspaceId, toast]);

  // 执行流程前验证
  const runFlow = useCallback(() => {
    // 先验证流程
    const flowValidation = validateFlow(nodes, edges);

    if (!flowValidation.isValid) {
      toast.error(`流程验证失败: ${flowValidation.errors.join(", ")}`);
      return;
    }

    // 显示警告（如果有）
    if (flowValidation.warnings.length > 0) {
      toast.warning(`流程警告: ${flowValidation.warnings.join(", ")}`);
    }

    const outputNodes = nodes.filter(
      (node) => node.data.nodeType === NodeType.OUTPUT,
    );

    if (outputNodes.length === 0) {
      toast.error("流程中必须包含至少一个输出节点");
      return;
    }

    if (!currentWorkspace) {
      toast.error("未找到当前工作区");
      return;
    }

    // 使用第一个输出节点作为目标节点
    const targetNodeId = outputNodes[0].id;

    executePipelineMutation.mutate(
      {
        workspaceId: currentWorkspace.id,
        targetNodeId: targetNodeId,
        executionMode: "production",
      },
      {
        onSuccess: (result) => {
          // Handle the result based on the new response structure
          // result is already the inner execution result data
          const pipelineResult = result;

          if (!pipelineResult.success) {
            toast.error(`流程执行失败: ${pipelineResult.error || "未知错误"}`);
            return;
          }

          // 更新节点的结果数据
          const updatedNodes = nodes.map((node) => {
            const nodeResults = pipelineResult.results[node.id];
            if (nodeResults && nodeResults.length > 0) {
              // 根据节点类型处理结果数据
              switch (node.data.nodeType) {
                case NodeType.INDEX_SOURCE: {
                  // 索引源节点的结果是索引值列表
                  const nodeResult = nodeResults[0]; // 索引源节点只有一个结果
                  if (nodeResult.result_data) {
                    const { columns, data } = nodeResult.result_data;

                    // 将数据转换为前端需要的格式
                    const formattedData = [];
                    if (data && data.length > 0) {
                      // 如果是按列索引，提取唯一值
                      if (
                        (node.data as IndexSourceNodeDataContext).byColumn &&
                        columns.length > 0
                      ) {
                        const columnName = columns[0];
                        const uniqueValues = [
                          ...new Set(
                            data.map(
                              (row: Record<string, any>) => row[columnName],
                            ),
                          ),
                        ];
                        formattedData.push(uniqueValues);
                      }
                      // 如果是按工作表名索引
                      else if (
                        (node.data as IndexSourceNodeDataContext).bySheetName
                      ) {
                        formattedData.push(
                          data.map(
                            (row: Record<string, any>) => Object.values(row)[0],
                          ),
                        );
                      }
                    }

                    return {
                      ...node,
                      data: {
                        ...node.data,
                        testResult: {
                          columns,
                          data: formattedData,
                        },
                        error: undefined,
                      },
                    };
                  }
                  break;
                }
                case NodeType.AGGREGATOR: {
                  // 聚合节点的结果是多个索引值的聚合结果
                  const formattedData: any[][] = [];
                  let columns: string[] = ["索引值", "聚合结果"];

                  nodeResults.forEach((nodeResult: any) => {
                    if (nodeResult.result_data && nodeResult.result_data.data) {
                      const resultData = nodeResult.result_data.data;
                      if (resultData.length > 0) {
                        resultData.forEach((row: Record<string, any>) => {
                          // 对于聚合节点，通常结果是索引值和聚合结果
                          const indexValue = row.index_value || "";
                          const resultValue = row.result || 0;
                          formattedData.push([indexValue, resultValue]);
                        });
                      }
                    }
                  });

                  // 使用实际的输出列名
                  if (
                    nodeResults.length > 0 &&
                    nodeResults[0].result_data?.data?.length > 0
                  ) {
                    const firstRow = nodeResults[0].result_data.data[0];
                    const outputColumnName =
                      firstRow.output_column_name ||
                      `${(node.data as AggregatorNodeDataContext).method}_${(node.data as AggregatorNodeDataContext).statColumn}`;
                    columns = ["索引值", outputColumnName];
                  }

                  return {
                    ...node,
                    data: {
                      ...node.data,
                      testResult: {
                        columns,
                        data: formattedData,
                      },
                      error: undefined,
                    },
                  };
                }
                default: {
                  // 其他节点类型的通用处理
                  // 合并所有索引值的结果用于预览
                  const combinedData: any[][] = [];
                  let columns: string[] = [];

                  nodeResults.forEach((nodeResult: any) => {
                    if (nodeResult.result_data && nodeResult.result_data.data) {
                      // 获取列名（只需要第一次）
                      if (
                        columns.length === 0 &&
                        nodeResult.result_data.columns
                      ) {
                        columns = nodeResult.result_data.columns;
                      }

                      // 转换数据为二维数组格式
                      nodeResult.result_data.data.forEach(
                        (row: Record<string, any>) => {
                          const rowArray = columns.map((col) => row[col]);
                          combinedData.push(rowArray);
                        },
                      );
                    }
                  });

                  return {
                    ...node,
                    data: {
                      ...node.data,
                      testResult: {
                        columns,
                        data: combinedData,
                      } as SimpleDataframe,
                      error: undefined,
                    },
                  };
                }
              }
            }

            // 如果没有结果或处理失败，返回错误状态
            return {
              ...node,
              data: {
                ...node.data,
                testResult: undefined,
                error: "无结果数据",
              },
            };
          });

          setNodes(updatedNodes);

          // 同步更新到工作区store
          updatedNodes.forEach((node) => {
            updateNodeData(node.id, node.data);
          });

          toast.success("流程执行完成");
        },
        onError: (error) => {
          toast.error(`流程执行失败: ${error.message}`);
        },
      },
    );
  }, [
    nodes,
    edges,
    currentWorkspace,
    executePipelineMutation,
    setNodes,
    updateNodeData,
    toast,
  ]);

  return (
    <div style={{ width: "100%", height: "100%" }} ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleOnNodesChange}
        onEdgesChange={handleOnEdgesChange}
        onConnect={handleOnConnect}
        nodeTypes={nodeTypes}
        fitView
        nodeDragThreshold={10}
        onNodeDragStart={(_event, node) => {
          activelyDraggedNodeId.current = node.id;
        }}
        onNodeDragStop={() => {
          activelyDraggedNodeId.current = null;
        }}
      >
        <Panel position="top-left">
          <Flex gap="2" align="center" wrap="wrap">
            <Text weight="bold">添加节点:</Text>
            <Select.Root
              value={selectedNodeType}
              onValueChange={(value) => setSelectedNodeType(value as NodeType)}
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Group>
                  {NODE_TYPES.map((nodeType) => (
                    <Select.Item key={nodeType.value} value={nodeType.value}>
                      {nodeType.label}
                    </Select.Item>
                  ))}
                </Select.Group>
              </Select.Content>
            </Select.Root>
            <Button onClick={handleAddNode}>
              <PlusIcon /> 添加
            </Button>

            {/* 自动排版控件 */}
            <Flex gap="1" align="center">
              <Text size="2" weight="medium">
                排版:
              </Text>
              <Select.Root
                value={layoutDirection}
                onValueChange={(value) =>
                  setLayoutDirection(value as "TB" | "LR")
                }
              >
                <Select.Trigger style={{ minWidth: "80px" }} />
                <Select.Content>
                  <Select.Item value="LR">水平</Select.Item>
                  <Select.Item value="TB">垂直</Select.Item>
                </Select.Content>
              </Select.Root>
              <Button
                variant="soft"
                color="blue"
                onClick={() => handleAutoLayout()}
                disabled={nodes.length === 0}
                title="根据节点连接关系自动排版"
              >
                <SizeIcon /> 自动排版
              </Button>
            </Flex>

            <Button
              color="green"
              disabled={executePipelineMutation.isLoading}
              onClick={runFlow}
            >
              <PlayIcon />{" "}
              {executePipelineMutation.isLoading ? "执行中..." : "执行流程"}
            </Button>
            <Button
              variant="soft"
              onClick={() => setIsTemplateDialogOpen(true)}
            >
              <FilePlusIcon /> 保存为模板
            </Button>
          </Flex>
        </Panel>

        <Panel position="top-right">
          <FlowValidationPanel />
        </Panel>

        <Background />
      </ReactFlow>

      <Dialog.Root
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
      >
        <Dialog.Content style={{ maxWidth: 400 }}>
          <Dialog.Title>保存为模板</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            将当前流程保存为可复用的模板
          </Dialog.Description>

          <Flex direction="column" gap="3">
            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                模板名称
              </Text>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid var(--gray-6)",
                }}
              />
            </label>
          </Flex>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                取消
              </Button>
            </Dialog.Close>
            <Button onClick={saveAsTemplate}>保存</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
};

// 外部导出的组件，用ReactFlowProvider包装
export const FlowEditor: React.FC<FlowEditorProps> = (props) => {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  );
};
