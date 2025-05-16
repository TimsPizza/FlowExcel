import React from "react";
import { Flex, TextField, Button, Text, Separator } from "@radix-ui/themes";
import { UpdateIcon, CheckIcon, PlusIcon } from "@radix-ui/react-icons";
import { useNavigate } from "react-router-dom";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

interface WorkspaceToolbarProps {
  workspaceName: string;
  onNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  isSaving: boolean;
  isDirty?: boolean;
}

const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({
  workspaceName,
  onNameChange,
  onSave,
  isSaving,
  isDirty,
}) => {
  const navigate = useNavigate();
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  return (
    <Flex
      align="center"
      justify="between"
      p="4"
      className="h-14 flex-shrink-0 border-b border-gray-300 bg-gray-50 shadow-sm"
    >
      {/* Left side: Workspace Name */}
      <Flex align="center" gap="3">
        <Text size="2" weight="bold" className="text-gray-600">
          工作区:
        </Text>
        <TextField.Root
          size="2"
          placeholder="输入工作区名称"
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
          文件管理
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
          流程编辑
        </Button>
        {isDirty && (
          <Text size="1" color="orange" className="ml-2">
            * 未保存的更改
          </Text>
        )}
      </Flex>

      {/* Right side: Actions */}
      <Flex align="center" gap="3">
        <Button
          variant="solid"
          color={isDirty ? "amber" : "green"}
          size="2"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <UpdateIcon className="mr-1 animate-spin" />
          ) : (
            <CheckIcon className="mr-1" />
          )}
          {isSaving ? "保存中..." : "保存工作区"}
        </Button>
      </Flex>
    </Flex>
  );
};

export default WorkspaceToolbar;
