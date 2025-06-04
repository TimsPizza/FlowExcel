"""
输出节点处理器
用于输出结果，接受来自不同pipeline的多个聚合结果，输出多个sheet
以pipeline的索引值作为sheet名，对应的聚合结果作为sheet内容
"""

import pandas as pd
from typing import Dict, List
import os

from .base import AbstractNodeProcessor
from ..models import (
    BaseNode,
    OutputInput,
    OutputResult,
    SheetData,
    DataFrame,
    IndexValue,
    GlobalContext,
    PathContext,
    BranchContext,
    NodeType,
    ExecutionMode,
)
from ..execution.context_manager import ContextManager


class OutputProcessor(AbstractNodeProcessor[OutputInput, OutputResult]):
    """输出节点处理器"""

    def __init__(self):
        super().__init__(NodeType.OUTPUT)

    def process(
        self,
        node: BaseNode,
        input_data: OutputInput,
        global_context: GlobalContext,
        path_context: PathContext,
        branch_context: BranchContext = None,
        node_map: Dict[str, BaseNode] = None,
        context_manager: ContextManager = None,
    ) -> OutputResult:
        """
        处理输出节点 - 按分支创建Sheet

        Args:
            node: 节点配置
            input_data: 包含按分支组织的聚合结果的输入
            global_context: 全局上下文
            path_context: 路径上下文
            branch_context: 分支上下文
            node_map: 节点映射（用于获取索引源节点信息）
            context_manager: 上下文管理器（用于获取分支上下文）

        Returns:
            多Sheet输出结果（每个分支一个Sheet）
        """
        try:
            exec_id = self.analyzer.onStart(node.id, self.node_type.value)
            data = node.data
            output_file_path = data.get("outputFilePath")
            include_index_column = data.get("includeIndexColumn", True)
            index_column_name = data.get("indexColumnName", "索引")

            # 创建Sheet数据列表
            sheets = []
            # 遍历各分支，为每个分支创建一个Sheet
            for (
                branch_id,
                branch_aggregations,
            ) in input_data.branch_aggregated_results.items():
                sheet_data = self._create_sheet_for_branch(
                    branch_id,
                    branch_aggregations,
                    include_index_column,
                    index_column_name,
                    global_context,
                    node_map,
                    context_manager,
                )
                sheets.append(sheet_data)

            # 如果是生产模式且指定了输出路径，则写入文件
            if (
                global_context.execution_mode == ExecutionMode.PRODUCTION
                and output_file_path
            ):
                self._write_output_file(sheets, output_file_path)

            self.analyzer.onFinish(exec_id)

            return OutputResult(sheets=sheets, total_sheets=len(sheets))
        except Exception as e:
            self.analyzer.onError(exec_id, str(e))
            raise e

    def _create_sheet_for_branch(
        self,
        branch_id: str,
        branch_aggregations: Dict[IndexValue, Dict[str, float | int | str | None]],
        include_index_column: bool,
        index_column_name: str,
        global_context: GlobalContext,
        node_map: Dict[str, BaseNode] = None,
        context_manager=None,
    ) -> SheetData:
        """
        为单个分支创建Sheet数据（包含该分支所有索引值的聚合结果）

        Args:
            branch_id: 分支ID
            branch_aggregations: 该分支的聚合结果 {索引值: {列名: 值}}
            include_index_column: 是否包含索引列
            index_column_name: 索引列名
            global_context: 全局上下文
            node_map: 节点映射（用于获取索引源节点信息）
            context_manager: 上下文管理器（用于获取分支上下文）

        Returns:
            Sheet数据
        """
        if not branch_aggregations:
            # 空分支，创建空Sheet
            columns = [index_column_name] if include_index_column else []
            df = DataFrame(columns=columns, data=[], total_rows=0)
            source_name = self._get_source_name_for_branch(
                branch_id, global_context, node_map, context_manager
            )
            return SheetData(
                sheet_name=source_name or f"Branch_{branch_id}",
                dataframe=df,
                branch_id=branch_id,
                source_name=source_name,
            )

        # 收集所有列名（来自不同索引值的聚合结果）
        all_columns = set()
        for aggregations in branch_aggregations.values():
            all_columns.update(aggregations.keys())

        # 排序列名以保证一致性
        sorted_columns = sorted(all_columns)

        # 准备表头
        if include_index_column:
            columns = [index_column_name] + sorted_columns
        else:
            columns = sorted_columns

        # 准备数据行
        data_rows = []
        for index_value, aggregations in sorted(branch_aggregations.items()):
            if include_index_column:
                row = [str(index_value)]
            else:
                row = []

            # 按列顺序添加聚合值，如果某个索引值没有某列的值则用None填充
            for col in sorted_columns:
                row.append(aggregations.get(col, None))

            data_rows.append(row)

        # 创建DataFrame
        df = DataFrame(columns=columns, data=data_rows, total_rows=len(data_rows))

        # 获取易读的源名称（通过分支上下文中的索引源节点ID）
        source_name = self._get_source_name_for_branch(
            branch_id, global_context, node_map, context_manager
        )

        # 使用源名称作为Sheet名
        sheet_name = source_name or f"分支_{branch_id}"

        return SheetData(
            sheet_name=sheet_name,
            dataframe=df,
            branch_id=branch_id,
            source_name=source_name,
        )

    def _get_source_name_for_branch(
        self,
        branch_id: str,
        global_context: GlobalContext,
        node_map: Dict[str, BaseNode] = None,
        context_manager: ContextManager = None,
    ) -> str:
        """
        获取分支对应的索引源的易读名称

        Args:
            branch_id: 分支ID
            global_context: 全局上下文
            node_map: 节点映射
            context_manager: 上下文管理器

        Returns:
            索引源的易读名称
        """
        try:
            # 通过ContextManager获取分支上下文，从中获取index_source_node_id
            if context_manager and node_map:
                branch_context = context_manager.get_branch_context(branch_id)
                index_source_node_id = branch_context.index_source_node_id

                # 从节点映射中获取索引源节点
                if index_source_node_id in node_map:
                    source_node = node_map[index_source_node_id]
                    # 从节点配置中获取display name或使用节点ID
                    display_name = (
                        source_node.data.get("displayName")
                        or source_node.data.get("label")
                        or index_source_node_id
                    )
                    return f"{branch_id.replace('branch_', '').replace('_', '-')}-{display_name}"

            # 如果找不到对应的索引源节点，使用默认名称
            return f"数据源_{branch_id.replace('branch_', '').replace('_', '-')}"

        except Exception as e:
            # 发生任何错误时，返回默认名称
            print(f"Warning: Failed to get source name for branch {branch_id}: {e}")
            return f"数据源_{branch_id.replace('branch_', '').replace('_', '-')}"

    def _write_output_file(self, sheets: List[SheetData], output_file_path: str):
        """
        将结果写入Excel文件

        Args:
            sheets: Sheet数据列表
            output_file_path: 输出文件路径
        """
        try:
            # 确保输出目录存在
            output_dir = os.path.dirname(output_file_path)
            if output_dir and not os.path.exists(output_dir):
                os.makedirs(output_dir, exist_ok=True)

            # 创建Excel写入器
            with pd.ExcelWriter(output_file_path, engine="openpyxl") as writer:
                for sheet_data in sheets:
                    # 转换为pandas DataFrame
                    pandas_df = sheet_data.dataframe.to_pandas()

                    # 确保sheet名称符合Excel规范
                    sheet_name = self._sanitize_sheet_name(sheet_data.sheet_name)

                    # 写入Sheet
                    pandas_df.to_excel(writer, sheet_name=sheet_name, index=False)

            print(f"Output file written to: {output_file_path}")

        except Exception as e:
            raise ValueError(f"Failed to write output file '{output_file_path}': {e}")

    def _sanitize_sheet_name(self, name: str) -> str:
        """
        清理Sheet名称，使其符合Excel规范

        Args:
            name: 原始名称

        Returns:
            清理后的名称
        """
        # Excel sheet名称限制：
        # 1. 长度不超过31个字符
        # 2. 不能包含特殊字符: \ / ? * [ ]
        # 3. 不能以单引号开头或结尾

        # 替换特殊字符
        invalid_chars = ["\\", "/", "?", "*", "[", "]"]
        for char in invalid_chars:
            name = name.replace(char, "_")

        # 去除首尾单引号
        name = name.strip("'")

        # 限制长度
        if len(name) > 31:
            name = name[:31]

        # 确保不为空
        if not name:
            name = "Sheet"

        return name

    def validate_node_config(self, node: BaseNode) -> bool:
        """验证节点配置"""
        if not super().validate_node_config(node):
            return False

        # 输出节点的配置都是可选的，基础验证即可
        return True
