import { SimpleDataframe, SheetInfo, PipelineNodeResult } from "@/types";
import { NodeType } from "@/types/nodes";


export interface TransformedNodeResult {
  nodeId: string;
  nodeType: NodeType;
  displayData: SimpleDataframe | SheetInfo[] | null;
  error?: string;
  rawData?: PipelineNodeResult[];
}

/**
 * 将后端返回的Pipeline执行结果转换为前端展示格式
 */
export function transformPipelineResults(
  results: Record<string, PipelineNodeResult[]>,
  nodeType: NodeType,
): TransformedNodeResult[] {
  return Object.entries(results).map(([nodeId, nodeResults]) => {
    return transformSingleNodeResults(nodeId, nodeType, nodeResults);
  });
}

/**
 * 转换单个节点的结果
 */
export function transformSingleNodeResults(
  nodeId: string,
  nodeType: NodeType,
  nodeResults: PipelineNodeResult[],
): TransformedNodeResult {
  // 检查是否有错误
  const errors = nodeResults
    .filter((result) => result.error)
    .map((result) => result.error);
  if (errors.length > 0) {
    return {
      nodeId,
      nodeType,
      displayData: null,
      error: errors.join("; "),
      rawData: nodeResults,
    };
  }

  // 根据节点类型进行不同的转换
  switch (nodeType) {
    case NodeType.INDEX_SOURCE:
      return transformIndexSourceResults(nodeId, nodeType, nodeResults);

    case NodeType.SHEET_SELECTOR:
      return transformSheetSelectorResults(nodeId, nodeType, nodeResults);

    case NodeType.ROW_FILTER:
    case NodeType.ROW_LOOKUP:
      return transformDataFrameResults(nodeId, nodeType, nodeResults);

    case NodeType.AGGREGATOR:
      return transformAggregatorResults(nodeId, nodeType, nodeResults);

    case NodeType.OUTPUT:
      return transformOutputResults(nodeId, nodeType, nodeResults);

    default:
      return transformDataFrameResults(nodeId, nodeType, nodeResults);
  }
}

/**
 * 转换索引源节点结果 - 显示为简单的dataframe
 */
function transformIndexSourceResults(
  nodeId: string,
  nodeType: NodeType,
  nodeResults: PipelineNodeResult[],
): TransformedNodeResult {
  if (nodeResults.length === 0 || !nodeResults[0].result_data) {
    return {
      nodeId,
      nodeType,
      displayData: { columns: [], data: [] },
      rawData: nodeResults,
    };
  }

  const result = nodeResults[0].result_data;
  return {
    nodeId,
    nodeType,
    displayData: {
      columns: result.columns,
      data: result.data,
    },
    rawData: nodeResults,
  };
}

/**
 * 转换Sheet选择器结果 - 显示为多个sheet的预览
 */
function transformSheetSelectorResults(
  nodeId: string,
  nodeType: NodeType,
  nodeResults: PipelineNodeResult[],
): TransformedNodeResult {
  const sheets: SheetInfo[] = nodeResults.map((result, index) => {
    if (!result.result_data) {
      return {
        sheet_name: `Sheet ${index + 1}`,
        columns: [],
        data: [],
      };
    }

    return {
      sheet_name: `Sheet ${index + 1}`,
      columns: result.result_data.columns,
      data: result.result_data.data.slice(0, 10), // 限制预览行数
    };
  });

  return {
    nodeId,
    nodeType,
    displayData: sheets,
    rawData: nodeResults,
  };
}

/**
 * 转换一般数据框架结果（RowFilter, RowLookup等）
 */
function transformDataFrameResults(
  nodeId: string,
  nodeType: NodeType,
  nodeResults: PipelineNodeResult[],
): TransformedNodeResult {
  // 合并所有结果到一个dataframe中
  if (nodeResults.length === 0) {
    return {
      nodeId,
      nodeType,
      displayData: { columns: [], data: [] },
      rawData: nodeResults,
    };
  }

  let allColumns: string[] = [];
  let allData: any[][] = [];

  nodeResults.forEach((result) => {
    if (result.result_data) {
      if (allColumns.length === 0) {
        allColumns = result.result_data.columns;
      }
      allData = allData.concat(result.result_data.data);
    }
  });

  return {
    nodeId,
    nodeType,
    displayData: {
      columns: allColumns,
      data: allData,
    },
    rawData: nodeResults,
  };
}

/**
 * 转换聚合节点结果 - 已经在后端合并，直接使用
 */
function transformAggregatorResults(
  nodeId: string,
  nodeType: NodeType,
  nodeResults: PipelineNodeResult[],
): TransformedNodeResult {
  if (nodeResults.length === 0 || !nodeResults[0].result_data) {
    return {
      nodeId,
      nodeType,
      displayData: { columns: [], data: [] },
      rawData: nodeResults,
    };
  }

  // 聚合节点的结果已经在后端合并过了
  const result = nodeResults[0].result_data;
  return {
    nodeId,
    nodeType,
    displayData: {
      columns: result.columns,
      data: result.data,
    },
    rawData: nodeResults,
  };
}

/**
 * 专门用于处理输出节点结果的转换函数
 */
export function transformOutputResults(
  nodeId: string,
  nodeType: NodeType,
  results: PipelineNodeResult[],
): TransformedNodeResult {
  if (!results || results.length === 0) {
    return {
      nodeId,
      nodeType,
      displayData: { columns: [], data: [] },
      error: "没有结果数据",
      rawData: results,
    };
  }

  // 输出节点应该只有一个结果（合并后的结果）
  const result = results[0];

  if (result.error) {
    return {
      nodeId,
      nodeType,
      displayData: { columns: [], data: [] },
      error: result.error,
      rawData: results,
    };
  }

  if (!result.result_data) {
    return {
      nodeId,
      nodeType,
      displayData: { columns: [], data: [] },
      error: "输出数据格式无效",
      rawData: results,
    };
  }

  // 对于输出节点，直接返回单sheet格式
  return {
    nodeId,
    nodeType,
    displayData: {
      columns: result.result_data.columns || [],
      data: result.result_data.data || [],
    },
    rawData: results,
  };
}

/**
 * 检查结果是否为多Sheet格式
 */
export function isMultiSheetResult(
  data: SimpleDataframe | SheetInfo[] | null,
): data is SheetInfo[] {
  return Array.isArray(data) && data.length > 0 && "sheet_name" in data[0];
}

/**
 * 检查结果是否为单个DataFrame格式
 */
export function isDataFrameResult(
  data: SimpleDataframe | SheetInfo[] | null,
): data is SimpleDataframe {
  return data !== null && !Array.isArray(data) && "columns" in data;
}

export function dataframeToSheetInfo(data: SimpleDataframe): SheetInfo {
  if (!data.columns || !data.data) {
    return {
      sheet_name: "Sheet1",
      columns: [],
      data: [],
    };
  }
  return {
    sheet_name: "Sheet1",
    columns: data.columns || [],
    data: data.data || [],
  };
}
