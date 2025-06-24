"""
输出节点处理器
用于输出结果，接受来自不同pipeline的多个聚合结果，输出多个sheet
以pipeline的索引值作为sheet名，对应的聚合结果作为sheet内容
"""

import pandas as pd
from typing import Dict, List, Union
import os

from pipeline.processors.base import AbstractNodeProcessor
from pipeline.models import (
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
from pipeline.execution.context_manager import ContextManager


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
            output_file_path = data.get("outputPath")
            include_index_column = data.get("includeIndexColumn", True)
            index_column_name = data.get("indexColumnName", "索引")

            # 创建Sheet数据列表
            sheets = []

            # 收集所有分支ID（来自聚合结果和dataframe结果）
            all_branch_ids = set(input_data.branch_aggregated_results.keys())
            all_branch_ids.update(input_data.branch_dataframes.keys())

            # 遍历所有分支，为每个分支创建Sheet（可能是多个）
            for branch_id in all_branch_ids:
                branch_aggregations = input_data.branch_aggregated_results.get(
                    branch_id, {}
                )
                branch_dataframe = input_data.branch_dataframes.get(branch_id)

                sheet_data_list = self._create_sheet_for_branch(
                    branch_id,
                    branch_aggregations,
                    branch_dataframe,
                    include_index_column,
                    index_column_name,
                    global_context,
                    node_map,
                    context_manager,
                )
                sheets.extend(sheet_data_list)

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
        branch_dataframe: pd.DataFrame | Dict[IndexValue, pd.DataFrame] | None,
        include_index_column: bool,
        index_column_name: str,
        global_context: GlobalContext,
        node_map: Dict[str, BaseNode] = None,
        context_manager=None,
    ):
        """
        为单个分支创建Sheet数据（包含该分支所有索引值的聚合结果）

        Args:
            branch_id: 分支ID
            branch_aggregations: 该分支的聚合结果 {索引值: {列名: 值}}
            branch_dataframe: 该分支的非聚合dataframe（可能是单个DataFrame或按索引值组织的DataFrame字典）
            include_index_column: 是否包含索引列
            index_column_name: 索引列名
            global_context: 全局上下文
            node_map: 节点映射（用于获取索引源节点信息）
            context_manager: 上下文管理器（用于获取分支上下文）

        Returns:
            Sheet数据列表
        """
        # 优先级逻辑：
        # 1. 如果有聚合结果，使用聚合结果
        # 2. 如果没有聚合结果但有非聚合dataframe，使用dataframe
        # 3. 否则创建空Sheet

        source_name = self._get_source_name_for_branch(
            branch_id, global_context, node_map, context_manager
        )
        sheet_name = source_name or f"分支_{branch_id}"

        if branch_aggregations:
            # 情况1：有聚合结果，使用原有逻辑（单个Sheet）
            return [
                self._create_aggregated_sheet(
                    branch_id,
                    branch_aggregations,
                    include_index_column,
                    index_column_name,
                    sheet_name,
                    source_name,
                )
            ]
        elif branch_dataframe is not None:
            # 情况2：没有聚合结果但有dataframe
            if isinstance(branch_dataframe, dict):
                # 按索引值组织的DataFrame字典，为每个索引值创建一个Sheet
                return self._create_multiple_dataframe_sheets(
                    branch_id, branch_dataframe, sheet_name, source_name
                )
            else:
                # 单个DataFrame，直接使用dataframe
                return [
                    self._create_dataframe_sheet(
                        branch_id, branch_dataframe, sheet_name, source_name
                    )
                ]
        else:
            # 情况3：既没有聚合结果也没有dataframe，创建空Sheet
            columns = [index_column_name] if include_index_column else []
            df = pd.DataFrame(columns=columns)
            return [
                SheetData(
                    sheet_name=sheet_name,
                    dataframe=df,
                    branch_id=branch_id,
                    source_name=source_name,
                )
            ]

    def _create_aggregated_sheet(
        self,
        branch_id: str,
        branch_aggregations: Dict[IndexValue, Dict[str, float | int | str | None]],
        include_index_column: bool,
        index_column_name: str,
        sheet_name: str,
        source_name: str,
    ) -> SheetData:
        """
        根据聚合结果创建Sheet
        """
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
        # df = DataFrame(columns=columns, data=data_rows, total_rows=len(data_rows))
        df = pd.DataFrame(columns=columns, data=data_rows)

        return SheetData(
            sheet_name=sheet_name,
            dataframe=df,
            branch_id=branch_id,
            source_name=source_name,
        )

    def _create_multiple_dataframe_sheets(
        self,
        branch_id: str,
        index_dataframes: Dict[IndexValue, pd.DataFrame],
        base_sheet_name: str,
        source_name: str,
    ) -> List[SheetData]:
        """
        根据按索引值组织的DataFrame字典创建多个Sheet

        Args:
            branch_id: 分支ID
            index_dataframes: 按索引值组织的DataFrame字典
            base_sheet_name: 基础sheet名称
            source_name: 源名称

        Returns:
            Sheet数据列表
        """
        sheets = []
        for index_value, dataframe in index_dataframes.items():
            # 为每个索引值创建独立的sheet，名称格式为 "分支名-索引值"
            sheet_name = f"{base_sheet_name}-{index_value}"
            sheet_name = self._sanitize_sheet_name(sheet_name)

            sheet_data = SheetData(
                sheet_name=sheet_name,
                dataframe=dataframe,
                branch_id=branch_id,
                source_name=f"{source_name}-{index_value}",
            )
            sheets.append(sheet_data)

        return sheets

    def _create_dataframe_sheet(
        self,
        branch_id: str,
        branch_dataframe: pd.DataFrame,
        sheet_name: str,
        source_name: str,
    ) -> SheetData:
        """
        根据非聚合dataframe创建Sheet
        """
        return SheetData(
            sheet_name=sheet_name,
            dataframe=branch_dataframe,
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
            return f"s_{branch_id.replace('branch_', '').replace('_', '-')}"

        except Exception as e:
            # 发生任何错误时，返回默认名称
            # print(f"Warning: Failed to get source name for branch {branch_id}: {e}")
            return f"s_{branch_id.replace('branch_', '').replace('_', '-')}"

    def _write_output_file(self, sheets: List[SheetData], output_file_path: str):
        """
        将结果写入Excel文件，并抹掉nan为None

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
                    # 现在使用pandas DataFrame
                    # pandas_df = sheet_data.dataframe.to_pandas()
                    pandas_df = sheet_data.dataframe

                    # 确保sheet名称符合Excel规范
                    sheet_name = self._sanitize_sheet_name(sheet_data.sheet_name)

                    # 写入Sheet
                    pandas_df.to_excel(
                        writer, sheet_name=sheet_name, index=False, na_rep=""
                    )

            # print(f"Output file written to: {output_file_path}")

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
