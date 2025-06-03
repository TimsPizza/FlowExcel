"""
抽象节点处理器基类
定义所有节点处理器必须实现的接口
"""

from abc import ABC, abstractmethod
from typing import TypeVar, Generic
import time
import pandas as pd

from ..models import (
    NodeInput, NodeOutput, BaseNode, 
    GlobalContext, PathContext, BranchContext,
    NodeExecutionResult, NodeType
)

# 泛型类型变量
InputType = TypeVar('InputType', bound=NodeInput)
OutputType = TypeVar('OutputType', bound=NodeOutput)


class AbstractNodeProcessor(ABC, Generic[InputType, OutputType]):
    """抽象节点处理器基类"""
    
    def __init__(self, node_type: NodeType):
        self.node_type = node_type
    
    @abstractmethod
    def process(
        self, 
        node: BaseNode,
        input_data: InputType,
        global_context: GlobalContext,
        path_context: PathContext,
        branch_context: BranchContext = None
    ) -> OutputType:
        """
        处理节点逻辑的核心方法
        
        Args:
            node: 节点配置信息
            input_data: 节点输入数据
            global_context: 全局执行上下文
            path_context: 路径执行上下文
            branch_context: 分支执行上下文（可选）
            
        Returns:
            节点输出数据
        """
        pass
    
    def execute(
        self,
        node: BaseNode,
        input_data: InputType,
        global_context: GlobalContext,
        path_context: PathContext,
        branch_context: BranchContext = None
    ) -> NodeExecutionResult:
        """
        执行节点并包装执行结果
        
        Args:
            node: 节点配置信息
            input_data: 节点输入数据
            global_context: 全局执行上下文
            path_context: 路径执行上下文
            branch_context: 分支执行上下文（可选）
            
        Returns:
            包装的节点执行结果
        """
        start_time = time.time()
        
        try:
            # 执行节点处理逻辑
            output = self.process(node, input_data, global_context, path_context, branch_context)
            
            execution_time = (time.time() - start_time) * 1000  # 转换为毫秒
            
            return NodeExecutionResult(
                node_id=node.id,
                node_type=self.node_type,
                success=True,
                output=output,
                error=None,
                execution_time_ms=execution_time
            )
            
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            
            return NodeExecutionResult(
                node_id=node.id,
                node_type=self.node_type,
                success=False,
                output=None,
                error=str(e),
                execution_time_ms=execution_time
            )
    
    def validate_input(self, input_data: InputType) -> bool:
        """
        验证输入数据的有效性
        
        Args:
            input_data: 输入数据
            
        Returns:
            验证是否通过
        """
        # 基础实现，子类可以重写
        return input_data is not None
    
    def validate_node_config(self, node: BaseNode) -> bool:
        """
        验证节点配置的有效性
        
        Args:
            node: 节点配置
            
        Returns:
            验证是否通过
        """
        # 基础实现，子类可以重写
        return node.type == self.node_type and node.data is not None
    
    def load_dataframe_from_file(
        self,
        global_context: GlobalContext,
        file_id: str,
        sheet_name: str
    ) -> pd.DataFrame:
        """
        从文件加载DataFrame的辅助方法
        
        Args:
            global_context: 全局上下文
            file_id: 文件ID
            sheet_name: Sheet名称
            
        Returns:
            加载的pandas DataFrame
        """
        if file_id not in global_context.files:
            raise ValueError(f"File {file_id} not found in context")
        
        file_info = global_context.files[file_id]
        
        # 检查缓存
        cache_key = f"{file_id}_{sheet_name}"
        if cache_key in global_context.loaded_dataframes:
            return global_context.loaded_dataframes[cache_key]
        
        # 获取header row信息
        header_row = 0
        for sheet_meta in file_info.sheet_metas:
            if sheet_meta["sheet_name"] == sheet_name:
                header_row = sheet_meta.get("header_row", 0)
                break
        
        # 加载DataFrame
        df = pd.read_excel(file_info.path, sheet_name=sheet_name, header=header_row)
        
        # 缓存DataFrame
        global_context.loaded_dataframes[cache_key] = df
        
        return df
    
    def apply_test_mode_limit(
        self,
        df: pd.DataFrame,
        global_context: GlobalContext,
        max_rows: int = 100
    ) -> pd.DataFrame:
        """
        应用测试模式的行数限制
        
        Args:
            df: 原始DataFrame
            global_context: 全局上下文
            max_rows: 最大行数限制
            
        Returns:
            限制后的DataFrame
        """
        from ..models import ExecutionMode
        
        if global_context.execution_mode == ExecutionMode.TEST and len(df) > max_rows:
            return df.head(max_rows)
        return df 