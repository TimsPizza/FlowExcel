import ExcelPreview from "@/components/flow/ExcelPreview";
import { Button } from "@/components/ui/button";
import { SheetInfo } from "@/types";
import { Box, Dialog, Skeleton, Text } from "@radix-ui/themes";
import { useMemo } from "react";

interface TestRunModalProps {
  runResult?: SheetInfo[];
  onTestRun?: () => void;
  onClose?: () => void; // clear the run result
  error?: string;
}

const TestRunModal = ({
  runResult,
  onTestRun,
  onClose,
  error,
}: TestRunModalProps) => {
  // ensure data integrity to prevent render error
  const sanitizedResult = useMemo(() => {
    if (!runResult) return [];
    // 现在可以保证传进来的是sheetinfo[]
    if (Array.isArray(runResult)) {
      return runResult;
    }
    return [runResult];
  }, [runResult]);
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose?.();
    }
  };

  return (
    <Dialog.Root onOpenChange={handleOpenChange}>
      <Dialog.Trigger>
        <Button
          color="blue"
          size="1"
          variant="soft"
          onClick={() => onTestRun?.()}
        >
          测试
        </Button>
      </Dialog.Trigger>
      <Dialog.Content className="">
        <Dialog.Title>测试运行结果</Dialog.Title>
        {error && (
          <Box className="text-red-500">
            <Text size="2">{error}</Text>
          </Box>
        )}
        {runResult ? (
          <Box className="max-h-72 overflow-auto">
            <ExcelPreview
              sheets={sanitizedResult}
              hide={false}
              loading={false}
            />
          </Box>
        ) : (
          <Skeleton className="h-32 w-full" />
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
};

TestRunModal.displayName = "TestRunModal";

export default TestRunModal;
