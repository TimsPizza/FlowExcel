"""
行查找节点处理器
选择目标文件中的一个列，返回包含所有与索引项匹配的行的DataFrame
"""

import pandas as pd

from .base import AbstractNodeProcessor
from ..models import (
    BaseNode,
    RowLookupInput,
    RowLookupOutput,
    DataFrame,
    GlobalContext,
    PathContext,
    BranchContext,
    NodeType,
)


class RowLookupProcessor(AbstractNodeProcessor[RowLookupInput, RowLookupOutput]):
    """行查找节点处理器"""

    def __init__(self):
        super().__init__(NodeType.ROW_LOOKUP)

    def process(
        self,
        node: BaseNode,
        input_data: RowLookupInput,
        global_context: GlobalContext,
        path_context: PathContext,
        branch_context: BranchContext = None,
    ) -> RowLookupOutput:
        """
        处理行查找节点

        Args:
            node: 节点配置
            input_data: 包含源DataFrame和索引值的输入
            global_context: 全局上下文
            path_context: 路径上下文
            branch_context: 分支上下文

        Returns:
            匹配行的DataFrame输出
        """
        try:
            exec_id = self.analyzer.onStart(node.id, self.node_type.value)
            data = node.data
            lookup_column = data.get("matchColumn")
            match_mode = data.get(
                "matchMode", "exact"
            )  # exact, contains, starts_with, ends_with
            case_sensitive = data.get("caseSensitive", False)

            if not lookup_column:
                raise ValueError("lookupColumn is required for row lookup node")

            # 获取pandas DataFrame（支持两种输入类型）
            if hasattr(input_data.dataframe, "to_pandas"):
                pandas_df = input_data.dataframe.to_pandas()
            else:
                pandas_df = input_data.dataframe  # 已经是pandas DataFrame

            # 验证查找列存在
            if lookup_column not in pandas_df.columns:
                raise ValueError(
                    f"Lookup column '{lookup_column}' not found in DataFrame"
                )

            # 执行查找匹配
            matched_df = self._find_matching_rows(
                pandas_df,
                lookup_column,
                input_data.index_value,
                match_mode,
                case_sensitive,
            )

            # 应用测试模式限制
            # matched_df = self.apply_test_mode_limit(matched_df, global_context)

            # 直接返回pandas DataFrame，避免转换开销
            # custom_df = DataFrame.from_pandas(matched_df)  # 移除转换

            # 更新路径上下文
            path_context.current_dataframe = matched_df  # 直接使用pandas DataFrame
            path_context.last_non_aggregator_dataframe = matched_df
            self.analyzer.onFinish(exec_id)

            return RowLookupOutput(
                dataframe=matched_df,  # 直接传递pandas DataFrame
                index_value=input_data.index_value,
                matched_count=len(matched_df),
            )
        except Exception as e:
            self.analyzer.onError(exec_id, str(e))
            raise e

    def _find_matching_rows(
        self,
        df: pd.DataFrame,
        lookup_column: str,
        index_value: str,
        match_mode: str,
        case_sensitive: bool,
    ) -> pd.DataFrame:
        """
        查找匹配的行

        Args:
            df: 源DataFrame
            lookup_column: 查找列名
            index_value: 索引值（查找目标）
            match_mode: 匹配模式
            case_sensitive: 是否大小写敏感

        Returns:
            匹配的行组成的DataFrame
        """
        # 获取查找列数据
        column_data = df[lookup_column].astype(str)
        search_value = str(index_value)

        # 处理大小写敏感性
        if not case_sensitive:
            column_data = column_data.str.lower()
            search_value = search_value.lower()

        # 根据匹配模式构建mask
        if match_mode == "exact":
            mask = column_data == search_value
        elif match_mode == "contains":
            mask = column_data.str.contains(search_value, na=False)
        elif match_mode == "starts_with":
            mask = column_data.str.startswith(search_value, na=False)
        elif match_mode == "ends_with":
            mask = column_data.str.endswith(search_value, na=False)
        elif match_mode == "regex":
            # 正则表达式匹配
            try:
                mask = column_data.str.contains(search_value, regex=True, na=False)
            except Exception as e:
                raise ValueError(f"Invalid regex pattern '{search_value}': {e}")
        else:
            raise ValueError(f"Unknown match mode: {match_mode}")

        # 返回匹配的行
        return df[mask].copy()

    def validate_node_config(self, node: BaseNode) -> bool:
        """验证节点配置"""
        if not super().validate_node_config(node):
            return False

        data = node.data
        lookup_column = data.get("lookupColumn")
        match_mode = data.get("matchMode", "exact")

        # 验证必需字段
        if not lookup_column:
            return False

        # 验证匹配模式
        valid_match_modes = ["exact", "contains", "starts_with", "ends_with", "regex"]
        if match_mode not in valid_match_modes:
            return False

        return True
