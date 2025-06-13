"""
Sheet选择器节点处理器
根据索引值选择对应的Sheet并返回DataFrame
"""

import pandas as pd

from .base import AbstractNodeProcessor
from ..models import (
    BaseNode,
    SheetSelectorInput,
    SheetSelectorOutput,
    DataFrame,
    GlobalContext,
    PathContext,
    BranchContext,
    NodeType,
)


class SheetSelectorProcessor(
    AbstractNodeProcessor[SheetSelectorInput, SheetSelectorOutput]
):
    """Sheet选择器节点处理器"""

    def __init__(self):
        super().__init__(NodeType.SHEET_SELECTOR)

    def process(
        self,
        node: BaseNode,
        input_data: SheetSelectorInput,
        global_context: GlobalContext,
        path_context: PathContext,
        branch_context: BranchContext = None,
    ) -> SheetSelectorOutput:
        """
        处理Sheet选择器节点

        Args:
            node: 节点配置
            input_data: 包含索引值的输入
            global_context: 全局上下文
            path_context: 路径上下文
            branch_context: 分支上下文

        Returns:
            选中的DataFrame输出
        """
        try:
            exec_id = self.analyzer.onStart(node.id, self.node_type.value)
            data = node.data
            target_file_id = data.get("targetFileID")
            mode = data.get("mode", "auto_by_index")
            manual_sheet_name = data.get("manualSheetName")
            match_column = data.get("matchColumn")  # 当mode为column_match时使用

            if not target_file_id:
                raise ValueError("targetFileID is required for sheet selector node")

            if target_file_id not in global_context.files:
                raise ValueError(f"File {target_file_id} not found in context")

            file_info = global_context.files[target_file_id]

            # 确定要使用的sheet名
            if mode == "manual":
                if not manual_sheet_name:
                    raise ValueError(
                        "manualSheetName is required when mode is 'manual'"
                    )
                sheet_name = manual_sheet_name
            elif mode == "auto_by_index":
                # 根据索引值自动匹配sheet名
                sheet_name = str(input_data.index_value)
            elif mode == "column_match":
                # 根据列匹配模式选择sheet
                if not match_column:
                    raise ValueError(
                        "matchColumn is required when mode is 'column_match'"
                    )
                sheet_name = self._find_sheet_by_column_match(
                    file_info, input_data.index_value, match_column, global_context
                )
            else:
                raise ValueError(f"Unknown mode: {mode}")

            # 验证sheet是否存在
            available_sheets = [meta["sheet_name"] for meta in file_info.sheet_metas]
            if sheet_name not in available_sheets:
                raise ValueError(
                    f"Sheet '{sheet_name}' not found in file '{file_info.name}'. "
                    f"Available sheets: {available_sheets}"
                )

            # 加载DataFrame
            pandas_df = self.load_dataframe_from_file(
                global_context, target_file_id, sheet_name
            )

            # 更新路径上下文
            path_context.current_dataframe = pandas_df  # 直接使用pandas DataFrame
            if path_context.last_non_aggregator_dataframe is None:
                path_context.last_non_aggregator_dataframe = pandas_df

            self.analyzer.onFinish(exec_id)

            return SheetSelectorOutput(
                dataframe=pandas_df,  # 直接传递pandas DataFrame
                sheet_name=sheet_name,
                index_value=input_data.index_value,
            )
        except Exception as e:
            self.analyzer.onError(exec_id, str(e))
            raise e

    def _find_sheet_by_column_match(
        self,
        file_info,
        index_value: str,
        match_column: str,
        global_context: GlobalContext,
    ) -> str:
        """
        通过列匹配找到对应的sheet

        Args:
            file_info: 文件信息
            index_value: 索引值
            match_column: 匹配列名
            global_context: 全局上下文

        Returns:
            匹配的sheet名
        """
        for sheet_meta in file_info.sheet_metas:
            sheet_name = sheet_meta["sheet_name"]
            try:
                # 加载sheet并检查是否包含匹配值
                df = self.load_dataframe_from_file(
                    global_context, file_info.id, sheet_name
                )

                if match_column in df.columns:
                    # 检查该列是否包含索引值
                    if index_value in df[match_column].astype(str).values:
                        return sheet_name
            except Exception:
                # 如果加载失败，跳过这个sheet
                continue

        raise ValueError(
            f"No sheet found with column '{match_column}' containing value '{index_value}'"
        )

    def validate_node_config(self, node: BaseNode) -> bool:
        """验证节点配置"""
        if not super().validate_node_config(node):
            return False

        data = node.data
        target_file_id = data.get("targetFileID")
        mode = data.get("mode", "auto_by_index")

        if not target_file_id:
            return False

        if mode == "manual":
            return bool(data.get("manualSheetName"))
        elif mode == "column_match":
            return bool(data.get("matchColumn"))
        elif mode == "auto_by_index":
            return True
        else:
            return False
