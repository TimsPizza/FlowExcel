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
import { v4 as uuidv4 } from "uuid";
import i18n from "@/lib/i18n";

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
  [NodeType.INDEX_SOURCE]: "node.indexSourceNode.help",
  [NodeType.SHEET_SELECTOR]: "node.sheetSelectorNode.help",
  [NodeType.ROW_FILTER]: "node.rowFilterNode.help",
  [NodeType.ROW_LOOKUP]: "node.rowLookupNode.help",
  [NodeType.AGGREGATOR]: "node.aggregatorNode.help",
  [NodeType.OUTPUT]: "node.outputNode.help",
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
    return { isValid: false, reason: i18n.t("flow.validation.missingNodes") };
  }

  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);

  if (!sourceNode || !targetNode) {
    return { isValid: false, reason: i18n.t("flow.validation.nodeNotFound") };
  }

  const sourceType = sourceNode.data.nodeType as NodeType;
  const targetType = targetNode.data.nodeType as NodeType;

  // 检查连接规则
  const allowedTargets = NODE_CONNECTION_RULES[sourceType];
  if (!allowedTargets.includes(targetType)) {
    return {
      isValid: false,
      reason: i18n.t("flow.validation.invalidConnection", {
        source: i18n.t(`node.${sourceType}`),
        target: i18n.t(`node.${targetType}`),
      }),
    };
  }

  // 检查是否已存在相同的连接
  const existingConnection = edges.find(
    (edge) =>
      edge.source === connection.source && edge.target === connection.target,
  );
  if (existingConnection) {
    return {
      isValid: false,
      reason: i18n.t("flow.validation.connectionExists"),
    };
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
        reason: i18n.t("flow.validation.singleInputOnly", {
          nodeType: i18n.t(`node.${targetType}`),
        }),
      };
    }
  }

  // 检查是否会产生环路
  if (wouldCreateCycle(connection, nodes, edges)) {
    return {
      isValid: false,
      reason: i18n.t("flow.validation.cycleDetected"),
    };
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
 * 检测图中是否存在环路
 * 使用深度优先搜索算法检测有向图中的环路
 */
export function detectCycle(nodes: Node[], edges: Edge[]): boolean {
  // 节点访问状态: 0-未访问, 1-正在访问, 2-已访问完成
  const visitState = new Map<string, number>();

  // 构建邻接表
  const adjacencyList = new Map<string, string[]>();

  // 初始化所有节点
  nodes.forEach((node) => {
    visitState.set(node.id, 0);
    adjacencyList.set(node.id, []);
  });

  // 构建邻接表
  edges.forEach((edge) => {
    const neighbors = adjacencyList.get(edge.source) || [];
    neighbors.push(edge.target);
    adjacencyList.set(edge.source, neighbors);
  });

  // DFS检测环路
  function dfs(nodeId: string): boolean {
    const state = visitState.get(nodeId);

    // 如果正在访问，说明找到了环路
    if (state === 1) {
      return true;
    }

    // 如果已访问完成，跳过
    if (state === 2) {
      return false;
    }

    // 标记为正在访问
    visitState.set(nodeId, 1);

    // 递归访问所有邻居节点
    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) {
        return true;
      }
    }

    // 标记为已访问完成
    visitState.set(nodeId, 2);
    return false;
  }

  // 对所有未访问的节点进行DFS
  for (const node of nodes) {
    if (visitState.get(node.id) === 0) {
      if (dfs(node.id)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 检测添加新连接后是否会产生环路
 */
export function wouldCreateCycle(
  connection: Connection,
  nodes: Node[],
  edges: Edge[],
): boolean {
  if (!connection.source || !connection.target) {
    return false;
  }

  // 创建临时边集合，包含新连接
  const tempEdges = [
    ...edges,
    {
      id: `temp-${connection.source}-${connection.target}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle || null,
      targetHandle: connection.targetHandle || null,
    },
  ];

  // 检测是否存在环路
  return detectCycle(nodes, tempEdges);
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
    errors.push(i18n.t("flow.validation.needIndexSource"));
  }

  // 检查是否有输出节点
  const outputNodes = nodes.filter((n) => n.data.nodeType === NodeType.OUTPUT);
  if (outputNodes.length === 0) {
    errors.push(i18n.t("flow.validation.needOutput"));
  } else if (outputNodes.length > 1) {
    errors.push(i18n.t("flow.validation.singleOutputOnly"));
  }

  // 检查孤立节点
  nodes.forEach((node) => {
    const hasIncoming = edges.some((edge) => edge.target === node.id);
    const hasOutgoing = edges.some((edge) => edge.source === node.id);

    if (node.data.nodeType !== NodeType.INDEX_SOURCE && !hasIncoming) {
      warnings.push(
        i18n.t("flow.validation.noInput", { label: node.data.label }),
      );
    }

    if (node.data.nodeType !== NodeType.OUTPUT && !hasOutgoing) {
      warnings.push(
        i18n.t("flow.validation.noOutput", { label: node.data.label }),
      );
    }
  });

  // 检查是否存在环路
  if (detectCycle(nodes, edges)) {
    errors.push(i18n.t("flow.validation.cycleInFlow"));
  }

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
      errors.push(
        i18n.t("flow.validation.invalidConnectionDetail", {
          reason: validation.reason,
        }),
      );
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
        label: i18n.t("node.index_source"),
        displayName: i18n.t("node.dataSourcePrefix") + uuidv4().slice(0, 4),
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
        label: i18n.t("node.sheet_selector"),
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
        label: i18n.t("node.row_filter"),
        conditions: [],
        testResult: undefined,
        error: undefined,
      } as RowFilterNodeDataContext;
    case NodeType.ROW_LOOKUP:
      return {
        id: nodeId,
        nodeType: NodeType.ROW_LOOKUP,
        label: i18n.t("node.row_lookup"),
        matchColumn: undefined,
        testResult: undefined,
        error: undefined,
      } as RowLookupNodeDataContext;
    case NodeType.AGGREGATOR:
      return {
        id: nodeId,
        nodeType: NodeType.AGGREGATOR,
        label: i18n.t("node.aggregator"),
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
        label: i18n.t("node.output"),
        outputFormat: "table",
        outputPath: undefined,
        testResult: undefined,
        error: undefined,
      } as OutputNodeDataContext;
    default:
      return {
        id: nodeId,
        nodeType: type,
        label: i18n.t(NODE_TYPE_DESCRIPTIONS[type]),
        testResult: undefined,
        error: undefined,
      } as FlowNodeData;
  }
};
