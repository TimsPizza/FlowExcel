import { useMemo } from "react";
import { useNodeId } from "reactflow";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useTryReadHeaderRow } from "./workspaceQueries";
import { traceNodeDataSource } from "@/lib/nodeDataSource";

/**
 * 获取当前节点可用的列名
 * 通过图论逻辑追溯数据源，然后使用useTryReadHeaderRow获取真实的列名
 */
export function useNodeColumns() {
  const nodeId = useNodeId();
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  
  // 追溯数据源信息
  const dataSource = useMemo(() => {
    if (!nodeId || !currentWorkspace) {
      return null;
    }
    
    return traceNodeDataSource(
      nodeId,
      currentWorkspace.flow_nodes,
      currentWorkspace.flow_edges,
      currentWorkspace
    );
  }, [nodeId, currentWorkspace]);
  
  // 使用useTryReadHeaderRow获取列名
  const { headerRow, isHeaderRowLoading, headerRowError } = useTryReadHeaderRow(
    dataSource?.filePath || "",
    dataSource?.sheetName || "",
    dataSource?.headerRow || 0
  );
  
  const columns = useMemo(() => {
    if (!headerRow?.column_names) {
      return [];
    }
    return headerRow.column_names;
  }, [headerRow]);
  
  return {
    columns,
    isLoading: isHeaderRowLoading,
    error: headerRowError,
    dataSource
  };
} 