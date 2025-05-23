import { DataFrameViewer } from "@/components/DataFrameViewer";
import ExcelPreview from "@/routes/ExcelPreview";
import { SimpleDataframe } from "@/types";
import { isDataFrameResult, isMultiSheetResult } from "@/lib/dataTransforms";
import { Box, Button, Dialog, Text } from "@radix-ui/themes";

interface TestRunModalProps {
  runResult?: SimpleDataframe;
}

const TestRunModal = ({ runResult }: TestRunModalProps) => {
  console.log("TestRunModal runResult", runResult);

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
            {isMultiSheetResult(runResult) ? (
              <ExcelPreview sheets={runResult} hide={false} loading={false} />
            ) : isDataFrameResult(runResult) ? (
              <DataFrameViewer
                columns={runResult.columns || []}
                data={runResult.data || []}
              />
            ) : (
              <Text size="1" color="gray">
                暂无数据
              </Text>
            )}
          </Box>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
};

TestRunModal.displayName = "TestRunModal";

export default TestRunModal;
