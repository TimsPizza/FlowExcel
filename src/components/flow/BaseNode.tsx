import TestRunModal from "@/components/workspace/TestRunModal";
import { BaseNodeData } from "@/types/nodes";
import { Badge, Box, Card, Flex, Text } from "@radix-ui/themes";
import { useState } from "react";
import { Handle, Position } from "reactflow";

interface BaseNodeProps {
  data: BaseNodeData;
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

  return (
    <Card className="min-w-72 max-w-2xl">
      <Flex direction="column" gap="2" className="">
        <Flex justify="between" align="center" mb="1">
          <Text weight="bold">{data.label}</Text>
          <Flex gap="1">
            {testable && (
              <Badge
                color="blue"
                style={{ cursor: "pointer" }}
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
              style={{ cursor: "pointer" }}
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
          position={Position.Top}
          style={{ background: "#555" }}
        />
      )}

      {!isSource && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: "#555" }}
        />
      )}
    </Card>
  );
};
