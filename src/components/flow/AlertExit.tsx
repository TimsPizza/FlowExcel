import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "@radix-ui/react-icons";
import { AlertDialog as AlertDialog_, Flex, Text } from "@radix-ui/themes";
import { t } from "i18next";

interface AlertExitProps {
  title: string;
  description: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

const AlertExit = ({
  title,
  description,
  onConfirm,
  onCancel,
}: AlertExitProps) => {
  return (
    <AlertDialog_.Root>
      <AlertDialog_.Trigger>
        <Flex align="center" gap="2">
          <Button color="gray" variant="outline">
            <ArrowLeftIcon />
            <Text size="2" weight="bold" color="gray">
              {title}
            </Text>
          </Button>
        </Flex>
      </AlertDialog_.Trigger>
      <AlertDialog_.Content maxWidth="450px">
        <AlertDialog_.Title>{title}</AlertDialog_.Title>
        <AlertDialog_.Description size="2">
          {description}
        </AlertDialog_.Description>

        <Flex gap="3" mt="4" justify="end">
          <AlertDialog_.Cancel>
            <Button variant="soft" color="gray" onClick={() => onCancel?.()}>
              {t("common.cancel")}
            </Button>
          </AlertDialog_.Cancel>
          <AlertDialog_.Action>
            <Button variant="solid" color="red" onClick={() => onConfirm?.()}>
              {t("common.confirm")}
            </Button>
          </AlertDialog_.Action>
        </Flex>
      </AlertDialog_.Content>
    </AlertDialog_.Root>
  );
};

export default AlertExit;
