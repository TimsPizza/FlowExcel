import ExcelPreview from "@/components/ExcelPreview";
import { Button } from "@/components/ui/button";
import { SheetInfo } from "@/types";
import { Box, Dialog } from "@radix-ui/themes";
import { useEffect, useMemo } from "react";

interface TestRunModalProps {
  runResult?: SheetInfo[];
  onTestRun?: () => void;
}

const TestRunModal = ({ runResult, onTestRun }: TestRunModalProps) => {
  useEffect(() => {
    console.log("TestRunModal runResult", runResult);
  }, [runResult]);

  // ensure data integrity to prevent render error
  const sanitizedResult = useMemo(() => {
    console.log("usememo update run result ", runResult);
    if (!runResult) return [];
    // 现在可以保证传进来的是sheetinfo[]
    if (Array.isArray(runResult)) {
      return runResult;
    }
    return [runResult];
  }, [runResult]);

  return (
    <Dialog.Root>
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
        {runResult && (
          <Box className="max-h-72 overflow-auto rounded-md border p-2">
            <ExcelPreview
              sheets={sanitizedResult}
              hide={false}
              loading={false}
            />
          </Box>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
};

TestRunModal.displayName = "TestRunModal";

export default TestRunModal;
