import { useBackendEvents } from "@/hooks/useBackendEvents";
import { Badge, Box, Flex, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";

const BackendStatus = () => {
  const { backendInfo, backendError, isReady } = useBackendEvents();
  const { t } = useTranslation();

  return (
    <Box>
      <Flex direction="column" gap="1">
        <Flex align="center" gap="2">
          <Text size="1" weight="medium">
            {t("backend.status")}:
          </Text>
          {isReady ? (
            <Badge color="green">{t("backend.ready")}</Badge>
          ) : (
            <Badge color="red">{t("backend.not_ready")}</Badge>
          )}
        </Flex>

        {backendInfo?.api_base && (
          <Text size="1">
            {t("backend.api_base")}: {backendInfo.api_base}
          </Text>
        )}
        {backendError && (
          <Text size="1" color="red">
            {t("backend.error")}: {backendError}
          </Text>
        )}
      </Flex>
    </Box>
  );
};

export default BackendStatus; 