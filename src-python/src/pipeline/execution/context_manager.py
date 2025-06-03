"""
上下文管理器
负责创建和管理全局、路径、分支等各层级的执行上下文
确保上下文的正确隔离和生命周期管理
"""

from typing import Dict, List
import copy

from ..models import (
    GlobalContext, PathContext, BranchContext, FileInfo, IndexValue,
    ExecutionMode, WorkspaceConfig
)


class ContextManager:
    """上下文管理器"""
    
    def __init__(self):
        self.global_context: GlobalContext = None
        self.active_branch_contexts: Dict[str, BranchContext] = {}
    
    def create_global_context(
        self,
        workspace_config: WorkspaceConfig,
        execution_mode: ExecutionMode
    ) -> GlobalContext:
        """
        创建全局执行上下文
        
        Args:
            workspace_config: 工作区配置
            execution_mode: 执行模式
            
        Returns:
            全局上下文
        """
        # 转换文件信息
        files = {file_info.id: file_info for file_info in workspace_config.files}
        
        self.global_context = GlobalContext(
            files=files,
            loaded_dataframes={},  # 空的DataFrame缓存
            execution_mode=execution_mode
        )
        
        return self.global_context
    
    def create_path_context(self, index_value: IndexValue) -> PathContext:
        """
        创建路径执行上下文
        
        Args:
            index_value: 当前索引值
            
        Returns:
            路径上下文
        """
        return PathContext(
            current_index=index_value,
            last_non_aggregator_dataframe=None,
            current_dataframe=None,
            execution_trace=[]
        )
    
    def create_branch_context(self, branch_id: str, index_source_node_id: str) -> BranchContext:
        """
        创建分支执行上下文（长期存在）
        
        Args:
            branch_id: 分支标识
            index_source_node_id: 分支对应的索引源节点ID
            
        Returns:
            分支上下文
        """
        if branch_id in self.active_branch_contexts:
            # 如果分支上下文已经存在，直接返回
            return self.active_branch_contexts[branch_id]
        
        branch_context = BranchContext(
            branch_id=branch_id,
            index_source_node_id=index_source_node_id,
            aggregation_results={},
            branch_metadata={}
        )
        
        # 保存到活跃分支上下文中
        self.active_branch_contexts[branch_id] = branch_context
        
        return branch_context
    
    def get_branch_context(self, branch_id: str) -> BranchContext:
        """
        获取已存在的分支上下文
        
        Args:
            branch_id: 分支标识
            
        Returns:
            分支上下文
            
        Raises:
            ValueError: 如果分支上下文不存在
        """
        if branch_id not in self.active_branch_contexts:
            raise ValueError(f"Branch context '{branch_id}' not found")
        
        return self.active_branch_contexts[branch_id]
    
    def get_or_create_branch_context(self, branch_id: str, index_source_node_id: str = None) -> BranchContext:
        """
        获取或创建分支上下文
        
        Args:
            branch_id: 分支标识
            index_source_node_id: 分支对应的索引源节点ID（创建时必须提供）
            
        Returns:
            分支上下文
        """
        if branch_id in self.active_branch_contexts:
            return self.active_branch_contexts[branch_id]
        else:
            if index_source_node_id is None:
                raise ValueError(f"index_source_node_id is required when creating new branch context for {branch_id}")
            return self.create_branch_context(branch_id, index_source_node_id)
    
    def merge_branch_contexts(
        self, 
        branch_ids: List[str]
    ) -> Dict[IndexValue, Dict[str, any]]:
        """
        合并多个分支上下文的聚合结果
        
        Args:
            branch_ids: 要合并的分支ID列表
            
        Returns:
            合并后的聚合结果字典
        """
        merged_results = {}
        
        for branch_id in branch_ids:
            if branch_id not in self.active_branch_contexts:
                continue
            
            branch_context = self.active_branch_contexts[branch_id]
            branch_final_results = branch_context.get_final_results()
            
            # 合并结果
            for index_value, aggregations in branch_final_results.items():
                if index_value not in merged_results:
                    merged_results[index_value] = {}
                
                # 合并聚合结果，检查列名冲突
                for column_name, value in aggregations.items():
                    if column_name in merged_results[index_value]:
                        raise ValueError(
                            f"Duplicate aggregation column '{column_name}' "
                            f"for index '{index_value}' in branches {branch_ids}"
                        )
                    merged_results[index_value][column_name] = value
        
        return merged_results
    
    def validate_aggregation_consistency(
        self, 
        branch_ids: List[str]
    ) -> bool:
        """
        验证分支间聚合结果的一致性
        
        Args:
            branch_ids: 分支ID列表
            
        Returns:
            是否一致
        """
        if not branch_ids:
            return True
        
        # 获取第一个分支的索引值集合作为基准
        first_branch_id = branch_ids[0]
        if first_branch_id not in self.active_branch_contexts:
            return False
        
        first_branch = self.active_branch_contexts[first_branch_id]
        expected_indices = set(first_branch.aggregation_results.keys())
        
        # 检查其他分支是否有相同的索引值集合
        for branch_id in branch_ids[1:]:
            if branch_id not in self.active_branch_contexts:
                return False
            
            branch_context = self.active_branch_contexts[branch_id]
            branch_indices = set(branch_context.aggregation_results.keys())
            
            if branch_indices != expected_indices:
                return False
        
        return True
    
    def cleanup_branch_contexts(self, branch_ids: List[str] = None):
        """
        清理分支上下文
        
        Args:
            branch_ids: 要清理的分支ID列表，如果为None则清理所有
        """
        if branch_ids is None:
            branch_ids = list(self.active_branch_contexts.keys())
        
        for branch_id in branch_ids:
            if branch_id in self.active_branch_contexts:
                del self.active_branch_contexts[branch_id]
    
    def get_active_branch_count(self) -> int:
        """获取活跃分支上下文数量"""
        return len(self.active_branch_contexts)
    
    def copy_path_context(self, source_context: PathContext) -> PathContext:
        """
        复制路径上下文（用于分支执行）
        
        Args:
            source_context: 源路径上下文
            
        Returns:
            复制的路径上下文
        """
        return PathContext(
            current_index=source_context.current_index,
            last_non_aggregator_dataframe=source_context.last_non_aggregator_dataframe,
            current_dataframe=source_context.current_dataframe,
            execution_trace=source_context.execution_trace.copy()
        )
    
    def update_path_context_trace(self, context: PathContext, node_id: str, action: str):
        """
        更新路径上下文的执行轨迹
        
        Args:
            context: 路径上下文
            node_id: 节点ID
            action: 执行动作描述
        """
        trace_entry = f"{node_id}: {action}"
        context.execution_trace.append(trace_entry)
    
    def get_context_summary(self) -> Dict[str, any]:
        """
        获取上下文管理器的摘要信息
        
        Returns:
            摘要信息字典
        """
        summary = {
            "global_context_exists": self.global_context is not None,
            "active_branch_count": len(self.active_branch_contexts),
            "active_branch_ids": list(self.active_branch_contexts.keys())
        }
        
        if self.global_context:
            summary.update({
                "execution_mode": self.global_context.execution_mode.value,
                "loaded_files_count": len(self.global_context.files),
                "cached_dataframes_count": len(self.global_context.loaded_dataframes)
            })
        
        # 添加分支上下文的详细信息
        branch_details = {}
        for branch_id, branch_context in self.active_branch_contexts.items():
            branch_details[branch_id] = {
                "aggregation_results_count": len(branch_context.aggregation_results),
                "processed_indices": list(branch_context.aggregation_results.keys())
            }
        
        summary["branch_details"] = branch_details
        
        return summary 