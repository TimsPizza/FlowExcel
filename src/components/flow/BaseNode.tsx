import { Handle, Position } from "reactflow";
import { BaseNodeData } from "@/types/nodes";
import { Card, Flex, Box, Text, Badge } from "@radix-ui/themes";
import { useState } from "react";

interface BaseNodeProps {
  data: BaseNodeData;
  children: React.ReactNode;
  isSource?: boolean;
  isTarget?: boolean;
  onTestRun?: () => void;
}

export const BaseNode: React.FC<BaseNodeProps> = ({
  data,
  children,
  isSource = false,
  isTarget = true,
  onTestRun,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card size="2" style={{ minWidth: 240 }}>
      <Flex direction="column" gap="2">
        <Flex justify="between" align="center" mb="1">
          <Text weight="bold">{data.label}</Text>
          <Flex gap="1">
            {onTestRun && (
              <Badge
                color="blue"
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onTestRun();
                }}
              >
                测试运行
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
          <Box
            style={{
              padding: "8px",
              backgroundColor: "var(--accent-2)",
              borderRadius: "4px",
            }}
          >
            {children}
          </Box>
        )}

        {data.testResult && expanded && (
          <Box>
            <Text size="1" weight="bold">
              测试结果:
            </Text>
            <Box
              style={{
                padding: "8px",
                backgroundColor: "var(--accent-2)",
                borderRadius: "4px",
                maxHeight: "200px",
                overflow: "auto",
              }}
            >
              <pre style={{ margin: 0, fontSize: "12px" }}>
                {JSON.stringify(data.testResult, null, 2)}
              </pre>
            </Box>
          </Box>
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
