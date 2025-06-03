"""
分支执行器
处理复杂的分支执行逻辑，包括分支内节点的执行和结果合并
确保聚合节点的特殊处理和上下文隔离
"""

from typing import Dict, List, Any
import time

from .path_analyzer import BranchInfo
from .context_manager import ContextManager
from ..models import (
    BaseNode, NodeType, IndexValue, 
    GlobalContext, PathContext, BranchContext,
    NodeExecutionResult, BranchExecutionResult,
    AggregatorInput, OutputInput
)
from ..processors import (
    IndexSourceProcessor, SheetSelectorProcessor, RowFilterProcessor,
    RowLookupProcessor, AggregatorProcessor, OutputProcessor
)


class BranchExecutor:
    """分支执行器"""
    
    def __init__(self, context_manager: ContextManager):
        self.context_manager = context_manager
        
        # 初始化节点处理器
        self.processors = {
            NodeType.INDEX_SOURCE: IndexSourceProcessor(),
            NodeType.SHEET_SELECTOR: SheetSelectorProcessor(),
            NodeType.ROW_FILTER: RowFilterProcessor(),
            NodeType.ROW_LOOKUP: RowLookupProcessor(),
            NodeType.AGGREGATOR: AggregatorProcessor(),
            NodeType.OUTPUT: OutputProcessor(),
        }
    
    def execute_branches_for_index(
        self,
        index_value: IndexValue,
        branch_infos: Dict[str, BranchInfo],
        node_map: Dict[str, BaseNode],
        path_context: PathContext,
        global_context: GlobalContext
    ) -> List[NodeExecutionResult]:
        """
        为单个索引值执行所有分支
        
        Args:
            index_value: 当前索引值
            branch_infos: 分支信息字典
            node_map: 节点映射
            path_context: 路径上下文
            global_context: 全局上下文
            
        Returns:
            节点执行结果列表
        """
        all_results = []
        
        # 按分支点分组执行
        branch_points = set(info.branch_point for info in branch_infos.values())
        
        for branch_point in branch_points:
            # 找到从这个分支点开始的所有分支
            point_branches = [
                info for info in branch_infos.values() 
                if info.branch_point == branch_point
            ]
            
            # 执行这一组并行分支
            branch_results = self._execute_parallel_branches(
                index_value, point_branches, node_map, path_context, global_context
            )
            
            all_results.extend(branch_results)
        
        return all_results
    
    def _execute_parallel_branches(
        self,
        index_value: IndexValue,
        branches: List[BranchInfo],
        node_map: Dict[str, BaseNode],
        path_context: PathContext,
        global_context: GlobalContext
    ) -> List[NodeExecutionResult]:
        """
        执行并行分支
        
        Args:
            index_value: 当前索引值
            branches: 并行分支列表
            node_map: 节点映射
            path_context: 路径上下文
            global_context: 全局上下文
            
        Returns:
            节点执行结果列表
        """
        all_results = []
        
        for branch_info in branches:
            # 获取或创建分支上下文
            branch_context = self.context_manager.create_branch_context(branch_info.branch_id)
            
            # 复制路径上下文用于分支执行
            branch_path_context = self.context_manager.copy_path_context(path_context)
            
            # 执行分支内的节点
            branch_results = self._execute_nodes_in_branch(
                index_value, branch_info, node_map, branch_path_context, 
                branch_context, global_context
            )
            
            all_results.extend(branch_results)
        
        return all_results
    
    def _execute_nodes_in_branch(
        self,
        index_value: IndexValue,
        branch_info: BranchInfo,
        node_map: Dict[str, BaseNode],
        path_context: PathContext,
        branch_context: BranchContext,
        global_context: GlobalContext
    ) -> List[NodeExecutionResult]:
        """
        执行分支内的节点
        
        Args:
            index_value: 当前索引值
            branch_info: 分支信息
            node_map: 节点映射
            path_context: 分支路径上下文
            branch_context: 分支上下文
            global_context: 全局上下文
            
        Returns:
            节点执行结果列表
        """
        results = []
        
        for node_id in branch_info.branch_nodes:
            if node_id not in node_map:
                continue
            
            node = node_map[node_id]
            
            try:
                # 执行节点
                result = self._execute_single_node(
                    node, index_value, path_context, branch_context, global_context
                )
                results.append(result)
                
                # 更新执行轨迹
                self.context_manager.update_path_context_trace(
                    path_context, node_id, f"executed in branch {branch_info.branch_id}"
                )
                
            except Exception as e:
                # 记录执行失败的节点
                error_result = NodeExecutionResult(
                    node_id=node_id,
                    node_type=node.type,
                    success=False,
                    output=None,
                    error=str(e),
                    execution_time_ms=0.0
                )
                results.append(error_result)
        
        return results
    
    def _execute_single_node(
        self,
        node: BaseNode,
        index_value: IndexValue,
        path_context: PathContext,
        branch_context: BranchContext,
        global_context: GlobalContext
    ) -> NodeExecutionResult:
        """
        执行单个节点
        
        Args:
            node: 节点配置
            index_value: 当前索引值
            path_context: 路径上下文
            branch_context: 分支上下文
            global_context: 全局上下文
            
        Returns:
            节点执行结果
        """
        processor = self.processors.get(node.type)
        if not processor:
            raise ValueError(f"No processor found for node type: {node.type}")
        
        # 准备节点输入
        input_data = self._prepare_node_input(node, index_value, path_context)
        
        # 执行节点
        result = processor.execute(
            node, input_data, global_context, path_context, branch_context
        )
        
        # 更新路径上下文（如果节点执行成功且不是聚合节点）
        if result.success and result.output and node.type != NodeType.AGGREGATOR:
            self._update_path_context_from_output(path_context, node.type, result.output)
        
        return result
    
    def _prepare_node_input(self, node: BaseNode, index_value: IndexValue, path_context: PathContext):
        """
        准备节点输入数据
        
        Args:
            node: 节点配置
            index_value: 当前索引值
            path_context: 路径上下文
            
        Returns:
            节点输入数据
        """
        from ..models import (
            IndexSourceInput, SheetSelectorInput, RowFilterInput,
            RowLookupInput, AggregatorInput, OutputInput
        )
        
        if node.type == NodeType.INDEX_SOURCE:
            return IndexSourceInput()
        
        elif node.type == NodeType.SHEET_SELECTOR:
            return SheetSelectorInput(index_value=index_value)
        
        elif node.type == NodeType.ROW_FILTER:
            if path_context.current_dataframe is None:
                raise ValueError("No current dataframe available for row filter")
            return RowFilterInput(
                dataframe=path_context.current_dataframe,
                index_value=index_value
            )
        
        elif node.type == NodeType.ROW_LOOKUP:
            if path_context.current_dataframe is None:
                raise ValueError("No current dataframe available for row lookup")
            return RowLookupInput(
                dataframe=path_context.current_dataframe,
                index_value=index_value
            )
        
        elif node.type == NodeType.AGGREGATOR:
            # 聚合节点的特殊输入：使用最近的非聚合节点输出
            if path_context.last_non_aggregator_dataframe is None:
                raise ValueError("No non-aggregator dataframe available for aggregator")
            return AggregatorInput(
                dataframe=path_context.last_non_aggregator_dataframe,
                index_value=index_value
            )
        
        elif node.type == NodeType.OUTPUT:
            # 输出节点需要特殊处理，在主执行器中处理
            raise ValueError("Output node should be handled by main executor")
        
        else:
            raise ValueError(f"Unknown node type: {node.type}")
    
    def _update_path_context_from_output(self, path_context: PathContext, node_type: NodeType, output):
        """
        根据节点输出更新路径上下文
        
        Args:
            path_context: 路径上下文
            node_type: 节点类型
            output: 节点输出
        """
        # 只有非聚合节点的输出会更新路径上下文
        if node_type == NodeType.AGGREGATOR:
            return
        
        # 更新当前DataFrame
        if hasattr(output, 'dataframe'):
            path_context.current_dataframe = output.dataframe
            path_context.last_non_aggregator_dataframe = output.dataframe
    
    def create_branch_execution_result(
        self,
        branch_id: str,
        processed_indices: List[IndexValue]
    ) -> BranchExecutionResult:
        """
        创建分支执行结果
        
        Args:
            branch_id: 分支ID
            processed_indices: 处理的索引值列表
            
        Returns:
            分支执行结果
        """
        try:
            branch_context = self.context_manager.get_branch_context(branch_id)
            final_aggregations = branch_context.get_final_results()
            
            return BranchExecutionResult(
                branch_id=branch_id,
                success=True,
                final_aggregations=final_aggregations,
                processed_indices=processed_indices,
                error=None
            )
        except Exception as e:
            return BranchExecutionResult(
                branch_id=branch_id,
                success=False,
                final_aggregations={},
                processed_indices=processed_indices,
                error=str(e)
            ) 