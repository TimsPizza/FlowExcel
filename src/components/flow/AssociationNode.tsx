import { useState, useEffect, useCallback } from "react";
import { Handle, Position, NodeProps, NodeResizer, NodeToolbar } from "reactflow";
import { useWorkspaceStore, FileMeta, AssociationNodeData } from "@/stores/useWorkspaceStore"; // Assuming AssociationNodeData will be added here
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TextField } from "@radix-ui/themes"; // Using Radix TextField
import { Button } from "@radix-ui/themes"; // Using Radix Button for consistency within this node for now
import { Cross1Icon, Pencil1Icon, Link2Icon } from "@radix-ui/react-icons";
import { Box, Text } from "@radix-ui/themes"; // Reuse Radix Themes

const aggregationOptions = [
  { value: "sum", label: "Sum" },
  { value: "average", label: "Average" },
  { value: "count", label: "Count" },
  { value: "first", label: "First Value" },
  { value: "last", label: "Last Value" },
  // Add more as needed
];

export function AssociationNode({
  id,
  data,
  isConnectable,
  selected,
}: NodeProps<AssociationNodeData>) {
  const files = useWorkspaceStore(
    (state) => state.currentWorkspace?.files || [],
  );
  const updateNodeData = useWorkspaceStore((state) => state.updateNodeData);
  const removeFlowNode = useWorkspaceStore((state) => state.removeFlowNode);

  const [isEditing, setIsEditing] = useState(!data.fileId); // Default to editing if file not set
  const [pendingData, setPendingData] = useState<Partial<AssociationNodeData>>(data);

  // Reset pending data if external data changes while not editing
  useEffect(() => {
    if (!isEditing) {
      setPendingData(data);
    }
  }, [data, isEditing]);

  const handleInputChange = useCallback((field: keyof AssociationNodeData, value: string | undefined) => {
    setPendingData((prev: Partial<AssociationNodeData>) => ({ ...prev, [field]: value }));
    // Reset dependent fields if the file changes
    if (field === 'fileId') {
        setPendingData((prev: Partial<AssociationNodeData>) => ({
            ...prev,
            inputIndexColumn: undefined,
            dataColumn: undefined,
        }));
    }
  }, []);

  const handleApplyChanges = useCallback(() => {
    updateNodeData(id, pendingData);
    setIsEditing(false);
  }, [id, pendingData, updateNodeData]);

  const handleCancelChanges = useCallback(() => {
    setPendingData(data); // Reset pending to original data
    setIsEditing(false);
    if (!data.fileId) { // If was a new node and cancelled, perhaps remove it or revert to placeholder
        // For now, just reverts to initial empty data, which might be okay
    }
  }, [data]);

  const handleRemoveSelf = useCallback(() => {
    removeFlowNode(id);
  }, [id, removeFlowNode]);

  const selectedFileMeta = files.find(f => f.id === pendingData.fileId);
  const columnOptions = selectedFileMeta?.columns?.map(col => ({ value: col, label: col })) || [];

  // Check if pending changes are different from original data
  const hasChanges = JSON.stringify(pendingData) !== JSON.stringify(data);
  const canApply = pendingData.fileId && pendingData.inputIndexColumn && pendingData.dataColumn && pendingData.aggregation && pendingData.outputColumnName && pendingData.outputColumnName.trim() !== "";

  // Display values
  const displayFileName = files.find(f => f.id === data.fileId)?.alias || "N/A";
  const displayIncomingIndex = data.incomingIndexName || "N/A";

  return (
    <Card className="w-80 bg-blue-50 shadow-md border border-blue-200">
      <NodeResizer
        minWidth={320}
        minHeight={isEditing ? 420 : 180} // Adjust height based on mode
        isVisible={selected}
        lineClassName="border-blue-400"
        handleClassName="w-3 h-3 bg-blue-500 rounded-full border-2 border-white"
      />
       <CardHeader className="flex flex-row items-center justify-between bg-blue-100 p-2 border-b border-blue-200">
         <CardTitle className="flex w-full items-center justify-between text-base font-semibold">
            <Box className="flex flex-row items-center">
                <Link2Icon className="mr-2 inline-block h-4 w-4 text-blue-700" />
                <Text className="text-sm font-semibold text-blue-800">关联处理</Text>
            </Box>
            {isEditing ? (
                <Button // Radix Button
                    size="1" // Radix size
                    onClick={handleCancelChanges}
                    aria-label="Cancel changes"
                    variant="ghost"
                    color="gray"
                    disabled={!hasChanges && !!data.fileId} // Disable if no changes unless it's a truly new node
                    className="p-1 h-6 w-6"
                >
                    <Cross1Icon className="h-4 w-4" />
                </Button>
            ) : (
                 <Button // Radix Button
                    size="1" 
                    variant="ghost" 
                    color="gray"
                    onClick={() => setIsEditing(true)} 
                    aria-label="Edit node"
                    className="p-1 h-6 w-6"
                >
                     <Pencil1Icon className="h-4 w-4"/>
                 </Button>
            )}
         </CardTitle>
      </CardHeader>

      {isEditing ? (
        // EDITING MODE UI
        <CardContent className="space-y-2 p-3">
            <Text size="2" color="gray" className="mb-1 block">关联 <strong className="text-blue-700">{data.incomingIndexName || '输入索引'}</strong> 至:</Text>
             <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">目标文件</label>
                <Select value={pendingData.fileId || ""} onValueChange={(value) => handleInputChange('fileId', value)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="选择文件..." /></SelectTrigger>
                    <SelectContent>
                        {files.map((file: FileMeta) => (<SelectItem key={file.id} value={file.id} className="text-xs">{file.alias}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>

            {pendingData.fileId && selectedFileMeta && (
                <>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">使用列 (目标文件)</label>
                        <Select value={pendingData.inputIndexColumn || ""} onValueChange={(value) => handleInputChange('inputIndexColumn', value)} >
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="选择关联列..." /></SelectTrigger>
                            <SelectContent>
                                {columnOptions.map(col => (<SelectItem key={col.value} value={col.value} className="text-xs">{col.label}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">获取列 (目标文件)</label>
                        <Select value={pendingData.dataColumn || ""} onValueChange={(value) => handleInputChange('dataColumn', value)} >
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="选择数据列..." /></SelectTrigger>
                            <SelectContent>
                                {columnOptions.map(col => (<SelectItem key={col.value} value={col.value} className="text-xs">{col.label}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">计算方式</label>
                        <Select value={pendingData.aggregation || ""} onValueChange={(value) => handleInputChange('aggregation', value)} >
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="选择计算方式..." /></SelectTrigger>
                            <SelectContent>
                                {aggregationOptions.map(opt => (<SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">输出列名</label>
                        <TextField.Root 
                            size="1"
                            placeholder="输入新列的名称"
                            value={pendingData.outputColumnName || ""}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('outputColumnName', e.target.value)}
                         />
                    </div>
                </>
            )}
           <div className="flex items-center justify-between gap-2 pt-2">
                <Button // Radix Button
                    size="1" // Radix size
                    onClick={handleRemoveSelf}
                    aria-label="Remove node"
                    color="red" // Radix destructive color
                    variant="soft"
                 >
                    删除节点
                 </Button>
                <Button // Radix Button
                    onClick={handleApplyChanges} 
                    disabled={!hasChanges || !canApply} 
                    size="1" // Radix size
                    variant="solid"
                >
                   应用更改
                </Button>
           </div>
        </CardContent>
      ) : (
        // DISPLAY MODE UI
        <CardContent className="space-y-1 p-3 text-sm">
            <div><strong>输入索引:</strong> {displayIncomingIndex}</div>
            <div><strong>关联文件:</strong> {displayFileName}</div>
            <div><strong>关联列:</strong> {data.inputIndexColumn || "N/A"}</div>
            <div><strong>数据列:</strong> {data.dataColumn || "N/A"}</div>
            <div><strong>计算:</strong> {aggregationOptions.find(o => o.value === data.aggregation)?.label || data.aggregation || "N/A"}</div>
            <div><strong>输出为:</strong> {data.outputColumnName || "N/A"}</div>
        </CardContent>
      )}

      {/* Input Handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        id="input-index" // Standard ID for incoming index
        isConnectable={isConnectable}
        className="h-3 w-3 !bg-red-500"
      />

      {/* Output Handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        id={`output-${data.outputColumnName || 'data'}`} // Standard ID for processed output
        isConnectable={isConnectable}
        className="h-3 w-3 !bg-green-500"
      />

      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-1">
        {/* Maybe add toolbar actions later */}
      </NodeToolbar>
    </Card>
  );
} 