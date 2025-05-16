import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import React, { memo, useEffect, useState } from "react";
import {
  Handle,
  NodeProps,
  NodeResizer,
  NodeToolbar,
  Position,
} from "reactflow";
// import { shallow } from 'zustand/shallow'; // No longer needed
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Custom component
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Revert to path alias
// import { MultiSelect } from '@/components/ui/multi-select'; // Commented out for now
import { Button } from "@/components/ui/button"; // Import Button for Apply
import { FileMeta, PrimarySourceNodeData } from "@/types";
import { Cross1Icon, FileTextIcon, Pencil1Icon } from "@radix-ui/react-icons";
import { Box, CheckboxGroup, ScrollArea, Text } from "@radix-ui/themes";

const PrimarySourceNode: React.FC<NodeProps<PrimarySourceNodeData>> = ({
  id,
  data,
  selected,
}) => {
  const files = useWorkspaceStore(
    (state) => state.currentWorkspace?.files || [],
  );
  const updateNodeData = useWorkspaceStore((state) => state.updateNodeData);
  const removeFlowNode = useWorkspaceStore((state) => state.removeFlowNode);
  const handleRemoveSelf = () => {
    removeFlowNode(id);
  };

  // Editing state
  const [isEditing, setIsEditing] = useState(true); // Default to editing for new nodes for now

  const [pendingFileId, setPendingFileId] = useState<string | undefined>(
    data.fileId,
  );
  const [pendingIndexColumns, setPendingIndexColumns] = useState<
    string[] | undefined
  >(data.indexColumns);

  useEffect(() => {
    setPendingFileId(data.fileId);
    setPendingIndexColumns(data.indexColumns);
    // If data is empty (new node), perhaps default to editing mode?
    if (!data.fileId) {
      setIsEditing(true);
    }
  }, [data.fileId, data.indexColumns]);

  // const effectiveFileId = isEditing ? pendingFileId : data.fileId; // This was unused

  // const selectedFileMeta = files.find(
  //   (f: FileMeta) => f.id === effectiveFileId,
  // );

  const handleFileChange = (newFileId: string) => {
    setPendingFileId(newFileId);
    setPendingIndexColumns([]);
  };

  const handleIndexColumnChange = (newIndexColumns: string[]) => {
    setPendingIndexColumns(newIndexColumns);
  };

  const handleApplyChanges = () => {
    updateNodeData(id, {
      fileId: pendingFileId,
      indexColumns: pendingIndexColumns,
    });
    setIsEditing(false); // Switch to display mode after applying
  };

  const handleCancelChanges = () => {
    setPendingFileId(data.fileId);
    setPendingIndexColumns(data.indexColumns);
    setIsEditing(false); // Switch to display mode after cancelling
  };

  const columnOptions =
    files
      .find((f) => f.id === pendingFileId)
      ?.columns?.map((col: string) => ({ value: col, label: col })) || [];

  const hasChanges =
    pendingFileId !== data.fileId ||
    JSON.stringify(pendingIndexColumns) !== JSON.stringify(data.indexColumns);
  const scrollableClassName = "react-flow__node-scrollable";

  // Determine displayed file name and index columns for display mode
  const displayFileName =
    files.find((f) => f.id === data.fileId)?.alias || "N/A";
  const displayIndexColumns =
    data.indexColumns && data.indexColumns.length > 0
      ? data.indexColumns.join(", ")
      : "None selected";

  return (
    <Card className="w-80 bg-gray-100 shadow-md">
      <NodeResizer
        minWidth={isEditing ? 320 : 200} // Adjust size based on mode
        minHeight={isEditing ? 250 : 120}
        isVisible={selected} // Resizer only visible when node is selected
        handleClassName="w-3 h-3 bg-blue-500 rounded-full border-2 border-white"
      />
      <CardHeader className="flex items-center justify-between bg-slate-50 p-1">
        <CardTitle className="flex w-full items-center justify-between text-base font-semibold">
          <Box className="flex flex-row items-center">
            <FileTextIcon className="mr-2 inline-block h-5 w-5 text-slate-700" />
            <Text className="text-sm font-semibold">数据源</Text>
          </Box>
          <Button
            size="3"
            onClick={handleCancelChanges}
            aria-label="Cancel changes"
            variant="ghost"
          >
            <Cross1Icon className="h-4 w-4" />
          </Button>
        </CardTitle>
        {!isEditing && (
          <Button
            size="2"
            variant="outline"
            onClick={() => setIsEditing(true)}
            aria-label="Edit node"
          >
            <Pencil1Icon />
          </Button>
        )}
      </CardHeader>

      {isEditing ? (
        // EDITING MODE UI
        <CardContent className="space-y-3 p-3">
          <div>
            <label
              htmlFor={`file-select-${id}`}
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Source File
            </label>
            <Select
              value={pendingFileId || ""}
              onValueChange={handleFileChange}
            >
              <SelectTrigger id={`file-select-${id}`}>
                <SelectValue placeholder="Select a file..." />
              </SelectTrigger>
              <SelectContent className={scrollableClassName}>
                {files.map((file: FileMeta) => (
                  <SelectItem key={file.id} value={file.id}>
                    {file.alias}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {pendingFileId && files.find((f) => f.id === pendingFileId) && (
            <div>
              <label
                htmlFor={`index-columns-select-${id}`}
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Index Columns
              </label>
              <ScrollArea className={`${scrollableClassName}`}>
                <CheckboxGroup.Root
                  value={pendingIndexColumns || []}
                  onValueChange={handleIndexColumnChange}
                  className={`mt-1 block h-24 w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm`}
                >
                  {columnOptions.map(
                    (col: { value: string; label: string }) => (
                      <CheckboxGroup.Item key={col.value} value={col.value}>
                        {col.label}
                      </CheckboxGroup.Item>
                    ),
                  )}
                </CheckboxGroup.Root>
              </ScrollArea>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              size="3"
              onClick={handleRemoveSelf}
              aria-label="Remove node"
              className="!bg-red-500 hover:bg-red-600"
            >
              Remove
            </Button>
            <Button
              onClick={handleApplyChanges}
              disabled={!hasChanges}
              size="3"
            >
              Apply Changes
            </Button>
          </div>
        </CardContent>
      ) : (
        // DISPLAY MODE UI
        <CardContent className="space-y-1 p-3 text-sm">
          <div>
            <strong>File:</strong> {displayFileName}
          </div>
          <div>
            <strong>Indices:</strong> {displayIndexColumns}
          </div>
          {/* Dynamic handles will be rendered here based on data.indexColumns */}
        </CardContent>
      )}

      {/* Always render output handles based on *applied* data.indexColumns for connections */}
      {/* For now, a single static handle. Dynamic handles based on data.indexColumns will be next. */}
      {!isEditing && data.indexColumns && data.indexColumns.length > 0 ? (
        data.indexColumns.map((col, i) => (
          <Handle
            key={`output-${col}-${i}`}
            type="source"
            position={Position.Right}
            id={`output-${col}`}
            style={{ top: `${20 + i * 15}%` }} // Basic dynamic positioning
            className="h-3 w-3 !bg-teal-500"
          />
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          id="output-default" // Default handle if no columns or in editing mode
          className="h-3 w-3 !bg-gray-400"
          style={{ top: "50%" }}
        />
      )}

      <NodeToolbar
        isVisible={selected}
        position={Position.Top}
        className="flex gap-1"
      >
        {/* Toolbar actions */}
      </NodeToolbar>
    </Card>
  );
};

export default memo(PrimarySourceNode);
