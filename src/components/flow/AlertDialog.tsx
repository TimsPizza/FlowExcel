import { Button } from "@/components/ui/button";
import { AlertDialog as AlertDialog_, Flex, Text } from "@radix-ui/themes";

interface AlertDialogProps {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  noButton?: boolean;
}

const AlertDialog = ({
  title,
  description,
  onConfirm,
  onCancel,
  noButton = false,
}: AlertDialogProps) => {
  return (
    <AlertDialog_.Root>
      <AlertDialog_.Trigger>
        {noButton ? (
          <Text size="2" weight="bold" className="text-gray-600">
            {title}
          </Text>
        ) : (
          <Button color="red">{title}</Button>
        )}
      </AlertDialog_.Trigger>
      <AlertDialog_.Content maxWidth="450px">
        <AlertDialog_.Title>{title}</AlertDialog_.Title>
        <AlertDialog_.Description size="2">
          {description}
        </AlertDialog_.Description>

        <Flex gap="3" mt="4" justify="end">
          <AlertDialog_.Cancel>
            <Button variant="soft" color="gray" onClick={onCancel}>
              {`取消`}
            </Button>
          </AlertDialog_.Cancel>
          <AlertDialog_.Action>
            <Button variant="solid" color="red" onClick={onConfirm}>
              {`确定`}
            </Button>
          </AlertDialog_.Action>
        </Flex>
      </AlertDialog_.Content>
    </AlertDialog_.Root>
  );
};

export default AlertDialog;
