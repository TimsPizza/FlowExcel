"""
抽象节点处理器基类
提供所有节点处理器的通用功能和接口
"""

from abc import ABC, abstractmethod
from typing import TypeVar, Generic
import pandas as pd

from ..models import (
    BaseNode,
    GlobalContext,
    PathContext,
    BranchContext,
    NodeType,
    NodeExecutionResult,
    ExecutionMode,
)
from ..performance.analyzer import get_performance_analyzer

# 泛型类型变量
InputType = TypeVar("InputType")
OutputType = TypeVar("OutputType")


class AbstractNodeProcessor(ABC, Generic[InputType, OutputType]):
    """抽象节点处理器基类"""

    def __init__(self, node_type: NodeType):
        self.node_type = node_type
        self.analyzer = get_performance_analyzer()

    @abstractmethod
    def process(
        self,
        node: BaseNode,
        input_data: InputType,
        global_context: GlobalContext,
        path_context: PathContext,
        branch_context: BranchContext = None,
    ) -> OutputType:
        """
        处理节点的核心逻辑

        Args:
            node: 节点配置
            input_data: 输入数据
            global_context: 全局上下文
            path_context: 路径上下文
            branch_context: 分支上下文（可选）

        Returns:
            处理结果
        """
        pass

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
        self, global_context: GlobalContext, file_id: str, sheet_name: str
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
            # 缓存命中
            self.analyzer.onCacheHit(cache_key)
            return global_context.loaded_dataframes[cache_key]

        # 缓存未命中，需要加载文件
        self.analyzer.onCacheMiss(cache_key)
        
        # 获取header row信息
        header_row = 0
        for sheet_meta in file_info.sheet_metas:
            if sheet_meta["sheet_name"] == sheet_name:
                header_row = sheet_meta.get("header_row", 0)
                break

        # 加载DataFrame with performance monitoring
        read_id = self.analyzer.onExcelReadStart(file_info.path, sheet_name)
        
        try:
            df = pd.read_excel(file_info.path, sheet_name=sheet_name, header=header_row)
            
            # 获取文件大小（可选，用于更详细的性能分析）
            try:
                import os
                file_size = os.path.getsize(file_info.path)
            except:
                file_size = None
            
            self.analyzer.onExcelReadFinish(read_id, len(df), file_size)
            
        except Exception as e:
            self.analyzer.onExcelReadFinish(read_id, 0, None)
            raise e

        # 缓存DataFrame
        global_context.loaded_dataframes[cache_key] = df

        return df

    def apply_test_mode_limit(
        self, df: pd.DataFrame, global_context: GlobalContext, max_rows: int = 100
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
        if global_context.execution_mode == ExecutionMode.TEST:
            try:
                df_len = len(df) if hasattr(df, "__len__") else 0
                if df_len > max_rows:
                    should_limit = True
                else:
                    should_limit = False
            except ValueError:
                # 如果长度检查出现问题，默认不限制
                should_limit = False

            if should_limit:
                return df.head(max_rows)
        return df
