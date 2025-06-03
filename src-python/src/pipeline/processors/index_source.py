"""
索引源节点处理器
从指定文件和列提取索引值列表
"""

import pandas as pd
from typing import List

from .base import AbstractNodeProcessor
from ..models import (
    BaseNode, IndexSourceInput, IndexSourceOutput, IndexValue,
    GlobalContext, PathContext, BranchContext, NodeType
)


class IndexSourceProcessor(AbstractNodeProcessor[IndexSourceInput, IndexSourceOutput]):
    """索引源节点处理器"""
    
    def __init__(self):
        super().__init__(NodeType.INDEX_SOURCE)
    
    def process(
        self,
        node: BaseNode,
        input_data: IndexSourceInput,
        global_context: GlobalContext,
        path_context: PathContext,
        branch_context: BranchContext = None
    ) -> IndexSourceOutput:
        """
        处理索引源节点
        
        Args:
            node: 节点配置
            input_data: 空输入（索引源节点无输入）
            global_context: 全局上下文
            path_context: 路径上下文
            branch_context: 分支上下文
            
        Returns:
            索引值列表输出
        """
        data = node.data
        source_file_id = data.get("sourceFileID")
        sheet_name = data.get("sheetName")
        column_name = data.get("columnName")
        by_column = data.get("byColumn", True)
        
        if not source_file_id:
            raise ValueError("sourceFileID is required for index source node")
        
        if by_column:
            # 按列提取索引值
            if not sheet_name or not column_name:
                raise ValueError("sheetName and columnName are required when byColumn is True")
            
            # 加载DataFrame
            df = self.load_dataframe_from_file(global_context, source_file_id, sheet_name)
            
            # 验证列存在
            if column_name not in df.columns:
                raise ValueError(f"Column '{column_name}' not found in sheet '{sheet_name}'")
            
            # 提取唯一值并转换为IndexValue类型
            unique_values = df[column_name].dropna().unique()
            index_values = [IndexValue(str(val)) for val in unique_values]
            
            return IndexSourceOutput(
                index_values=index_values,
                source_column=column_name
            )
        else:
            # 按sheet名提取索引值
            if not source_file_id or source_file_id not in global_context.files:
                raise ValueError(f"File {source_file_id} not found")
            
            file_info = global_context.files[source_file_id]
            
            # 提取所有非空sheet名作为索引值
            sheet_names = []
            for sheet_meta in file_info.sheet_metas:
                if sheet_meta.get("sheet_name"):
                    sheet_names.append(sheet_meta["sheet_name"])
            
            index_values = [IndexValue(name) for name in sheet_names]
            
            return IndexSourceOutput(
                index_values=index_values,
                source_column=None
            )
    
    def validate_node_config(self, node: BaseNode) -> bool:
        """验证节点配置"""
        if not super().validate_node_config(node):
            return False
        
        data = node.data
        source_file_id = data.get("sourceFileID")
        by_column = data.get("byColumn", True)
        
        if not source_file_id:
            return False
        
        if by_column:
            # 按列模式需要sheet名和列名
            return bool(data.get("sheetName") and data.get("columnName"))
        else:
            # 按sheet名模式只需要文件ID
            return True 