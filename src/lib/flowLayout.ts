import dagre from 'dagre';
import { Node, Edge, Position } from 'reactflow';
import { FlowNodeData } from '@/types/nodes';

// 节点尺寸配置
const NODE_WIDTH = 250;
const NODE_HEIGHT = 100;

/**
 * 使用Dagre算法自动排版ReactFlow节点
 * @param nodes 要排版的节点数组
 * @param edges 节点间的连接关系
 * @param direction 布局方向 ('TB' = 从上到下, 'LR' = 从左到右)
 * @returns 重新定位后的节点数组
 */
export function getAutoLayoutedElements(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): Node<FlowNodeData>[] {
  // 创建一个新的有向图
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // 设置图的布局属性
  dagreGraph.setGraph({
    rankdir: direction, // 布局方向：TB(从上到下) 或 LR(从左到右)
    align: 'UL', // 对齐方式：UL(上左对齐)
    nodesep: 100, // 同一层级节点之间的间距
    ranksep: 100, // 不同层级之间的间距
    marginx: 50, // 左右边距
    marginy: 50, // 上下边距
  });

  // 添加节点到图中
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  });

  // 添加边到图中
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // 执行布局算法
  dagre.layout(dagreGraph);

  // 将布局结果应用到节点上
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    return {
      ...node,
      targetPosition: direction === 'LR' ? Position.Left : Position.Top,
      sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return layoutedNodes;
}

/**
 * 基于拓扑排序的简单层次布局
 * 这是一个备用的布局算法，当Dagre不可用时使用
 * @param nodes 要排版的节点数组
 * @param edges 节点间的连接关系
 * @returns 重新定位后的节点数组
 */
export function getSimpleHierarchicalLayout(
  nodes: Node<FlowNodeData>[],
  edges: Edge[]
): Node<FlowNodeData>[] {
  // 构建邻接表
  const adjacencyList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // 初始化所有节点的入度
  nodes.forEach(node => {
    adjacencyList.set(node.id, []);
    inDegree.set(node.id, 0);
  });

  // 构建图和计算入度
  edges.forEach(edge => {
    const sourceList = adjacencyList.get(edge.source) || [];
    sourceList.push(edge.target);
    adjacencyList.set(edge.source, sourceList);
    
    const targetInDegree = inDegree.get(edge.target) || 0;
    inDegree.set(edge.target, targetInDegree + 1);
  });

  // 拓扑排序
  const levels: string[][] = [];
  const queue: string[] = [];

  // 找到所有入度为0的节点（根节点）
  nodes.forEach(node => {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
    }
  });

  // 按层级组织节点
  while (queue.length > 0) {
    const currentLevel = [...queue];
    levels.push(currentLevel);
    queue.length = 0;

    currentLevel.forEach(nodeId => {
      const neighbors = adjacencyList.get(nodeId) || [];
      neighbors.forEach(neighborId => {
        const newInDegree = (inDegree.get(neighborId) || 0) - 1;
        inDegree.set(neighborId, newInDegree);
        
        if (newInDegree === 0) {
          queue.push(neighborId);
        }
      });
    });
  }

  // 计算每个节点的位置
  const layoutedNodes = nodes.map(node => {
    let levelIndex = 0;
    let positionInLevel = 0;

    // 找到节点所在的层级
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const index = level.indexOf(node.id);
      if (index !== -1) {
        levelIndex = i;
        positionInLevel = index;
        break;
      }
    }

    // 计算位置
    const x = positionInLevel * (NODE_WIDTH + 50) + 100;
    const y = levelIndex * (NODE_HEIGHT + 80) + 100;

    return {
      ...node,
      position: { x, y },
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
    };
  });

  return layoutedNodes;
} 