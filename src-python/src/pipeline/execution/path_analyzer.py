"""
路径分析器
从目标节点反向分析，识别独立的执行分支和多输入节点
为分支独立执行做准备，避免笛卡尔积性能问题
"""

import networkx as nx
from typing import List, Dict, Set, Tuple, Optional
from dataclasses import dataclass

from ..models import BaseNode, NodeType, Edge


@dataclass
class ExecutionBranch:
    """独立的执行分支"""
    branch_id: str  # 分支标识
    index_source_id: str  # 该分支的索引源节点ID
    execution_nodes: List[str]  # 执行节点序列（从索引源到合并点/目标节点）
    merge_node_id: Optional[str]  # 合并节点ID（如果存在）
    target_node_id: str  # 目标节点ID


@dataclass
class MultiInputNodeInfo:
    """多输入节点信息"""
    node_id: str  # 节点ID
    input_branches: List[str]  # 输入分支ID列表
    node_type: NodeType  # 节点类型


class PathAnalyzer:
    """路径分析器 - 反向分析识别独立执行分支"""
    
    def __init__(self):
        self.graph: Optional[nx.DiGraph] = None
        self.node_map: Dict[str, BaseNode] = {}
    
    def analyze(
        self,
        nodes: List[BaseNode],
        edges: List[Edge],
        target_node_id: str
    ) -> Tuple[Dict[str, ExecutionBranch], Dict[str, MultiInputNodeInfo]]:
        """
        分析执行分支（新的分析方法）
        
        Args:
            nodes: 节点列表
            edges: 边列表
            target_node_id: 目标节点ID
            
        Returns:
            (执行分支字典, 多输入节点信息字典)
        """
        # 构建图
        self._build_graph(nodes, edges)
        
        # 验证目标节点存在
        if target_node_id not in self.node_map:
            raise ValueError(f"Target node {target_node_id} not found")
        
        # 从目标节点反向分析，识别独立的执行分支
        execution_branches = self._analyze_execution_branches(target_node_id)
        
        # 识别多输入节点
        multi_input_nodes = self._identify_multi_input_nodes(execution_branches)
        
        return execution_branches, multi_input_nodes
    
    def _build_graph(self, nodes: List[BaseNode], edges: List[Edge]):
        """构建有向图"""
        self.graph = nx.DiGraph()
        self.node_map = {node.id: node for node in nodes}
        
        # 添加节点
        for node in nodes:
            self.graph.add_node(node.id, node=node)
        
        # 添加边
        for edge in edges:
            self.graph.add_edge(edge.source, edge.target)
    
    def _analyze_execution_branches(self, target_node_id: str) -> Dict[str, ExecutionBranch]:
        """
        从目标节点反向分析，识别独立的执行分支
        
        Args:
            target_node_id: 目标节点ID
            
        Returns:
            执行分支字典
        """
        execution_branches = {}
        
        # 使用BFS从目标节点反向遍历，找到所有到达索引源的路径
        # 每当遇到多输入节点时，为每个输入创建独立的分支
        
        # 初始化：目标节点作为起点
        paths_to_explore = [(target_node_id, [])]  # (当前节点, 路径)
        branch_counter = 0
        
        while paths_to_explore:
            current_node, path_so_far = paths_to_explore.pop(0)
            
            # 获取前驱节点
            predecessors = list(self.graph.predecessors(current_node))
            
            if not predecessors:
                # 没有前驱，检查是否是索引源节点
                if self.node_map[current_node].type == NodeType.INDEX_SOURCE:
                    # 找到一个完整的分支
                    branch_id = f"branch_{branch_counter}"
                    branch_counter += 1
                    
                    # 反转路径（因为我们是反向遍历的）
                    execution_nodes = [current_node] + list(reversed(path_so_far))
                    
                    execution_branches[branch_id] = ExecutionBranch(
                        branch_id=branch_id,
                        index_source_id=current_node,
                        execution_nodes=execution_nodes,
                        merge_node_id=self._find_merge_node(execution_nodes),
                        target_node_id=target_node_id
                    )
                continue
            
            if len(predecessors) == 1:
                # 单输入节点，继续沿路径探索
                new_path = path_so_far + [current_node]
                paths_to_explore.append((predecessors[0], new_path))
            else:
                # 多输入节点，为每个输入创建独立的分支路径
                for predecessor in predecessors:
                    new_path = path_so_far + [current_node]
                    paths_to_explore.append((predecessor, new_path))
        
        return execution_branches
    
    def _find_merge_node(self, execution_nodes: List[str]) -> Optional[str]:
        """
        找到分支的合并节点（如果存在）
        
        Args:
            execution_nodes: 执行节点序列
            
        Returns:
            合并节点ID或None
        """
        # 遍历执行节点，找到第一个有多个前驱的节点（除了索引源）
        for i, node_id in enumerate(execution_nodes[1:], 1):  # 跳过索引源
            predecessors = list(self.graph.predecessors(node_id))
            if len(predecessors) > 1:
                return node_id
        
        return None
    
    def _identify_multi_input_nodes(
        self, 
        execution_branches: Dict[str, ExecutionBranch]
    ) -> Dict[str, MultiInputNodeInfo]:
        """
        识别多输入节点及其输入分支
        
        Args:
            execution_branches: 执行分支字典
            
        Returns:
            多输入节点信息字典
        """
        multi_input_nodes = {}
        
        # 统计每个节点被多少个分支作为输入
        node_input_branches = {}
        for branch_id, branch in execution_branches.items():
            for node_id in branch.execution_nodes:
                if node_id not in node_input_branches:
                    node_input_branches[node_id] = []
                node_input_branches[node_id].append(branch_id)
        
        # 识别多输入节点
        for node_id, input_branches in node_input_branches.items():
            if len(input_branches) > 1:
                multi_input_nodes[node_id] = MultiInputNodeInfo(
                    node_id=node_id,
                    input_branches=input_branches,
                    node_type=self.node_map[node_id].type
                )
        
        return multi_input_nodes
    
    # 保留一些兼容性方法，供现有代码使用
    def get_index_sources(self) -> List[str]:
        """获取所有索引源节点ID"""
        return [
            node_id for node_id, node in self.node_map.items()
            if node.type == NodeType.INDEX_SOURCE
        ]
    
    def validate_graph_structure(self) -> bool:
        """验证图结构的合理性"""
        if not self.graph:
            return False
        
        # 检查是否是有向无环图
        if not nx.is_directed_acyclic_graph(self.graph):
            return False
        
        # 检查是否至少有一个索引源节点
        index_sources = self.get_index_sources()
        if not index_sources:
            return False
        
        return True 