import {
  BadgeConfig,
  EnhancedBaseNode,
} from "@/components/flow/nodes/EnhancedBaseNode";
import { usePreviewNodeMutation } from "@/hooks/workspaceQueries";
import { convertPreviewToSheets, getPreviewMetadata } from "@/lib/utils";
import { fileSelector, useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FlowNodeProps, SheetSelectorNodeDataContext } from "@/types/nodes";
import { Flex, RadioGroup, Select, Text } from "@radix-ui/themes";
import { useMemo } from "react";
import { useNodeId } from "reactflow";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";

export const SheetSelectorNode: React.FC<FlowNodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const nodeId = useNodeId()!;
  const nodeData = data as SheetSelectorNodeDataContext;
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const { files } = useWorkspaceStore(useShallow(fileSelector));
  const previewNodeMutation = usePreviewNodeMutation();
  const updateSheetSelectorNodeData = useWorkspaceStore(
    (state) => state.updateNodeData,
  );

  const handleSelectFile = async (fileId: string) => {
    try {
      updateSheetSelectorNodeData(nodeId, {
        targetFileID: fileId,
        error: undefined,
      });

      // Reset manual sheet name if file changed
      if (nodeData.mode === "manual" && nodeData.manualSheetName) {
        updateSheetSelectorNodeData(nodeId, { manualSheetName: undefined });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSheetModeChange = (mode: "auto_by_index" | "manual") => {
    updateSheetSelectorNodeData(nodeId, {
      mode,
      manualSheetName: undefined, // Reset when changing mode
      error: undefined,
    });
  };

  const handleSelectSheet = (sheetName: string) => {
    updateSheetSelectorNodeData(nodeId, {
      manualSheetName: sheetName,
      error: undefined,
    });
  };

  const previewNode = async () => {
    console.log("test run sheet selector node");
    try {
      // Validate required fields
      if (!nodeData.targetFileID) {
        updateSheetSelectorNodeData(nodeId, {
          error: t("flow.validation.sheetSelector.noFile"),
        });
        return;
      }

      if (nodeData.mode === "manual" && !nodeData.manualSheetName) {
        updateSheetSelectorNodeData(nodeId, {
          error: t("flow.validation.sheetSelector.noSheet"),
        });
        return;
      }

      // clear existing test result
      updateSheetSelectorNodeData(nodeId, {
        testResult: undefined,
        error: undefined,
      });
      previewNodeMutation.mutate(
        {
          nodeId: nodeData.id,
          testModeMaxRows: 50,
          workspaceConfig: currentWorkspace || undefined,
        },
        {
          onSuccess: (result) => {
            if (result.success) {
              const sheets = convertPreviewToSheets(result);

              updateSheetSelectorNodeData(nodeId, {
                testResult: sheets,
                error: undefined,
              });
            } else {
              updateSheetSelectorNodeData(nodeId, {
                error: result.error || t("flow.previewFailed"),
              });
            }
          },
          onError: (error) => {
            updateSheetSelectorNodeData(nodeId, {
              error: t("flow.previewFailedWithError", { error: error.message }),
            });
          },
        },
      );
    } catch (error) {
      updateSheetSelectorNodeData(nodeId, {
        error: t("flow.previewRunFailed"),
      });
    }
  };

  const badges: BadgeConfig[] = useMemo(() => {
    const badges: BadgeConfig[] = [];
    if (nodeData.targetFileID) {
      badges.push({
        color: "green",
        variant: "soft",
        label:
          files?.find((file) => file.id === nodeData.targetFileID)?.name || "",
      });
    }
    if (nodeData.mode === "manual") {
      badges.push({
        color: "blue",
        variant: "soft",
        label: nodeData.manualSheetName || t("flow.notSpecified"),
      });
    } else {
      badges.push({
        color: "blue",
        variant: "soft",
        label: t("flow.autoMatch"),
      });
    }
    return badges;
  }, [nodeData.mode, nodeData.manualSheetName, nodeData.targetFileID]);

  return (
    <EnhancedBaseNode
      data={nodeData}
      isSource={true}
      isTarget={true}
      onTestRun={previewNode}
      testable
      badges={badges}
    >
      <Flex direction="column" gap="2">
        <Flex align="center" gap="2">
          <Text size="1" weight="bold">
            {t("flow.targetFile")}:
          </Text>
          <Select.Root
            value={nodeData.targetFileID || ""}
            onValueChange={(v) => handleSelectFile(v)}
          >
            <Select.Trigger />
            <Select.Content>
              <Select.Group>
                {files && files.length > 0 ? (
                  files.map((file) => (
                    <Select.Item value={file.id} key={file.id}>
                      {file.name}
                    </Select.Item>
                  ))
                ) : (
                  <Text size="1">{t("file.noFiles")}</Text>
                )}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </Flex>

        <Flex direction="column" gap="1">
          <Text size="1" weight="bold">
            {t("flow.sheetMode")}:
          </Text>
          <RadioGroup.Root
            value={nodeData.mode || "auto_by_index"}
            onValueChange={(value) =>
              handleSheetModeChange(value as "auto_by_index" | "manual")
            }
          >
            <Flex direction="column" gap="1">
              <RadioGroup.Item value="auto_by_index">
                {t("flow.autoMatchIndex")}
              </RadioGroup.Item>
              <RadioGroup.Item value="manual">
                {t("flow.manualSheet")}
              </RadioGroup.Item>
            </Flex>
          </RadioGroup.Root>
        </Flex>

        {nodeData.mode === "manual" && (
          <Flex align="center" gap="2">
            <Text size="1" weight="bold">
              {t("flow.sheetName")}:
            </Text>
            <Select.Root
              size="1"
              value={nodeData.manualSheetName || ""}
              onValueChange={handleSelectSheet}
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Group>
                  {nodeData.targetFileID &&
                    files &&
                    files.length > 0 &&
                    files
                      .find((file) => file.id === nodeData.targetFileID)
                      ?.sheet_metas?.map((sheet) => (
                        <Select.Item
                          value={sheet.sheet_name}
                          key={sheet.sheet_name}
                        >
                          {sheet.sheet_name}
                        </Select.Item>
                      ))}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Flex>
        )}
      </Flex>
    </EnhancedBaseNode>
  );
};
