import TextModal from "@/components/flow/HelpModal";
import {
  getAvailableNextNodeTypes,
  getInitialNodeData,
  NODE_TYPE_DESCRIPTIONS,
  NODE_TYPE_NAMES,
} from "@/lib/flowValidation";
import TestRunModal from "@/components/flow/TestRunModal";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { CustomNodeBaseData, NodeType } from "@/types/nodes";
import { PlusIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Badge, Box, Flex, Grid, Select, Text } from "@radix-ui/themes";
import { useCallback, useState } from "react";
import { Handle, Position, useReactFlow } from "reactflow";
import { v4 as uuidv4 } from "uuid";

export interface BadgeConfig {
  color:
    | "red"
    | "green"
    | "yellow"
    | "blue"
    | "purple"
    | "orange"
    | "pink"
    | "brown"
    | "gray";
  variant: "soft" | "outline" | "solid" | "surface";
  label: string;
}

interface EnhancedBaseNodeProps {
  data: CustomNodeBaseData;
  children: React.ReactNode;
  isSource?: boolean;
  isTarget?: boolean;
  onTestRun?: () => void;
  onNodeDelete?: () => void;
  testable?: boolean;
  badges?: BadgeConfig[];
}

export const EnhancedBaseNode: React.FC<EnhancedBaseNodeProps> = ({
  data,
  children,
  isSource = false,
  isTarget = true,
  onTestRun,
  testable = false,
  badges = [],
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [selectedNodeType, setSelectedNodeType] = useState<NodeType | null>(
    null,
  );

  const removeFlowNode = useWorkspaceStore((state) => state.removeFlowNode);
  const addFlowNode = useWorkspaceStore((state) => state.addFlowNode);
  const onConnect = useWorkspaceStore((state) => state.onConnect);
  const updateNodeData = useWorkspaceStore((state) => state.updateNodeData);

  const { getNodes, getEdges, setNodes } = useReactFlow();
  const nodes = getNodes();
  const edges = getEdges();

  // 获取可创建的后续节点类型
  const availableNodeTypes = getAvailableNextNodeTypes(data.id, nodes, edges);

  // 创建新节点并连接
  const handleCreateNode = useCallback(
    (nodeType: NodeType) => {
      const newNodeId = uuidv4();
      const nodeData = getInitialNodeData(nodeType, newNodeId);

      // 计算新节点位置（在当前节点右侧）
      const currentNode = nodes.find((n) => n.id === data.id);
      const position = currentNode
        ? {
            x: currentNode.position.x + 300,
            y: currentNode.position.y + (Math.random() - 0.5) * 100,
          }
        : { x: 300, y: 100 };

      const newNode = {
        id: newNodeId,
        type: nodeType,
        position,
        data: nodeData,
      };

      // 添加节点
      addFlowNode(newNode);

      // 创建连接
      const connection = {
        source: data.id,
        target: newNodeId,
        sourceHandle: null,
        targetHandle: null,
      };
      onConnect(connection);

      setShowCreateMenu(false);
      setSelectedNodeType(null);
    },
    [data.id, nodes, addFlowNode, onConnect],
  );

  const handleSelect = () => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === data.id
          ? { ...node, selected: true }
          : { ...node, selected: false },
      ),
    );
  };

  return (
    <>
      <Flex
        direction="column"
        gap="2"
        className="min-w-[200px] max-w-[15rem] rounded-md border border-gray-200 bg-white p-2 shadow-sm"
        onClick={handleSelect}
      >
        <Flex justify="between" align="center" mb="1">
          <Flex
            direction="column"
            gap="1"
            align="start"
            justify="start"
            className="mt-1 self-start"
          >
            <Text weight="bold" size="2">
              {data.label}
            </Text>

            {badges.map((badge) => (
              <Badge
                key={badge.label}
                color={badge.color}
                variant={badge.variant}
                className="max-w-20 overflow-clip text-ellipsis whitespace-nowrap text-xs"
              >
                {badge.label}
              </Badge>
            ))}

            {data.error && (
              <TextModal
                buttonColor="red"
                content={data.error}
                label="!"
                title="错误"
                buttonVariant="outline"
              />
            )}
          </Flex>
          <Grid columns="2" gap="1" align="center">
            <Button
              color="red"
              size="1"
              className="cursor-pointer"
              onClick={() => removeFlowNode(data.id)}
            >
              删除
            </Button>
            {testable && (
              <TestRunModal
                runResult={data.testResult}
                onTestRun={onTestRun}
                onClose={() => {
                  updateNodeData(data.id, { testResult: undefined });
                }}
                error={data.error}
              />
            )}
            <TextModal
              content={NODE_TYPE_DESCRIPTIONS[data.nodeType as NodeType]}
              label="帮助"
            />
            <Button
              color="gray"
              size="1"
              className="cursor-pointer"
              onClick={() => {
                setExpanded(!expanded);
              }}
            >
              {expanded ? "收起" : "展开"}
            </Button>
          </Grid>
        </Flex>

        {expanded && (
          <Box className="max-w-[14rem] rounded-md bg-[var(--accent-2)] p-2">
            {children}
          </Box>
        )}

        {/* 从输出端点创建新节点的按钮 */}
        {isSource && availableNodeTypes.length > 0 && (
          <Flex direction="column" gap="2" mt="2">
            {!showCreateMenu ? (
              <Button
                size="1"
                variant="soft"
                onClick={() => setShowCreateMenu(true)}
                className="self-end"
              >
                <PlusIcon /> 添加后续节点
              </Button>
            ) : (
              <Flex direction="column" gap="2">
                <Text size="1" weight="medium">
                  选择节点类型:
                </Text>
                <Select.Root
                  value={selectedNodeType || ""}
                  onValueChange={(value) =>
                    setSelectedNodeType(value as NodeType)
                  }
                >
                  <Select.Trigger />
                  <Select.Content>
                    {availableNodeTypes.map((nodeType) => (
                      <Select.Item key={nodeType} value={nodeType}>
                        {NODE_TYPE_NAMES[nodeType]}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
                <Flex gap="1">
                  <Button
                    size="1"
                    disabled={!selectedNodeType}
                    onClick={() =>
                      selectedNodeType && handleCreateNode(selectedNodeType)
                    }
                  >
                    创建
                  </Button>
                  <Button
                    size="1"
                    variant="soft"
                    onClick={() => {
                      setShowCreateMenu(false);
                      setSelectedNodeType(null);
                    }}
                  >
                    取消
                  </Button>
                </Flex>
              </Flex>
            )}
          </Flex>
        )}
      </Flex>

      {/* 连接点 */}
      {isTarget && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: "#555",
            width: 10,
            height: 10,
            border: "2px solid #fff",
          }}
        />
      )}

      {isSource && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: "#555",
            width: 10,
            height: 10,
            border: "2px solid #fff",
          }}
        />
      )}
    </>
  );
};
