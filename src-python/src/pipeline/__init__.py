"""
重构后的Pipeline执行系统
提供强类型、分层上下文、分治执行的现代化pipeline架构
"""

from .execution.executor import PipelineExecutor
from .models import (
    # 基础类型
    ExecutionMode, NodeType, AggregationOperation, IndexValue, DataFrame,
    
    # 请求和响应类型
    ExecutePipelineRequest, PipelineExecutionResult, WorkspaceConfig,
    
    # 节点输入输出类型
    IndexSourceInput, IndexSourceOutput,
    SheetSelectorInput, SheetSelectorOutput,
    RowFilterInput, RowFilterOutput,
    RowLookupInput, RowLookupOutput,
    AggregatorInput, AggregatorOutput, AggregationResult,
    OutputInput, OutputResult, SheetData,
    
    # 上下文类型
    GlobalContext, PathContext, BranchContext, FileInfo,
    
    # 节点和配置类型
    BaseNode, Edge,
    
    # 执行结果类型
    NodeExecutionResult, IndexExecutionResult, BranchExecutionResult,
    PipelineExecutionSummary
)

# 主要API函数
def execute_pipeline(request: ExecutePipelineRequest) -> PipelineExecutionResult:
    """
    执行Pipeline的主API函数
    
    Args:
        request: Pipeline执行请求，包含工作区配置、目标节点、执行模式等
        
    Returns:
        Pipeline执行结果，包含输出数据、执行统计、错误信息等
        
    Example:
        >>> from pipeline import execute_pipeline, ExecutePipelineRequest, ExecutionMode
        >>> request = ExecutePipelineRequest(
        ...     workspace_config=workspace_config,
        ...     target_node_id="output_node_1",
        ...     execution_mode=ExecutionMode.TEST
        ... )
        >>> result = execute_pipeline(request)
        >>> if result.success:
        ...     print(f"执行成功，输出了 {result.output_data.total_sheets} 个Sheet")
        ... else:
        ...     print(f"执行失败：{result.error}")
    """
    executor = PipelineExecutor()
    return executor.execute_pipeline(request)


# 便捷API函数
def execute_pipeline_simple(
    workspace_config: WorkspaceConfig,
    target_node_id: str,
    execution_mode: ExecutionMode = ExecutionMode.PRODUCTION,
    output_file_path: str = None
) -> PipelineExecutionResult:
    """
    简化的Pipeline执行API
    
    Args:
        workspace_config: 工作区配置
        target_node_id: 目标节点ID
        execution_mode: 执行模式（默认生产模式）
        output_file_path: 输出文件路径（可选）
        
    Returns:
        Pipeline执行结果
    """
    request = ExecutePipelineRequest(
        workspace_config=workspace_config,
        target_node_id=target_node_id,
        execution_mode=execution_mode,
        output_file_path=output_file_path
    )
    return execute_pipeline(request)


# 版本信息
__version__ = "2.0.0"
__author__ = "Pipeline Team"
__description__ = "强类型、分层上下文的现代化Pipeline执行系统"

# 导出所有公共API
__all__ = [
    # 主要API函数
    "execute_pipeline",
    "execute_pipeline_simple",
    
    # 执行器类
    "PipelineExecutor",
    
    # 基础类型
    "ExecutionMode", "NodeType", "AggregationOperation", "IndexValue", "DataFrame",
    
    # 请求响应类型
    "ExecutePipelineRequest", "PipelineExecutionResult", "WorkspaceConfig",
    
    # 节点输入输出类型
    "IndexSourceInput", "IndexSourceOutput",
    "SheetSelectorInput", "SheetSelectorOutput", 
    "RowFilterInput", "RowFilterOutput",
    "RowLookupInput", "RowLookupOutput",
    "AggregatorInput", "AggregatorOutput", "AggregationResult",
    "OutputInput", "OutputResult", "SheetData",
    
    # 上下文类型
    "GlobalContext", "PathContext", "BranchContext", "FileInfo",
    
    # 节点和配置类型
    "BaseNode", "Edge",
    
    # 执行结果类型
    "NodeExecutionResult", "IndexExecutionResult", "BranchExecutionResult",
    "PipelineExecutionSummary",
    
    # 版本信息
    "__version__", "__author__", "__description__"
] 