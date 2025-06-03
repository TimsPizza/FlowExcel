import TestRunModal from "@/components/flow/TestRunModal";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { CustomNodeBaseData } from "@/types/nodes";
import { Badge, Box, Flex, Text } from "@radix-ui/themes";
import { useState } from "react";
import { Handle, Position } from "reactflow";

interface BaseNodeProps {
  data: CustomNodeBaseData;
  children: React.ReactNode;
  isSource?: boolean;
  isTarget?: boolean;
  onTestRun?: () => void;
  testable?: boolean;
}

export const BaseNode: React.FC<BaseNodeProps> = ({
  data,
  children,
  isSource = false,
  isTarget = true,
  onTestRun,
  testable = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const removeFlowNode = useWorkspaceStore((state) => state.removeFlowNode);

  return (
    <>
      <Flex
        direction="column"
        gap="2"
        className="rounded-md border border-gray-200 p-2"
      >
        <Flex justify="between" align="center" mb="1">
          <Text weight="bold">{data.label}</Text>
          <Flex gap="1">
            <Badge
              color="red"
              className="inline-block cursor-pointer"
              onClick={() => {
                removeFlowNode(data.id);
              }}
            >
              删除
            </Badge>
            {testable && (
              <Badge
                color="blue"
                className="inline-block cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onTestRun?.();
                }}
              >
                <TestRunModal runResult={data.testResult} />
              </Badge>
            )}
            <Badge
              color="gray"
              className="inline-block cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? "收起" : "展开"}
            </Badge>
          </Flex>
        </Flex>

        {data.error && (
          <Badge color="red" size="1">
            {data.error}
          </Badge>
        )}

        {expanded && (
          <Box className="rounded-md bg-[var(--accent-2)] p-2">{children}</Box>
        )}
      </Flex>

      {isTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className=""
        />
      )}

      {isSource && (
        <Handle
          type="source"
          position={Position.Right}
          className=""
        />
      )}
    </>
  );
};
