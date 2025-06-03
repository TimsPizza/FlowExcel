import { Button, Dialog } from "@radix-ui/themes";

interface HelpModalProps {
  title?: string;
  label: string;
  content: string;
  buttonColor?:
    | "gray"
    | "red"
    | "green"
    | "yellow"
    | "blue"
    | "purple"
    | "orange"
    | "pink"
    | "brown"
    | "gray";
  buttonVariant?: "soft" | "outline" | "ghost" | "solid";
}

const TextModal = ({
  content,
  label,
  buttonColor = "gray",
  title,
  buttonVariant = "soft",
}: HelpModalProps) => {
  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <Button
          color={buttonColor}
          size="1"
          variant={buttonVariant}
        >
          {label}
        </Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>{title || label}</Dialog.Title>
        <Dialog.Description>
          <p>{content}</p>
        </Dialog.Description>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default TextModal;
