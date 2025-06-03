import {
  AggregatorNodeDataContext,
  FlowNodeData,
  IndexSourceNodeDataContext,
  NodeType,
  OutputNodeDataContext,
  RowFilterNodeDataContext,
  RowLookupNodeDataContext,
  SheetSelectorNodeDataContext,
} from "@/types/nodes";
import { Connection, Node, Edge } from "reactflow";

/**
 * 节点连接规则定义
 * 定义了每种节点类型可以连接到哪些后续节点类型
 */
export const NODE_CONNECTION_RULES: Record<NodeType, NodeType[]> = {
  [NodeType.INDEX_SOURCE]: [NodeType.SHEET_SELECTOR],
  [NodeType.SHEET_SELECTOR]: [
    NodeType.AGGREGATOR,
    NodeType.ROW_LOOKUP,
    NodeType.ROW_FILTER,
  ],
  [NodeType.ROW_FILTER]: [
    NodeType.ROW_LOOKUP,
    NodeType.AGGREGATOR,
    NodeType.OUTPUT,
  ],
  [NodeType.ROW_LOOKUP]: [
    NodeType.AGGREGATOR,
    NodeType.ROW_FILTER,
    NodeType.OUTPUT,
  ],
  [NodeType.AGGREGATOR]: [NodeType.AGGREGATOR, NodeType.OUTPUT],
  [NodeType.OUTPUT]: [], // 输出节点无后续
};

/**
 * 节点类型描述
 */
export const NODE_TYPE_DESCRIPTIONS: Record<NodeType, string> = {
  [NodeType.INDEX_SOURCE]:
    "你希望统计哪些数据项？比如，你希望对某张表的某列进行统计，选择“列名”，并选择那个列，否则选择“工作表名”",
  [NodeType.SHEET_SELECTOR]:
    "关于索引项如何匹配工作表，如果索引项对应某个excel文件的表名，请选择自动匹配，否则请选择手动匹配",
  [NodeType.ROW_FILTER]: "对上一级的表的所有行进行条件过滤",
  [NodeType.ROW_LOOKUP]: "筛选每个索引项对应的所有行，你不会想统计无关数据",
  [NodeType.AGGREGATOR]:
    "对上一级的输出表的某列进行统计，串联多个该类型节点不会影响统计结果",
  [NodeType.OUTPUT]: "指定数据输出到哪里？注意，每个输入都会被保存为一张工作表",
};

export const NODE_TYPE_NAMES: Record<NodeType, string> = {
  [NodeType.INDEX_SOURCE]: "索引源",
  [NodeType.SHEET_SELECTOR]: "工作表定位",
  [NodeType.ROW_FILTER]: "行过滤",
  [NodeType.ROW_LOOKUP]: "行查找/列匹配",
  [NodeType.AGGREGATOR]: "统计/聚合",
  [NodeType.OUTPUT]: "输出",
};

/**
 * 验证连接是否有效
 */
export function isValidConnection(
  connection: Connection,
  nodes: Node[],
  edges: Edge[],
): { isValid: boolean; reason?: string } {
  if (!connection.source || !connection.target) {
    return { isValid: false, reason: "连接缺少源节点或目标节点" };
  }

  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);

  if (!sourceNode || !targetNode) {
    return { isValid: false, reason: "找不到对应的节点" };
  }

  const sourceType = sourceNode.data.nodeType as NodeType;
  const targetType = targetNode.data.nodeType as NodeType;

  // 检查连接规则
  const allowedTargets = NODE_CONNECTION_RULES[sourceType];
  if (!allowedTargets.includes(targetType)) {
    return {
      isValid: false,
      reason: `${NODE_TYPE_NAMES[sourceType]} 不能连接到 ${NODE_TYPE_NAMES[targetType]}`,
    };
  }

  // 检查是否已存在相同的连接
  const existingConnection = edges.find(
    (edge) =>
      edge.source === connection.source && edge.target === connection.target,
  );
  if (existingConnection) {
    return { isValid: false, reason: "已存在相同的连接" };
  }

  // 检查单入节点限制
  const singleInputNodeTypes = [
    NodeType.SHEET_SELECTOR,
    NodeType.ROW_FILTER,
    NodeType.ROW_LOOKUP,
    NodeType.AGGREGATOR,
  ];
  if (singleInputNodeTypes.includes(targetType)) {
    const existingInputs = edges.filter(
      (edge) => edge.target === connection.target,
    );
    if (existingInputs.length > 0) {
      return {
        isValid: false,
        reason: `${NODE_TYPE_NAMES[targetType]} 只能有一个输入连接`,
      };
    }
  }

  return { isValid: true };
}

/**
 * 获取节点可以创建的后续节点类型
 */
export function getAvailableNextNodeTypes(
  sourceNodeId: string,
  nodes: Node[],
  edges: Edge[],
): NodeType[] {
  const sourceNode = nodes.find((n) => n.id === sourceNodeId);
  if (!sourceNode) return [];

  const sourceType = sourceNode.data.nodeType as NodeType;
  const allowedTypes = NODE_CONNECTION_RULES[sourceType];

  // 对于单出节点（如聚合节点），检查是否已有输出
  if (sourceType === NodeType.AGGREGATOR) {
    const existingOutputs = edges.filter(
      (edge) => edge.source === sourceNodeId,
    );
    if (existingOutputs.length > 0) {
      // 聚合节点已有输出，只能继续连接聚合或输出
      return allowedTypes;
    }
  }

  return allowedTypes;
}

/**
 * 检查流程的完整性
 */
export function validateFlow(
  nodes: Node[],
  edges: Edge[],
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查是否有索引源节点
  const indexSourceNodes = nodes.filter(
    (n) => n.data.nodeType === NodeType.INDEX_SOURCE,
  );
  if (indexSourceNodes.length === 0) {
    errors.push("流程必须包含至少一个索引源节点");
  }

  // 检查是否有输出节点
  const outputNodes = nodes.filter((n) => n.data.nodeType === NodeType.OUTPUT);
  if (outputNodes.length === 0) {
    errors.push("流程必须包含至少一个输出节点");
  }

  // 检查孤立节点
  nodes.forEach((node) => {
    const hasIncoming = edges.some((edge) => edge.target === node.id);
    const hasOutgoing = edges.some((edge) => edge.source === node.id);

    if (node.data.nodeType !== NodeType.INDEX_SOURCE && !hasIncoming) {
      warnings.push(`节点 "${node.data.label}" 没有输入连接`);
    }

    if (node.data.nodeType !== NodeType.OUTPUT && !hasOutgoing) {
      warnings.push(`节点 "${node.data.label}" 没有输出连接`);
    }
  });

  // 检查连接的有效性
  edges.forEach((edge) => {
    const connection: Connection = {
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || null,
      targetHandle: edge.targetHandle || null,
    };
    const validation = isValidConnection(
      connection,
      nodes,
      edges.filter((e) => e.id !== edge.id),
    );
    if (!validation.isValid) {
      errors.push(`无效连接: ${validation.reason}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 节点输入输出特性
 */
export interface NodeIOConfig {
  maxInputs: number; // -1 表示无限制
  maxOutputs: number; // -1 表示无限制
  requiresInput: boolean;
  requiresOutput: boolean;
}

export const NODE_IO_CONFIG: Record<NodeType, NodeIOConfig> = {
  [NodeType.INDEX_SOURCE]: {
    maxInputs: 0,
    maxOutputs: -1,
    requiresInput: false,
    requiresOutput: true,
  },
  [NodeType.SHEET_SELECTOR]: {
    maxInputs: 1,
    maxOutputs: -1,
    requiresInput: true,
    requiresOutput: true,
  },
  [NodeType.ROW_FILTER]: {
    maxInputs: 1,
    maxOutputs: -1,
    requiresInput: true,
    requiresOutput: false,
  },
  [NodeType.ROW_LOOKUP]: {
    maxInputs: 1,
    maxOutputs: -1,
    requiresInput: true,
    requiresOutput: false,
  },
  [NodeType.AGGREGATOR]: {
    maxInputs: 1,
    maxOutputs: 1,
    requiresInput: true,
    requiresOutput: false,
  },
  [NodeType.OUTPUT]: {
    maxInputs: -1,
    maxOutputs: 0,
    requiresInput: true,
    requiresOutput: false,
  },
};

// 初始节点数据生成函数
export const getInitialNodeData = (
  type: NodeType,
  nodeId: string,
): FlowNodeData => {
  switch (type) {
    case NodeType.INDEX_SOURCE:
      return {
        id: nodeId,
        nodeType: NodeType.INDEX_SOURCE,
        label: "索引源",
        sourceFileID: undefined,
        bySheetName: false,
        sheetName: undefined,
        byColumn: true,
        columnName: "",
        testResult: undefined,
        error: undefined,
      } as IndexSourceNodeDataContext;
    case NodeType.SHEET_SELECTOR:
      return {
        id: nodeId,
        nodeType: NodeType.SHEET_SELECTOR,
        label: "Sheet定位",
        targetFileID: undefined,
        mode: "auto_by_index",
        manualSheetName: undefined,
        testResult: undefined,
        error: undefined,
      } as SheetSelectorNodeDataContext;
    case NodeType.ROW_FILTER:
      return {
        id: nodeId,
        nodeType: NodeType.ROW_FILTER,
        label: "行过滤",
        conditions: [],
        testResult: undefined,
        error: undefined,
      } as RowFilterNodeDataContext;
    case NodeType.ROW_LOOKUP:
      return {
        id: nodeId,
        nodeType: NodeType.ROW_LOOKUP,
        label: "行查找/列匹配",
        matchColumn: undefined,
        testResult: undefined,
        error: undefined,
      } as RowLookupNodeDataContext;
    case NodeType.AGGREGATOR:
      return {
        id: nodeId,
        nodeType: NodeType.AGGREGATOR,
        label: "统计",
        statColumn: undefined,
        method: "sum",
        outputAs: "",
        testResult: undefined,
        error: undefined,
      } as AggregatorNodeDataContext;
    case NodeType.OUTPUT:
      return {
        id: nodeId,
        nodeType: NodeType.OUTPUT,
        label: "输出",
        outputFormat: "table",
        outputPath: undefined,
        testResult: undefined,
        error: undefined,
      } as OutputNodeDataContext;
    default:
      return {
        id: nodeId,
        nodeType: type,
        label: NODE_TYPE_DESCRIPTIONS[type],
        testResult: undefined,
        error: undefined,
      } as FlowNodeData;
  }
};
