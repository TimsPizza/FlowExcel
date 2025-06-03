"""
聚合节点处理器
用于聚合数据，具体是根据目标列名和运算操作对传入DataFrame中的所有行进行聚合
聚合节点的特殊性：
1. 始终以最近的非聚合节点输出的完整DataFrame作为输入
2. 在分支中具有独立的上下文，避免相互污染
3. 结果存储在分支上下文中，用于最终合并
"""

import pandas as pd
import numpy as np

from .base import AbstractNodeProcessor
from ..models import (
    BaseNode,
    AggregatorInput,
    AggregatorOutput,
    AggregationResult,
    AggregationOperation,
    GlobalContext,
    PathContext,
    BranchContext,
    NodeType,
)


class AggregatorProcessor(AbstractNodeProcessor[AggregatorInput, AggregatorOutput]):
    """聚合节点处理器"""

    def __init__(self):
        super().__init__(NodeType.AGGREGATOR)

    def process(
        self,
        node: BaseNode,
        input_data: AggregatorInput,
        global_context: GlobalContext,
        path_context: PathContext,
        branch_context: BranchContext = None,
    ) -> AggregatorOutput:
        """
        处理聚合节点

        Args:
            node: 节点配置
            input_data: 包含完整上游DataFrame的输入
            global_context: 全局上下文
            path_context: 路径上下文
            branch_context: 分支上下文（聚合结果将存储在这里）

        Returns:
            聚合结果输出
        """
        data = node.data
        target_column = data.get("statColumn")
        operation = data.get("method")
        output_column_name = data.get("outputAs") or operation + "_" + target_column

        if not target_column:
            raise ValueError("targetColumn is required for aggregator node")
        if not operation:
            raise ValueError("operation is required for aggregator node")
        if not output_column_name:
            raise ValueError("outputColumnName is required for aggregator node")

        # 验证操作类型
        try:
            agg_operation = AggregationOperation(operation)
        except ValueError:
            raise ValueError(f"Invalid aggregation operation: {operation}")

        # 转换为pandas DataFrame进行处理
        pandas_df = input_data.dataframe.to_pandas()

        # 验证目标列存在
        if target_column not in pandas_df.columns:
            raise ValueError(f"Target column '{target_column}' not found in DataFrame")

        # 执行聚合操作
        result_value = self._perform_aggregation(
            pandas_df, target_column, agg_operation
        )

        # 创建聚合结果
        aggregation_result = AggregationResult(
            index_value=input_data.index_value,
            column_name=output_column_name,
            operation=agg_operation,
            result_value=result_value,
        )

        # 将结果存储到分支上下文中（如果存在）
        if branch_context is not None:
            branch_context.add_aggregation_result(aggregation_result)

        # 注意：聚合节点不更新path_context.current_dataframe
        # 因为聚合节点的输出是统计结果，不是DataFrame
        # path_context.last_non_aggregator_dataframe保持不变

        return AggregatorOutput(result=aggregation_result)

    def _perform_aggregation(
        self, df: pd.DataFrame, column: str, operation: AggregationOperation
    ) -> float | int | str | None:
        """
        执行聚合操作

        Args:
            df: 源DataFrame
            column: 目标列名
            operation: 聚合操作

        Returns:
            聚合结果值
        """
        column_data = df[column]

        # 处理空DataFrame
        if len(df) == 0:
            return None

        try:
            if operation == AggregationOperation.SUM:
                # 求和 - 只对数值列有效
                numeric_data = pd.to_numeric(column_data, errors="coerce")
                return (
                    float(numeric_data.sum()) if not numeric_data.isna().all() else None
                )

            elif operation == AggregationOperation.COUNT:
                # 计数 - 计算非空值的数量
                return int(column_data.notna().sum())

            elif operation == AggregationOperation.AVERAGE:
                # 平均值 - 只对数值列有效
                numeric_data = pd.to_numeric(column_data, errors="coerce")
                return (
                    float(numeric_data.mean())
                    if not numeric_data.isna().all()
                    else None
                )

            elif operation == AggregationOperation.MIN:
                # 最小值 - 先尝试数值，再尝试字符串
                numeric_data = pd.to_numeric(column_data, errors="coerce")
                if not numeric_data.isna().all():
                    return float(numeric_data.min())
                else:
                    # 对于非数值数据，按字符串排序取最小值
                    non_null_data = column_data.dropna()
                    return str(non_null_data.min()) if len(non_null_data) > 0 else None

            elif operation == AggregationOperation.MAX:
                # 最大值 - 先尝试数值，再尝试字符串
                numeric_data = pd.to_numeric(column_data, errors="coerce")
                if not numeric_data.isna().all():
                    return float(numeric_data.max())
                else:
                    # 对于非数值数据，按字符串排序取最大值
                    non_null_data = column_data.dropna()
                    return str(non_null_data.max()) if len(non_null_data) > 0 else None

            elif operation == AggregationOperation.FIRST:
                # 第一个非空值
                first_value = (
                    column_data.dropna().iloc[0]
                    if len(column_data.dropna()) > 0
                    else None
                )
                return self._convert_to_serializable(first_value)

            elif operation == AggregationOperation.LAST:
                # 最后一个非空值
                last_value = (
                    column_data.dropna().iloc[-1]
                    if len(column_data.dropna()) > 0
                    else None
                )
                return self._convert_to_serializable(last_value)

            else:
                raise ValueError(f"Unsupported aggregation operation: {operation}")

        except Exception as e:
            raise ValueError(f"Error performing {operation} on column '{column}': {e}")

    def _convert_to_serializable(self, value) -> float | int | str | None:
        """
        将值转换为JSON可序列化的格式

        Args:
            value: 原始值

        Returns:
            可序列化的值
        """
        if value is None or pd.isna(value):
            return None

        # 处理numpy类型
        if isinstance(value, (np.integer, np.int64, np.int32)):
            return int(value)
        elif isinstance(value, (np.floating, np.float64, np.float32)):
            return float(value)
        elif isinstance(value, (np.bool_, bool)):
            return bool(value)
        else:
            return str(value)

    def validate_node_config(self, node: BaseNode) -> bool:
        """验证节点配置"""
        if not super().validate_node_config(node):
            return False

        data = node.data
        target_column = data.get("statColumn")
        operation = data.get("method")
        output_column_name = data.get("outputAs") or operation + "_" + target_column

        # 验证必需字段
        if not target_column or not operation or not output_column_name:
            return False

        # 验证操作类型
        valid_operations = [op.value for op in AggregationOperation]
        if operation not in valid_operations:
            return False

        return True
