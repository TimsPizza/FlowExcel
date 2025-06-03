import { DataFrameViewer } from "@/components/DataFrameViewer";
import { SheetInfo } from "@/types";
import { Flex, Tabs } from "@radix-ui/themes";
import { useEffect, useMemo, useState } from "react";

interface ExcelPreviewProps {
  sheets: SheetInfo[];
  hide: boolean;
  loading: boolean;
}

export default function ExcelPreview({
  sheets,
  // hide,
  loading,
}: ExcelPreviewProps) {
  console.log("sheets", sheets);
  const [selectedSheetName, setSelectedSheetName] = useState<string | null>(
    null,
  );
  const tranformedPreviewData = useMemo(() => {
    console.log("selectedSheetName", selectedSheetName);
    if (sheets?.length === 0) return [];
    if (!selectedSheetName) return sheets[0];
    const sheet = sheets?.find(
      (sheet) => sheet.sheet_name === selectedSheetName,
    );
    if (!sheet) return [];
    return sheet;
  }, [selectedSheetName, sheets]);

  useEffect(() => {
    if (sheets && sheets?.length > 0 && !loading) {
      setSelectedSheetName(sheets[0].sheet_name);
    }
  }, [loading, sheets]);

  return (
    <div className="flex flex-col gap-4 rounded-md border border-gray-200 p-4">
      <Flex direction="column" gap="2">
        <Tabs.Root
          defaultValue={selectedSheetName ?? sheets?.[0]?.sheet_name}
          onValueChange={setSelectedSheetName}
        >
          <Tabs.List>
            {sheets && sheets?.map((sheet) => (
              <Tabs.Trigger key={sheet.sheet_name} value={sheet.sheet_name}>
                {sheet?.sheet_name}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>
        {tranformedPreviewData && selectedSheetName && (
          <DataFrameViewer
            columns={
              sheets?.find((sheet) => sheet.sheet_name === selectedSheetName)
                ?.columns ?? []
            }
            data={
              sheets?.find((sheet) => sheet.sheet_name === selectedSheetName)
                ?.data ?? ([] as any)
            }
            // eSize={10}
          />
        )}
      </Flex>
    </div>
  );
}
