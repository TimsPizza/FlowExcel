import useToast from "@/hooks/useToast";
import { useExecutePipelineMutation } from "@/hooks/workspaceQueries";
import { getAutoLayoutedElements } from "@/lib/flowLayout";
import {
  getInitialNodeData,
  isValidConnection,
  validateFlow,
} from "@/lib/flowValidation";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FlowNodeData, NodeType } from "@/types/nodes";
import { PlayIcon, PlusIcon, SizeIcon } from "@radix-ui/react-icons";
import { Flex, Popover, Select, Text } from "@radix-ui/themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactFlow, {
  Background,
  Connection,
  DefaultEdgeOptions,
  Edge,
  EdgeChange,
  EdgeRemoveChange,
  MarkerType,
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
  useReactFlow,
} from "reactflow";
import { v4 as uuidv4 } from "uuid";
import { FlowValidationPanel } from "./FlowValidationPanel";
import nodeTypes from "./nodes/NodeFactory";

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

const getNodeTypes = (t: any) => [
  { value: NodeType.INDEX_SOURCE, label: t("node.index_source") },
  { value: NodeType.SHEET_SELECTOR, label: t("node.sheet_selector") },
  { value: NodeType.ROW_FILTER, label: t("node.row_filter") },
  { value: NodeType.ROW_LOOKUP, label: t("node.row_lookup") },
  { value: NodeType.AGGREGATOR, label: t("node.aggregator") },
  { value: NodeType.OUTPUT, label: t("node.output") },
];

interface FlowEditorProps {
  initialNodes?: Node<FlowNodeData>[];
  initialEdges?: Edge[];
  workspaceId?: string;
}

// 默认边样式配置
const defaultEdgeOptions: DefaultEdgeOptions = {
  animated: true,
  style: {
    strokeWidth: 2,
    stroke: "#3b82f6", // 蓝色
  },
  markerEnd: {
    type: MarkerType.Arrow,
    width: 12,
    height: 12,
    color: "#3b82f6",
  },
};

// 内部FlowEditor组件，在ReactFlowProvider内部
export const FlowEditor: React.FC<FlowEditorProps> = ({ workspaceId }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const NODE_TYPES = getNodeTypes(t);
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
  const [layoutDirection, setLayoutDirection] = useState<"TB" | "LR">("LR");
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const activelyDraggedNodeId = useRef<string | null>(null);

  // 初始化或同步节点和边
  useEffect(() => {
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

    addFlowNode(newNode);
  }, [selectedNodeType, addFlowNode]);

  // 自动排版功能
  const handleAutoLayout = useCallback(
    (direction: "TB" | "LR" = layoutDirection) => {
      if (nodes.length === 0) {
        toast.warning(t("flow.no_nodes_to_layout"));
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
          t("flow.auto_layout_success", {
            direction:
              direction === "TB" ? t("flow.vertical") : t("flow.horizontal"),
          }),
        );
      } catch (error) {
        toast.error(
          t("flow.auto_layout_failed", { error: (error as Error).message }),
        );
        console.error("自动排版失败:", error);
      }
    },
    [nodes, edges, layoutDirection, setNodes, addFlowNode, fitView, toast],
  );

  // 处理节点变更并同步到zustand store
  const handleOnNodesChange: OnNodesChange = useCallback(
    (changes) => {
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
      // 验证连接是否有效
      const validation = isValidConnection(connection, nodes, edges);
      if (!validation.isValid) {
        toast.error(t("flow.connection_failed", { reason: validation.reason }));
        return;
      }

      onConnect(connection);
    },
    [onConnect, nodes, edges, toast],
  );

  // 执行流程前验证
  const runFlow = useCallback(() => {
    // 先验证流程
    const flowValidation = validateFlow(nodes, edges);

    if (!flowValidation.isValid) {
      toast.error(
        t("flow.validation_failed", {
          errors: flowValidation.errors.join(", "),
        }),
      );
      return;
    }

    if (!currentWorkspace) {
      toast.error(t("workspace.no_workspace_loaded"));
      return;
    }

    executePipelineMutation.mutate(
      {
        workspaceId: currentWorkspace.id,
        workspaceConfig: currentWorkspace,
        executionMode: "production",
      },
      {
        onSuccess: (result) => {
          // Handle the result based on the new response structure
          const pipelineResult = result;

          if (!pipelineResult || !pipelineResult.result.success) {
            toast.error(
              t("flow.execute_failed", {
                error: pipelineResult?.result?.error || t("error.unknown"),
              }),
            );
            return;
          }

          toast.success(
            t("flow.execute_success", {
              time: pipelineResult.execution_time?.toFixed(2),
            }),
          );
        },
        onError: (error) => {
          toast.error(t("flow.execute_failed", { error: error.message }));
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
        defaultEdgeOptions={defaultEdgeOptions}
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
          <Flex gap="2" align="center">
            <Popover.Root>
              <Popover.Trigger>
                <Button variant="soft" size="2">
                  <PlusIcon /> {t("flow.toolPanel")}
                </Button>
              </Popover.Trigger>
              <Popover.Content size="3" style={{ width: "320px" }}>
                <Flex direction="column" gap="3">
                  {/* 添加节点控件 */}
                  <Flex direction="column" gap="2">
                    <Text weight="bold" size="2">
                      {t("flow.addNode")}
                    </Text>
                    <Flex gap="2" align="center">
                      <Select.Root
                        value={selectedNodeType}
                        onValueChange={(value) =>
                          setSelectedNodeType(value as NodeType)
                        }
                      >
                        <Select.Trigger style={{ flex: 1 }} />
                        <Select.Content>
                          <Select.Group>
                            {NODE_TYPES.map((nodeType) => (
                              <Select.Item
                                key={nodeType.value}
                                value={nodeType.value}
                              >
                                {nodeType.label}
                              </Select.Item>
                            ))}
                          </Select.Group>
                        </Select.Content>
                      </Select.Root>
                      <Popover.Close>
                        <Button onClick={handleAddNode}>
                          <PlusIcon /> {t("common.add")}
                        </Button>
                      </Popover.Close>
                    </Flex>
                  </Flex>

                  {/* 分隔线 */}
                  <div style={{ height: "1px", background: "var(--gray-6)" }} />

                  {/* 自动排版控件 */}
                  <Flex direction="column" gap="2">
                    <Text weight="bold" size="2">
                      {t("flow.auto_layout")}
                    </Text>
                    <Flex gap="2" align="center">
                      <Select.Root
                        value={layoutDirection}
                        onValueChange={(value) =>
                          setLayoutDirection(value as "TB" | "LR")
                        }
                      >
                        <Select.Trigger style={{ flex: 1 }} />
                        <Select.Content>
                          <Select.Item value="LR">
                            {t("flow.horizontal")}
                          </Select.Item>
                          <Select.Item value="TB">
                            {t("flow.vertical")}
                          </Select.Item>
                        </Select.Content>
                      </Select.Root>
                      <Popover.Close>
                        <Button
                          variant="soft"
                          color="blue"
                          onClick={() => handleAutoLayout()}
                          disabled={nodes.length === 0}
                          title={t("flow.autoLayoutTooltip")}
                        >
                          <SizeIcon /> {t("flow.layout")}
                        </Button>
                      </Popover.Close>
                    </Flex>
                  </Flex>
                </Flex>
              </Popover.Content>
            </Popover.Root>

            <Button
              color="green"
              disabled={executePipelineMutation.isLoading}
              onClick={runFlow}
              size="2"
            >
              <PlayIcon />
              {executePipelineMutation.isLoading
                ? t("flow.executing")
                : t("flow.execute")}
            </Button>
          </Flex>
        </Panel>

        <Panel position="top-right">
          <FlowValidationPanel />
        </Panel>

        <Background />
      </ReactFlow>
    </div>
  );
};
