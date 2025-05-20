import { DataFrameViewer } from "@/components/DataFrameViewer";
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
            <DataFrameViewer
              columns={runResult.columns}
              data={runResult.data}
            />
          </Box>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
};
TestRunModal.displayName = "TestRunModal";

export default TestRunModal;
