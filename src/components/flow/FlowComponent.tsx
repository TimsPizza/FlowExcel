import { AssociationNode } from "@/components/flow/AssociationNode";
import PrimarySourceNode from "@/components/flow/PrimarySourceNode";
import { AssociationNodeData, WorkspaceConfig } from "@/types";
import { useCallback } from "react";
import {
  Background,
  Connection,
  Controls,
  EdgeChange,
  MiniMap,
  Node,
  NodeChange,
  useReactFlow,
} from "reactflow";

import { ReactFlow } from "reactflow";
import { v4 as uuidv4 } from "uuid";

const nodeTypes = {
  primarySource: PrimarySourceNode,
  associationNode: AssociationNode,
};

export const FlowComponent = ({
  currentWorkspace,
  onNodesChange,
  onEdgesChange,
  storeOnConnect,
  addFlowNode,
}: {
  currentWorkspace: WorkspaceConfig;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  storeOnConnect: (conn: Connection) => void;
  addFlowNode: (node: Node<AssociationNodeData>) => void;
}) => {
  const reactFlowInstance = useReactFlow();

  const onConnect = useCallback(
    (connection: Connection) => {
      storeOnConnect(connection);

      if (
        connection.source &&
        connection.sourceHandle &&
        connection.sourceHandle.startsWith("output-")
      ) {
        const sourceNode = reactFlowInstance.getNode(connection.source);
        if (sourceNode && sourceNode.type === "primarySource") {
          const incomingIndexName = connection.sourceHandle.substring(
            "output-".length,
          );
          const newNodeX =
            sourceNode.position.x + (sourceNode.width || 150) + 150;
          const newNodeY = sourceNode.position.y;

          const newNode: Node<AssociationNodeData> = {
            id: uuidv4(),
            type: "associationNode",
            position: { x: newNodeX, y: newNodeY },
            data: { incomingIndexName },
          };

          addFlowNode(newNode);
        }
      }
    },
    [addFlowNode, storeOnConnect, reactFlowInstance],
  );

  return (
    <ReactFlow
      nodes={currentWorkspace?.flow_nodes}
      edges={currentWorkspace?.flow_edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      fitView
      className="bg-gradient-to-br from-blue-50 via-white to-blue-50"
    >
      <Controls />
      <MiniMap nodeStrokeWidth={3} zoomable pannable />
      <Background color="#ddd" gap={16} />
    </ReactFlow>
  );
};
