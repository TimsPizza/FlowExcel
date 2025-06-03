import { validateFlow } from "@/lib/flowValidation";
import { Badge, Box, Card, Flex, Text } from "@radix-ui/themes";
import {
  CheckIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { useEdges, useNodes, useReactFlow } from "reactflow";
import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useShallow } from "zustand/shallow";

interface FlowValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const FlowValidationPanel: React.FC = () => {
  const nodes = useNodes();
  const edges = useEdges();
  const [validation, setValidation] = useState<FlowValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
  });

  useEffect(() => {
    const result = validateFlow(nodes, edges);
    setValidation(result);
    // console.log("validation", result);
  }, [nodes, edges]);

  if (validation.isValid && validation.warnings.length === 0) {
    return (
      <Card size="1" variant="surface">
        <Flex align="center" gap="2">
          <CheckIcon color="green" />
          <Text size="1" color="green">
            流程验证通过
          </Text>
        </Flex>
      </Card>
    );
  }

  return (
    <Card size="1" variant="surface">
      <Flex direction="column" gap="2">
        <Text size="2" weight="bold">
          流程验证状态
        </Text>

        {validation.errors.length > 0 && (
          <Box>
            <Flex align="center" gap="2" mb="1">
              <CrossCircledIcon color="red" />
              <Text size="1" weight="medium" color="red">
                错误
              </Text>
            </Flex>
            {validation.errors.map((error, index) => (
              <Box key={index} ml="4">
                <Text size="1" color="red">
                  • {error}
                </Text>
              </Box>
            ))}
          </Box>
        )}

        {validation.warnings.length > 0 && (
          <Box>
            <Flex align="center" gap="2" mb="1">
              <ExclamationTriangleIcon color="orange" />
              <Text size="1" weight="medium" color="orange">
                警告
              </Text>
            </Flex>
            {validation.warnings.map((warning, index) => (
              <Box key={index} ml="4">
                <Text size="1" color="orange">
                  • {warning}
                </Text>
              </Box>
            ))}
          </Box>
        )}

        <Badge color={validation.isValid ? "green" : "red"} size="1">
          {validation.isValid ? "可执行" : "不可执行"}
        </Badge>
      </Flex>
    </Card>
  );
};
