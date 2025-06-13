"""
行过滤节点处理器
根据用户指定的条件运算规则过滤DataFrame的行
"""

import pandas as pd
from typing import List, Dict, Any, Tuple

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
        构建单个条件的mask（类型安全版本）
        
        Args:
            column_data: 列数据
            operator: 操作符
            value: 比较值
            
        Returns:
            条件mask
        """
        try:
            # 处理特殊操作符（不需要值比较）
            if operator == "is_null":
                return column_data.isnull()
            elif operator == "is_not_null":
                return column_data.notnull()
            
            # 字符串操作符（统一转换为字符串）
            if operator in ["contains", "not_contains", "starts_with", "ends_with"]:
                return self._build_string_condition_mask(column_data, operator, value)
            
            # 集合操作符
            if operator in ["in", "not_in"]:
                return self._build_set_condition_mask(column_data, operator, value)
            
            # 范围操作符
            if operator == "between":
                return self._build_range_condition_mask(column_data, value)
            
            # 比较操作符（需要类型安全处理）
            if operator in ["==", "!=", ">", ">=", "<", "<="]:
                return self._build_comparison_condition_mask(column_data, operator, value)
            
            else:
                raise ValueError(f"Unknown filter operator: {operator}")
                
        except Exception as e:
            # 安全回退：任何错误都返回全False的mask，并记录警告
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(
                f"Filter condition failed for operator '{operator}' with value '{value}': {str(e)}. "
                f"Returning empty result for safety."
            )
            return pd.Series([False] * len(column_data), index=column_data.index)
    
    def _build_string_condition_mask(
        self, 
        column_data: pd.Series, 
        operator: str, 
        value: Any
    ) -> pd.Series:
        """构建字符串条件mask"""
        try:
            # 统一转换为字符串
            str_data = column_data.astype(str)
            str_value = str(value)
            
            if operator == "contains":
                return str_data.str.contains(str_value, na=False)
            elif operator == "not_contains":
                return ~str_data.str.contains(str_value, na=False)
            elif operator == "starts_with":
                return str_data.str.startswith(str_value, na=False)
            elif operator == "ends_with":
                return str_data.str.endswith(str_value, na=False)
            else:
                raise ValueError(f"Unknown string operator: {operator}")
                
        except Exception as e:
            raise ValueError(f"String operation failed: {str(e)}")
    
    def _build_set_condition_mask(
        self, 
        column_data: pd.Series, 
        operator: str, 
        value: Any
    ) -> pd.Series:
        """构建集合条件mask"""
        try:
            if operator == "in":
                if not isinstance(value, list):
                    raise ValueError("'in' operator requires a list value")
                return column_data.isin(value)
            elif operator == "not_in":
                if not isinstance(value, list):
                    raise ValueError("'not_in' operator requires a list value")
                return ~column_data.isin(value)
            else:
                raise ValueError(f"Unknown set operator: {operator}")
                
        except Exception as e:
            raise ValueError(f"Set operation failed: {str(e)}")
    
    def _build_range_condition_mask(
        self, 
        column_data: pd.Series, 
        value: Any
    ) -> pd.Series:
        """构建范围条件mask"""
        try:
            if not isinstance(value, list) or len(value) != 2:
                raise ValueError("'between' operator requires a list with two values [min, max]")
            
            min_val, max_val = value[0], value[1]
            
            # 尝试数值比较
            converted_data, converted_min, converted_max, success = self._safe_numeric_conversion(
                column_data, min_val, max_val
            )
            
            if success:
                return (converted_data >= converted_min) & (converted_data <= converted_max)
            else:
                # 回退到字符串比较
                str_data = column_data.astype(str)
                str_min, str_max = str(min_val), str(max_val)
                return (str_data >= str_min) & (str_data <= str_max)
                
        except Exception as e:
            raise ValueError(f"Range operation failed: {str(e)}")
    
    def _build_comparison_condition_mask(
        self, 
        column_data: pd.Series, 
        operator: str, 
        value: Any
    ) -> pd.Series:
        """构建比较条件mask（类型安全）"""
        try:
            # 尝试数值比较
            if operator in [">", ">=", "<", "<="]:
                converted_data, converted_value, success = self._safe_numeric_comparison_conversion(
                    column_data, value
                )
                
                if success:
                    return self._apply_comparison_operator(converted_data, operator, converted_value)
                else:
                    # 数值转换失败，回退到字符串比较
                    str_data = column_data.astype(str)
                    str_value = str(value)
                    return self._apply_comparison_operator(str_data, operator, str_value)
            
            # 等值比较（支持跨类型）
            elif operator in ["==", "!="]:
                # 首先尝试直接比较
                try:
                    if operator == "==":
                        mask = column_data == value
                    else:  # operator == "!="
                        mask = column_data != value
                    
                    # 检查是否产生了有效的mask
                    if isinstance(mask, pd.Series) and not mask.isna().all():
                        return mask
                    else:
                        raise ValueError("Direct comparison failed")
                        
                except (TypeError, ValueError):
                    # 直接比较失败，尝试类型转换后比较
                    return self._safe_equality_comparison(column_data, operator, value)
            
            else:
                raise ValueError(f"Unknown comparison operator: {operator}")
                
        except Exception as e:
            raise ValueError(f"Comparison operation failed: {str(e)}")
    
    def _safe_numeric_conversion(
        self, 
        column_data: pd.Series, 
        *values
    ) -> Tuple:
        """
        安全的数值转换
        
        Returns:
            (converted_data, *converted_values, success)
        """
        try:
            # 检查是否有非空数据
            non_null_count = column_data.notna().sum()
            if non_null_count == 0:
                # 如果所有数据都是空值，无法进行数值转换
                return (column_data, *values, False)
            
            # 尝试转换列数据
            converted_data = pd.to_numeric(column_data, errors='coerce')
            
            # 计算转换成功率
            converted_count = converted_data.notna().sum()
            success_rate = converted_count / non_null_count if non_null_count > 0 else 0.0
            
            if success_rate < 0.8:  # 成功率低于80%，认为不适合数值比较
                return (column_data, *values, False)
            
            # 转换比较值
            converted_values = []
            for val in values:
                try:
                    converted_val = pd.to_numeric(val, errors='raise')
                    converted_values.append(converted_val)
                except (TypeError, ValueError):
                    # 如果比较值无法转换为数值，则放弃数值转换
                    return (column_data, *values, False)
            
            return (converted_data, *converted_values, True)
            
        except Exception:
            return (column_data, *values, False)
    
    def _safe_numeric_comparison_conversion(
        self, 
        column_data: pd.Series, 
        value: Any
    ) -> Tuple[pd.Series, Any, bool]:
        """安全的数值比较转换"""
        return self._safe_numeric_conversion(column_data, value)[:3]
    
    def _safe_equality_comparison(
        self, 
        column_data: pd.Series, 
        operator: str, 
        value: Any
    ) -> pd.Series:
        """安全的等值比较"""
        try:
            # 尝试数值转换
            converted_data, converted_value, numeric_success = self._safe_numeric_comparison_conversion(
                column_data, value
            )
            
            if numeric_success:
                if operator == "==":
                    return converted_data == converted_value
                else:  # operator == "!="
                    return converted_data != converted_value
            
            # 数值转换失败，使用字符串比较
            str_data = column_data.astype(str)
            str_value = str(value)
            
            if operator == "==":
                return str_data == str_value
            else:  # operator == "!="
                return str_data != str_value
                
        except Exception as e:
            # 最后的安全回退
            raise ValueError(f"All comparison methods failed: {str(e)}")
    
    def _apply_comparison_operator(
        self, 
        data: pd.Series, 
        operator: str, 
        value: Any
    ) -> pd.Series:
        """应用比较操作符"""
        if operator == "==":
            return data == value
        elif operator == "!=":
            return data != value
        elif operator == ">":
            return data > value
        elif operator == ">=":
            return data >= value
        elif operator == "<":
            return data < value
        elif operator == "<=":
            return data <= value
        else:
            raise ValueError(f"Unknown comparison operator: {operator}")
    
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