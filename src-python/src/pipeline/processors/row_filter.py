"""
行过滤节点处理器
根据用户指定的条件运算规则过滤DataFrame的行
"""

import pandas as pd
from typing import List, Dict, Any

from .base import AbstractNodeProcessor
from ..models import (
    BaseNode, RowFilterInput, RowFilterOutput, DataFrame,
    GlobalContext, PathContext, BranchContext, NodeType
)


class RowFilterProcessor(AbstractNodeProcessor[RowFilterInput, RowFilterOutput]):
    """行过滤节点处理器"""
    
    def __init__(self):
        super().__init__(NodeType.ROW_FILTER)
    
    def process(
        self,
        node: BaseNode,
        input_data: RowFilterInput,
        global_context: GlobalContext,
        path_context: PathContext,
        branch_context: BranchContext = None
    ) -> RowFilterOutput:
        """
        处理行过滤节点
        
        Args:
            node: 节点配置
            input_data: 包含待过滤DataFrame的输入
            global_context: 全局上下文
            path_context: 路径上下文
            branch_context: 分支上下文
            
        Returns:
            过滤后的DataFrame输出
        """
        try:
            exec_id = self.analyzer.onStart(node.id, self.node_type.value)
            data = node.data
            conditions = data.get("conditions", [])
            
            # 获取pandas DataFrame（支持两种输入类型）
            if hasattr(input_data.dataframe, 'to_pandas'):
                pandas_df = input_data.dataframe.to_pandas()
            else:
                pandas_df = input_data.dataframe  # 已经是pandas DataFrame
            
            if not conditions:
                # 无过滤条件，返回原DataFrame
                filtered_df = pandas_df
            else:
                # 应用过滤条件
                filtered_df = self._apply_filter_conditions(pandas_df, conditions)
            
            # 应用测试模式限制
            # filtered_df = self.apply_test_mode_limit(filtered_df, global_context)
            
            # 直接返回pandas DataFrame，避免转换开销
            # custom_df = DataFrame.from_pandas(filtered_df)  # 移除转换
            
            # 更新路径上下文
            path_context.current_dataframe = filtered_df  # 直接使用pandas DataFrame
            path_context.last_non_aggregator_dataframe = filtered_df
            
            self.analyzer.onFinish(exec_id)

            return RowFilterOutput(
                dataframe=filtered_df,  # 直接传递pandas DataFrame
                index_value=input_data.index_value,
                filtered_count=len(filtered_df)
            )
        except Exception as e:
            self.analyzer.onError(exec_id, str(e))
            raise e
    
    def _apply_filter_conditions(
        self, 
        df: pd.DataFrame, 
        conditions: List[Dict[str, Any]]
    ) -> pd.DataFrame:
        """
        应用过滤条件
        
        Args:
            df: 源DataFrame
            conditions: 过滤条件列表
            
        Returns:
            过滤后的DataFrame
        """
        if not conditions:
            return df
        
        # 初始化mask为全True
        mask = pd.Series([True] * len(df), index=df.index)
        
        for i, condition in enumerate(conditions):
            column = condition.get("column")
            operator = condition.get("operator")
            value = condition.get("value")
            logic = condition.get("logic", "AND")  # AND 或 OR
            
            if not column or not operator:
                continue
            
            if column not in df.columns:
                raise ValueError(f"Filter column '{column}' not found in DataFrame")
            
            # 构建单个条件的mask
            condition_mask = self._build_condition_mask(df[column], operator, value)
            
            # 合并条件
            if i == 0:
                mask = condition_mask
            else:
                if logic.upper() == "AND":
                    mask = mask & condition_mask
                elif logic.upper() == "OR":
                    mask = mask | condition_mask
                else:
                    raise ValueError(f"Unknown logic operator: {logic}")
        
        # 应用过滤
        return df[mask].copy()
    
    def _build_condition_mask(
        self, 
        column_data: pd.Series, 
        operator: str, 
        value: Any
    ) -> pd.Series:
        """
        构建单个条件的mask
        
        Args:
            column_data: 列数据
            operator: 操作符
            value: 比较值
            
        Returns:
            条件mask
        """
        if operator == "==":
            return column_data == value
        elif operator == "!=":
            return column_data != value
        elif operator == ">":
            return column_data > value
        elif operator == ">=":
            return column_data >= value
        elif operator == "<":
            return column_data < value
        elif operator == "<=":
            return column_data <= value
        elif operator == "contains":
            return column_data.astype(str).str.contains(str(value), na=False)
        elif operator == "not_contains":
            return ~column_data.astype(str).str.contains(str(value), na=False)
        elif operator == "starts_with":
            return column_data.astype(str).str.startswith(str(value), na=False)
        elif operator == "ends_with":
            return column_data.astype(str).str.endswith(str(value), na=False)
        elif operator == "is_null":
            return column_data.isnull()
        elif operator == "is_not_null":
            return column_data.notnull()
        elif operator == "in":
            # value应该是一个列表
            if not isinstance(value, list):
                raise ValueError("'in' operator requires a list value")
            return column_data.isin(value)
        elif operator == "not_in":
            # value应该是一个列表
            if not isinstance(value, list):
                raise ValueError("'not_in' operator requires a list value")
            return ~column_data.isin(value)
        elif operator == "between":
            # value应该是一个包含两个元素的列表 [min, max]
            if not isinstance(value, list) or len(value) != 2:
                raise ValueError("'between' operator requires a list with two values [min, max]")
            return (column_data >= value[0]) & (column_data <= value[1])
        else:
            raise ValueError(f"Unknown filter operator: {operator}")
    
    def validate_node_config(self, node: BaseNode) -> bool:
        """验证节点配置"""
        if not super().validate_node_config(node):
            return False
        
        data = node.data
        conditions = data.get("conditions", [])
        
        # 验证条件格式
        for condition in conditions:
            if not isinstance(condition, dict):
                return False
            
            required_fields = ["column", "operator"]
            for field in required_fields:
                if field not in condition:
                    return False
            
            # 验证操作符
            valid_operators = [
                "==", "!=", ">", ">=", "<", "<=",
                "contains", "not_contains", "starts_with", "ends_with",
                "is_null", "is_not_null", "in", "not_in", "between"
            ]
            if condition["operator"] not in valid_operators:
                return False
            
            # 特定操作符需要特定的value格式
            operator = condition["operator"]
            value = condition.get("value")
            
            if operator in ["in", "not_in"]:
                if not isinstance(value, list):
                    return False
            elif operator == "between":
                if not isinstance(value, list) or len(value) != 2:
                    return False
            elif operator not in ["is_null", "is_not_null"]:
                # 其他操作符都需要value
                if value is None:
                    return False
        
        return True 