import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import {
  FlowNodeData,
  NodeType,
  IndexSourceNodeDataContext,
  SheetSelectorNodeDataContext,
  RowFilterNodeDataContext,
  RowLookupNodeDataContext,
  AggregatorNodeDataContext,
  OutputNodeDataContext,
} from "@/types/nodes";
import { FilePlusIcon, PlayIcon, PlusIcon } from "@radix-ui/react-icons";
import { Button, Dialog, Flex, Select, Text } from "@radix-ui/themes";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import ReactFlow, {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  Panel,
  useEdgesState,
  useNodesState,
  NodeSelectionChange,
  NodePositionChange,
  NodeDimensionChange,
  NodeChange,
  EdgeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import { v4 as uuidv4 } from "uuid";
import nodeTypes from "./NodeFactory";

function isNodePositionChange(
  change: NodeChange,
): change is NodePositionChange {
  return "position" in change;
}
function isNodeDimensionChange(
  change: NodeChange,
): change is NodeDimensionChange {
  return "dimensions" in change;
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
const getInitialNodeData = (type: NodeType): FlowNodeData => {
  switch (type) {
    case NodeType.INDEX_SOURCE:
      return {
        nodeType: NodeType.INDEX_SOURCE,
        label: "索引源",
        sourceFileID: undefined,
        sheetName: undefined,
        columnNames: undefined,
        testResult: undefined,
        error: undefined,
      } as IndexSourceNodeDataContext;
    case NodeType.SHEET_SELECTOR:
      return {
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
        nodeType: NodeType.ROW_FILTER,
        label: "行过滤",
        conditions: [],
        testResult: undefined,
        error: undefined,
      } as RowFilterNodeDataContext;
    case NodeType.ROW_LOOKUP:
      return {
        nodeType: NodeType.ROW_LOOKUP,
        label: "行查找/列匹配",
        matchColumn: undefined,
        testResult: undefined,
        error: undefined,
      } as RowLookupNodeDataContext;
    case NodeType.AGGREGATOR:
      return {
        nodeType: NodeType.AGGREGATOR,
        label: "统计",
        statColumn: undefined,
        method: "sum",
        testResult: undefined,
        error: undefined,
      } as AggregatorNodeDataContext;
    case NodeType.OUTPUT:
      return {
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

export const FlowEditor: React.FC<FlowEditorProps> = ({ workspaceId }) => {
  const addFlowNode = useWorkspaceStore((state) => state.addFlowNode);
  const updateNodeData = useWorkspaceStore((state) => state.updateNodeData);
  const onConnect = useWorkspaceStore((state) => state.onConnect);
  const wsFlowNodes = useWorkspaceStore(
    (state) => state.currentWorkspace?.flow_nodes,
  );
  const wsFlowEdges = useWorkspaceStore(
    (state) => state.currentWorkspace?.flow_edges,
  );
  const [nodes, setNodes, rfOnNodesChange] = useNodesState<FlowNodeData>([]);
  const [edges, setEdges, rfOnEdgesChange] = useEdgesState([]);
  const [selectedNodeType, setSelectedNodeType] = useState<NodeType>(
    NodeType.INDEX_SOURCE,
  );
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [isRunning, setIsRunning] = useState(false);

  // 初始化或同步节点和边
  useEffect(() => {
    console.log(
      "FlowEditor sync zustand store to reactflow nodes",
      wsFlowNodes,
    );
    if (wsFlowNodes) {
      const correctlyTypedNodes = wsFlowNodes.map(node => ({
        ...node,
        data: node.data,
      }));
      setNodes(correctlyTypedNodes);
    } else {
      setNodes([]);
    }
  }, [wsFlowNodes]);

  useEffect(() => {
    console.log(
      "FlowEditor sync zustand store to reactflow edges",
      wsFlowEdges,
    );
    setEdges(wsFlowEdges || []);
  }, [wsFlowEdges]);

  // 添加节点
  const handleAddNode = useCallback(() => {
    const id = uuidv4();
    const nodeData = getInitialNodeData(selectedNodeType);

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

  // 处理节点变更并同步到zustand store
  const handleOnNodesChange: OnNodesChange = useCallback(
    (changes) => {
      console.log("FlowEditor handleOnNodesChanges", changes);
      rfOnNodesChange(changes);

      changes.forEach((change) => {
        if (isNodePositionChange(change) && change.position && change.type === "position") {
          const nodeToUpdate = nodes.find((n) => n.id === change.id);
          if (nodeToUpdate) {
            const updatedNode: Node<FlowNodeData> = {
              ...nodeToUpdate,
              position: change.position,
            };
            addFlowNode(updatedNode);
          }
        }
      });
    },
    [rfOnNodesChange, nodes, addFlowNode],
  );

  // Update ReactFlow component to use our handler
  // const onNodesChange = handleOnNodesChange;

  // Update handleOnEdgesChange to better handle edge changes
  const handleOnEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      console.log("FlowEditor handleOnEdgesChange", changes);

      // Apply changes to local ReactFlow state
      rfOnEdgesChange(changes);

      // Process changes if needed - can sync to backend/storage if required
      // For now, we're just letting useEffect handle syncing edges to the workspace
    },
    [rfOnEdgesChange],
  );

  // just call zustand store onConnect as changes are handled by useEffect
  const handleOnConnect: OnConnect = useCallback(
    (connection: Connection) => {
      console.log("FlowEditor handleOnConnect", connection);
      onConnect(connection);
    },
    [onConnect],
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
  }, [templateName, nodes, edges, workspaceId]);

  // 执行流程
  const runFlow = useCallback(async () => {
    try {
      if (nodes.length === 0) {
        toast.error("流程为空，请先添加节点");
        return;
      }

      setIsRunning(true);

      // 转换节点和边为后端所需格式
      const nodeConfigs = nodes.map((node) => ({
        id: node.id,
        type: node.type,
        data: node.data,
      }));

      const edgeConfigs = edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
      }));

      // 调用后端API执行流程
      const result = await invoke("execute_flow", {
        nodes: nodeConfigs,
        edges: edgeConfigs,
      });

      // 更新节点结果和状态
      if (result && typeof result === "object") {
        const resultsMap = result as Record<string, any>;

        setNodes(
          nodes.map((node) => {
            const nodeResult = resultsMap[node.id];
            if (nodeResult) {
              return {
                ...node,
                data: {
                  ...node.data,
                  testResult: nodeResult.result,
                  error: nodeResult.error || undefined,
                },
              };
            }
            return node;
          }),
        );
      }

      toast.success("流程执行完成");
    } catch (error) {
      console.error("流程执行失败:", error);
      toast.error("流程执行失败");
    } finally {
      setIsRunning(false);
    }
  }, [nodes, edges, setNodes]);

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
      >
        <Panel position="top-left">
          <Flex gap="2" align="center">
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
            <Button color="green" disabled={isRunning} onClick={runFlow}>
              <PlayIcon /> {isRunning ? "执行中..." : "执行流程"}
            </Button>
            <Button
              variant="soft"
              onClick={() => setIsTemplateDialogOpen(true)}
            >
              <FilePlusIcon /> 保存为模板
            </Button>
          </Flex>
        </Panel>

        <Controls />
        {/* <MiniMap /> */}
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
