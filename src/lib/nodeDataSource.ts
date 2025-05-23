import { Node, Edge } from "reactflow";
import { FlowNodeData, NodeType, IndexSourceNodeDataContext, SheetSelectorNodeDataContext } from "@/types/nodes";
import { WorkspaceConfig, FileMeta } from "@/types";

export interface DataSourceInfo {
  filePath: string;
  sheetName: string;
  headerRow: number;
  fileId: string;
}

/**
 * 追溯节点的数据源信息，找到最近的数据源（IndexSource + SheetSelector组合）
 */
export function traceNodeDataSource(
  nodeId: string, 
  nodes: Node<FlowNodeData>[], 
  edges: Edge[], 
  workspace: WorkspaceConfig
): DataSourceInfo | null {
  // 构建反向图（从target指向source）
  const reverseGraph = new Map<string, string[]>();
  
  edges.forEach(edge => {
    if (!reverseGraph.has(edge.target)) {
      reverseGraph.set(edge.target, []);
    }
    reverseGraph.get(edge.target)!.push(edge.source);
  });
  
  // 创建节点映射
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  
  // BFS追溯，寻找数据源路径
  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId, path: [nodeId] }];
  
  let indexSourceNode: Node<IndexSourceNodeDataContext> | null = null;
  let sheetSelectorNode: Node<SheetSelectorNodeDataContext> | null = null;
  
  while (queue.length > 0) {
    const { nodeId: currentNodeId, path } = queue.shift()!;
    
    if (visited.has(currentNodeId)) continue;
    visited.add(currentNodeId);
    
    const currentNode = nodeMap.get(currentNodeId);
    if (!currentNode) continue;
    
    // 检查是否找到了IndexSource
    if (currentNode.type === NodeType.INDEX_SOURCE) {
      indexSourceNode = currentNode as Node<IndexSourceNodeDataContext>;
      
      // 在路径中寻找SheetSelector
      for (const pathNodeId of path) {
        const pathNode = nodeMap.get(pathNodeId);
        if (pathNode && pathNode.type === NodeType.SHEET_SELECTOR) {
          sheetSelectorNode = pathNode as Node<SheetSelectorNodeDataContext>;
          break;
        }
      }
      break;
    }
    
    // 继续向上追溯
    const predecessors = reverseGraph.get(currentNodeId) || [];
    for (const pred of predecessors) {
      if (!visited.has(pred)) {
        queue.push({ nodeId: pred, path: [pred, ...path] });
      }
    }
  }
  
  // 如果没找到完整的数据源路径，返回null
  if (!indexSourceNode || !sheetSelectorNode) {
    return null;
  }
  
  // 解析数据源信息
  const indexData = indexSourceNode.data;
  const sheetData = sheetSelectorNode.data;
  
  // 获取文件信息
  let targetFileId: string;
  let sheetName: string;
  
  if (sheetData.mode === "manual" && sheetData.manualSheetName) {
    targetFileId = sheetData.targetFileID!;
    sheetName = sheetData.manualSheetName;
  } else if (sheetData.mode === "auto_by_index") {
    targetFileId = sheetData.targetFileID!;
    // auto_by_index模式下，sheet名来自索引值，这里我们无法确定具体值
    // 但我们可以使用索引源的第一个可能值或默认值
    sheetName = ""; // 留空，表示需要动态确定
  } else {
    return null;
  }
  
  // 查找文件信息
  const fileInfo = workspace.files.find(f => f.id === targetFileId);
  if (!fileInfo) {
    return null;
  }
  
  // 获取header_row
  let headerRow = 0;
  if (sheetName) {
    const sheetMeta = fileInfo.sheet_metas.find(sm => sm.sheet_name === sheetName);
    headerRow = sheetMeta?.header_row || 0;
  } else {
    // auto_by_index模式，使用第一个sheet的header_row作为默认值
    headerRow = fileInfo.sheet_metas[0]?.header_row || 0;
  }
  
  return {
    filePath: fileInfo.path,
    sheetName: sheetName || fileInfo.sheet_metas[0]?.sheet_name || "",
    headerRow,
    fileId: targetFileId
  };
}

/**
 * 获取节点可用的列名
 * 对于需要列选择的节点（RowFilter, RowLookup, Aggregator），
 * 通过追溯数据源来获取真实的列名
 */
export function getAvailableColumns(
  nodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  workspace: WorkspaceConfig
): string[] {
  const dataSource = traceNodeDataSource(nodeId, nodes, edges, workspace);
  
  if (!dataSource) {
    return [];
  }
  
  // 这里返回一个标识，实际的列名需要通过useTryReadHeaderRow获取
  return [`__DATA_SOURCE_${dataSource.fileId}_${dataSource.sheetName}_${dataSource.headerRow}__`];
} 