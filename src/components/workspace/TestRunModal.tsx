import { DataFrameViewer } from "@/components/DataFrameViewer";
import ExcelPreview from "@/routes/ExcelPreview";
import { SimpleDataframe } from "@/types";
import { Box, Button, Dialog, Text } from "@radix-ui/themes";

interface TestRunModalProps {
  runResult?: SimpleDataframe;
}

const TestRunModal = ({ runResult }: TestRunModalProps) => {
  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <Text color="gray" size="1" weight="medium">
          测试运行
        </Text>
      </Dialog.Trigger>
      <Dialog.Content className="">
        <Dialog.Title>测试运行结果</Dialog.Title>
        {runResult && (
          <Box className="max-h-72 overflow-auto rounded-md border p-2">
            {runResult && "preview_data" in runResult[0] ? (
              <ExcelPreview sheets={runResult} hide={false} loading={false} />
            ) : (
              <DataFrameViewer
                columns={runResult.columns}
                data={runResult.data ?? []}
              />
            )}
          </Box>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
};
TestRunModal.displayName = "TestRunModal";

export default TestRunModal;
