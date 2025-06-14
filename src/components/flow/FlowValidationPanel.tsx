import { validateFlow } from "@/lib/flowValidation";
import {
  CheckIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { Badge, Box, Card, Flex, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useEdges, useNodes } from "reactflow";
import { useTranslation } from "react-i18next";

interface FlowValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const FlowValidationPanel: React.FC = () => {
  const { t } = useTranslation();
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
  }, [nodes, edges]);

  if (validation.isValid && validation.warnings.length === 0) {
    return (
      <Card size="1" variant="surface">
        <Flex align="center" gap="2">
          <CheckIcon color="green" />
          <Text size="1" color="green">
            {t("flow.validation.passed")}
          </Text>
        </Flex>
      </Card>
    );
  }

  return (
    <Card size="1" variant="surface">
      <Flex direction="column" gap="2">
        <Text size="2" weight="bold">
          {t("flow.validation.status")}
        </Text>

        {validation.errors.length > 0 && (
          <Box>
            <Flex align="center" gap="2" mb="1">
              <CrossCircledIcon color="red" />
              <Text size="1" weight="medium" color="red">
                {t("common.error")}
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
                {t("common.warning")}
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
          {validation.isValid
            ? t("flow.validation.executable")
            : t("flow.validation.notExecutable")}
        </Badge>
      </Flex>
    </Card>
  );
};
