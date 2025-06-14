import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { CheckIcon, PlusIcon, UpdateIcon } from "@radix-ui/react-icons";
import { Flex, Text, TextField } from "@radix-ui/themes";
import { Button } from "@/components/ui/button";
import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@radix-ui/react-icons";
import AlertExit from "@/components/flow/AlertExit";
import { useSaveWorkspaceMutation } from "@/hooks/workspaceQueries";
import { ChevronLeftIcon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import { Heading } from "@radix-ui/themes";

interface WorkspaceToolbarProps {
  workspaceName: string;
  onNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  isSaving: boolean;
  isDirty?: boolean;
  isOutdated?: boolean;
}

const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({
  workspaceName,
  onNameChange,
  onSave,
  isSaving,
  isDirty,
  isOutdated,
}) => {
  const navigate = useNavigate();
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const isWsDirty = useWorkspaceStore((state) => state.isDirty);
  const { t } = useTranslation();

  const handleNavigateBack = () => {
    navigate(`/workspace`);
  };
  return (
    <Flex
      align="center"
      justify="between"
      p="4"
      className="h-14 flex-shrink-0 border-b border-gray-300 bg-gray-50 shadow-sm"
    >
      {/* Left side: Workspace Name */}
      <Flex align="center" gap="3">
        {isWsDirty ? (
          <AlertExit
            title={t("workspace.exitTitle")}
            description={t("workspace.exitDescription")}
            onConfirm={handleNavigateBack}
          />
        ) : (
          <Button color="gray" variant="outline" onClick={handleNavigateBack}>
            <ArrowLeftIcon />
            <Text size="2" weight="bold" color="gray">
              {t("workspace.back")}
            </Text>
          </Button>
        )}
        <Text size="2" weight="bold" color="gray">
          {t("workspace.title")}:
        </Text>
        <TextField.Root
          size="2"
          placeholder={t("workspace.namePlaceholder")}
          value={workspaceName}
          onChange={onNameChange}
          disabled={isSaving} // Disable editing while saving
          className="min-w-[200px] max-w-[400px]"
        />
        <Button
          size="2"
          variant="outline"
          color="gray"
          onClick={() =>
            navigate(`/workspace/${currentWorkspace?.id}/files-manager`)
          }
        >
          <PlusIcon className="mr-1" />
          {t("workspace.fileManager")}
        </Button>
        <Button
          size="2"
          variant="outline"
          color="gray"
          onClick={() =>
            navigate(`/workspace/${currentWorkspace?.id}/flow-editor`)
          }
        >
          <PlusIcon className="mr-1" />
          {t("workspace.flowEditor")}
        </Button>
        {isDirty && (
          <Text size="1" color="orange" className="ml-2">
            {t("workspace.unsavedChanges")}
          </Text>
        )}
        {isOutdated && (
          <Flex align="start" gap="1" direction="column">
            <Text size="1" color="red" className="ml-2">
              {t("file.someFilesOutdated")}
            </Text>
            <Text size="1" color="red" className="ml-2">
              {t("file.needFileManagerAction")}
            </Text>
          </Flex>
        )}
      </Flex>

      {/* Right side: Actions */}
      <Flex align="center" gap="3">
        <Button
          variant="solid"
          color={isDirty ? "amber" : "green"}
          size="2"
          onClick={onSave}
          disabled={isSaving || !isDirty}
        >
          {isSaving ? (
            <UpdateIcon className="mr-0.5 animate-spin" />
          ) : (
            <CheckIcon className="mr-0.5" />
          )}
          {isDirty
            ? isSaving
              ? t("common.saving")
              : t("common.save")
            : t("workspace.noChanges")}
        </Button>
      </Flex>
    </Flex>
  );
};

export default WorkspaceToolbar;
