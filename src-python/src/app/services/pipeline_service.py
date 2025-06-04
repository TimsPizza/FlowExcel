"""
Pipeline processing service.
为不同类型节点提供专门的预览和执行方法，按照新的节点连接规则设计。
"""

from typing import Any, Dict, List, Optional, Union
import time
import json

import pandas as pd

# 使用新的API模型
from app.models import APISheetData, PipelineExecutionResponse
from app.services.workspace_service import WorkspaceService
from app.utils import (
    convert_workspace_config_from_json,
    create_execute_pipeline_request,
)

# 使用新的pipeline模块
from pipeline import PipelineExecutor, execute_pipeline
from pipeline.execution.context_manager import ContextManager
from pipeline.models import (
    BaseNode,
    BranchContext,
    DataFrame,
    ExecutePipelineRequest,
    ExecutionMode,
    GlobalContext,
    IndexSourceOutput,
    IndexValue,
    NodeType,
    OutputResult,
    PathContext,
    PipelineExecutionResult,
    RowFilterOutput,
    RowLookupOutput,
    SheetData,
    SheetSelectorOutput,
    WorkspaceConfig,
)
from pipeline.processors import (
    AggregatorProcessor,
    IndexSourceProcessor,
    OutputProcessor,
    RowFilterProcessor,
    RowLookupProcessor,
    SheetSelectorProcessor,
)
from config import APP_ROOT_DIR
from pipeline.execution.path_analyzer import PathAnalyzer
from pipeline.execution.file_analyzer import FileAnalyzer
from pipeline.execution.batch_preloader import BatchPreloader
from pipeline.performance.analyzer import get_performance_analyzer


class NodePreviewResult:
    """节点预览结果的基类"""

    def __init__(self, success: bool, node_id: str, node_type: str, error: str = None):
        self.success = success
        self.node_id = node_id
        self.node_type = node_type
        self.error = error
        self.execution_time_ms = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "node_id": self.node_id,
            "node_type": self.node_type,
            "error": self.error,
            "execution_time_ms": self.execution_time_ms,
        }


class DataFramePreviewResult(NodePreviewResult):
    """返回DataFrame的节点预览结果"""

    def __init__(
        self,
        success: bool,
        node_id: str,
        node_type: str,
        dataframe_previews: List[APISheetData] = None,
        error: str = None,
    ):
        super().__init__(success, node_id, node_type, error)
        self.dataframe_previews = dataframe_previews or []

    def to_dict(self) -> Dict[str, Any]:
        result = super().to_dict()
        result["dataframe_previews"] = [
            preview.dict() for preview in self.dataframe_previews
        ]
        return result


class IndexSourcePreviewResult(NodePreviewResult):
    """索引源节点预览结果"""

    def __init__(
        self,
        success: bool,
        node_id: str,
        node_type: str,
        index_values: List[str] = None,
        source_column: str = None,
        error: str = None,
    ):
        super().__init__(success, node_id, node_type, error)
        self.index_values = index_values or []
        self.source_column = source_column

    def to_dict(self) -> Dict[str, Any]:
        result = super().to_dict()
        result.update(
            {
                "index_values": self.index_values,
                "source_column": self.source_column,
                "preview_data": {
                    "sheet_name": "索引值列表",
                    "columns": ["索引值"],
                    # "data": [[value] for value in self.index_values[:100]],  # 限制预览数量
                    "data": [[value] for value in self.index_values],
                    "metadata": {
                        "total_count": len(self.index_values),
                        "preview_count": min(len(self.index_values), 100),
                    },
                },
            }
        )
        return result


class AggregationPreviewResult(NodePreviewResult):
    """聚合节点预览结果"""

    def __init__(
        self,
        success: bool,
        node_id: str,
        node_type: str,
        aggregation_results: List[Dict[str, Any]] = None,
        error: str = None,
    ):
        super().__init__(success, node_id, node_type, error)
        self.aggregation_results = aggregation_results or []

    def to_dict(self) -> Dict[str, Any]:
        result = super().to_dict()
        result.update(
            {
                "aggregation_results": self.aggregation_results,
                "preview_data": {
                    "sheet_name": self.aggregation_results.sheet_name or "聚合结果",
                    "columns": self.aggregation_results.columns,
                    "data": self.aggregation_results.data,
                    "metadata": self.aggregation_results.metadata,
                },
            }
        )
        return result


class PipelineService:
    """Service class for pipeline operations."""

    def __init__(self):
        self.workspace_service = WorkspaceService()
        self.context_manager = ContextManager()

        # 初始化节点处理器
        self.processors = {
            NodeType.INDEX_SOURCE: IndexSourceProcessor(),
            NodeType.SHEET_SELECTOR: SheetSelectorProcessor(),
            NodeType.ROW_FILTER: RowFilterProcessor(),
            NodeType.ROW_LOOKUP: RowLookupProcessor(),
            NodeType.AGGREGATOR: AggregatorProcessor(),
            NodeType.OUTPUT: OutputProcessor(),
        }

        # 初始化上下文管理器
        self.context_manager = ContextManager()

        # 初始化文件分析器和批量预加载器
        self.file_analyzer = FileAnalyzer()
        self.batch_preloader = BatchPreloader()

        # 获取全局性能分析器
        self.performance_analyzer = get_performance_analyzer()

        self.default_output_file_folder = APP_ROOT_DIR + "/output"

    def execute_pipeline_from_request(
        self,
        workspace_id: str,
        target_node_id: str,
        execution_mode: str = "production",
        test_mode_max_rows: int = 100,
        output_file_path: str = None,
    ) -> PipelineExecutionResponse:
        """
        Execute a complete data processing pipeline.

        Args:
            workspace_id: 工作区ID
            target_node_id: 目标节点ID (必须是OUTPUT类型)
            execution_mode: 执行模式
            test_mode_max_rows: 测试模式最大行数
            output_file_path: 输出文件路径

        Returns:
            Pipeline执行响应
        """
        try:
            # 加载工作区配置
            workspace_data = WorkspaceService.load_workspace(workspace_id)
            workspace_config = convert_workspace_config_from_json(workspace_data)

            # 验证目标节点是否为输出节点
            target_node = None
            for node in workspace_config.flow_nodes:
                if node.id == target_node_id:
                    target_node = node
                    break

            if not target_node:
                raise ValueError(f"目标节点 {target_node_id} 不存在")

            if target_node.type != NodeType.OUTPUT:
                raise ValueError(
                    f"完整pipeline执行的目标节点必须是OUTPUT类型，当前为 {target_node.type}"
                )

            # 创建执行请求
            if not output_file_path:
                output_file_path = (
                    self.default_output_file_folder
                    + "/"
                    + workspace_id
                    + "_output.xlsx"
                )

            request = create_execute_pipeline_request(
                workspace_config=workspace_config,
                target_node_id=target_node_id,
                execution_mode=execution_mode,
                test_mode_max_rows=test_mode_max_rows,
                output_file_path=output_file_path,
            )

            # 执行pipeline
            result = execute_pipeline(request)

            # 转换结果格式
            response_data = {
                "success": result.success,
                "output_data": (
                    result.output_data.dict() if result.output_data else None
                ),
                "execution_summary": result.execution_summary.dict(),
                "error": result.error,
                "warnings": result.warnings,
                "output_file_path": result.output_file_path,
            }

            return PipelineExecutionResponse(
                result=response_data,
                execution_time=result.execution_summary.total_execution_time_ms
                / 1000.0,
            )

        except Exception as e:
            return PipelineExecutionResponse(
                result={"success": False, "error": str(e)}, execution_time=0.0
            )

    def preview_node(
        self,
        node_id: str,
        test_mode_max_rows: int = 100,
        workspace_id: str = None,
        workspace_config_json: str = None,
    ) -> Dict[str, Any]:
        """预览节点执行结果"""
        # 重置性能统计，开始新的测量
        self.performance_analyzer.reset()

        print("PERF: 开始新的preview操作，统计已重置")

        # Performance monitoring now handled by analyzer
        try:
            preview_start_time = time.time()

            # 获取工作区配置
            if workspace_config_json:
                workspace_config = json.loads(workspace_config_json)
                workspace_config = convert_workspace_config_from_json(workspace_config)
            elif workspace_id:
                workspace_config = self.workspace_service.get_workspace_config(
                    workspace_id
                )
            else:
                return {
                    "success": False,
                    "error": "必须提供workspace_config_json或workspace_id参数",
                }

            # 查找目标节点
            target_node = None
            for node in workspace_config.flow_nodes:
                if node.id == node_id:
                    target_node = node
                    break

            if not target_node:
                return {
                    "success": False,
                    "error": f"节点 {node_id} 不存在",
                }

            print(
                f"PERF: Starting preview for node {node_id} ({target_node.type.value})"
            )

            # 根据节点类型调用不同的预览方法
            if target_node.type == NodeType.INDEX_SOURCE:
                result = self._preview_index_source_node(
                    workspace_config, target_node, test_mode_max_rows
                )
            elif target_node.type == NodeType.SHEET_SELECTOR:
                result = self._preview_sheet_selector_node(
                    workspace_config, target_node, test_mode_max_rows
                )
            elif target_node.type == NodeType.ROW_FILTER:
                result = self._preview_row_filter_node(
                    workspace_config, target_node, test_mode_max_rows
                )
            elif target_node.type == NodeType.ROW_LOOKUP:
                result = self._preview_row_lookup_node(
                    workspace_config, target_node, test_mode_max_rows
                )
            elif target_node.type == NodeType.AGGREGATOR:
                result = self._preview_aggregator_node(
                    workspace_config, target_node, test_mode_max_rows
                )
            elif target_node.type == NodeType.OUTPUT:
                result = self._preview_output_node(
                    workspace_config, target_node, test_mode_max_rows
                )
            else:
                return {
                    "success": False,
                    "error": f"不支持的节点类型: {target_node.type}",
                }

            preview_time = (time.time() - preview_start_time) * 1000
            print(f"PERF: Preview for node {node_id} completed in {preview_time:.2f}ms")

            result_dict = result.to_dict()

            # 打印性能分析报告和DataFrame转换统计
            print("\nPERF: Preview操作完成，性能分析报告:")
            self.performance_analyzer.print_stats()

            return result_dict

        except Exception as e:
            preview_time = (time.time() - preview_start_time) * 1000
            print(
                f"PERF: Preview for node {node_id} failed after {preview_time:.2f}ms - {str(e)}"
            )

            # 即使失败也打印统计
            print("\nPERF: Preview操作失败，当前统计:")
            self.performance_analyzer.print_stats()

            return {
                "success": False,
                "error": str(e),
                "node_id": node_id,
                "node_type": target_node.type.value if target_node else "unknown",
            }

    def _preview_index_source_node(
        self, workspace_config: WorkspaceConfig, node: BaseNode, max_rows: int
    ) -> IndexSourcePreviewResult:
        """预览索引源节点 - 多出节点（无输入）"""
        try:
            # 创建全局上下文
            global_context = self.context_manager.create_global_context(
                workspace_config, ExecutionMode.TEST
            )

            # 创建临时路径上下文
            temp_path_context = self.context_manager.create_path_context(
                IndexValue("preview")
            )

            # 执行索引源节点
            processor = self.processors[NodeType.INDEX_SOURCE]
            from pipeline.models import IndexSourceInput

            input_data = IndexSourceInput()
            output = processor.process(
                node, input_data, global_context, temp_path_context
            )

            return IndexSourcePreviewResult(
                success=True,
                node_id=node.id,
                node_type=node.type.value,
                index_values=[str(idx) for idx in output.index_values],
                source_column=output.source_column,
            )

        except Exception as e:
            return IndexSourcePreviewResult(
                success=False, node_id=node.id, node_type=node.type.value, error=str(e)
            )

    def _preview_sheet_selector_node(
        self, workspace_config: WorkspaceConfig, node: BaseNode, max_rows: int
    ) -> DataFramePreviewResult:
        """预览表选择节点 - 单入多出节点"""
        try:
            # 首先获取上游索引源的索引值
            upstream_index_values = self._get_upstream_index_values(
                workspace_config, node
            )
            if not upstream_index_values:
                return DataFramePreviewResult(
                    success=False,
                    node_id=node.id,
                    node_type=node.type.value,
                    error="无法获取上游索引源的索引值",
                )

            # 创建全局上下文
            global_context = self.context_manager.create_global_context(
                workspace_config, ExecutionMode.TEST
            )

            previews = []
            processor = self.processors[NodeType.SHEET_SELECTOR]

            # 为每个索引值生成预览（限制数量）
            for i, index_value in enumerate(upstream_index_values):
                try:
                    path_context = self.context_manager.create_path_context(index_value)

                    from pipeline.models import SheetSelectorInput

                    input_data = SheetSelectorInput(index_value=index_value)

                    output = processor.process(
                        node, input_data, global_context, path_context
                    )

                    # 在API边界转换为自定义DataFrame，只为DTO序列化
                    if hasattr(output.dataframe, "limit_rows"):
                        # 如果还是自定义DataFrame，直接使用
                        custom_df = output.dataframe
                    else:
                        # 如果是pandas DataFrame，转换为自定义DataFrame（仅在API边界）
                        custom_df = DataFrame.from_pandas(output.dataframe)

                    # limited_df = custom_df.limit_rows(max_rows)
                    limited_df = custom_df

                    api_sheet = APISheetData(
                        sheet_name=f"索引: {index_value}",
                        columns=limited_df.columns,
                        data=limited_df.data,
                        metadata={
                            "total_rows": custom_df.total_rows,
                            "preview_rows": limited_df.total_rows,
                            "index_value": str(index_value),
                            "sheet_name": output.sheet_name,
                        },
                    )
                    previews.append(api_sheet)

                except Exception as e:
                    # 单个索引值失败不影响其他索引值的预览
                    continue

            return DataFramePreviewResult(
                success=True,
                node_id=node.id,
                node_type=node.type.value,
                dataframe_previews=previews,
            )

        except Exception as e:
            return DataFramePreviewResult(
                success=False, node_id=node.id, node_type=node.type.value, error=str(e)
            )

    def _preview_row_filter_node(
        self, workspace_config: WorkspaceConfig, node: BaseNode, max_rows: int
    ) -> DataFramePreviewResult:
        """预览行过滤节点 - 单入多出节点"""
        try:
            # 创建全局上下文（先创建，以便共享缓存）
            global_context = self.context_manager.create_global_context(
                workspace_config, ExecutionMode.TEST
            )

            # 获取上游节点的输出作为输入（共享全局上下文）
            upstream_outputs = self._get_upstream_dataframe_outputs(
                workspace_config, node, max_rows, global_context
            )
            if not upstream_outputs:
                return DataFramePreviewResult(
                    success=False,
                    node_id=node.id,
                    node_type=node.type.value,
                    error="无法获取上游节点的DataFrame输出",
                )

            previews = []
            processor = self.processors[NodeType.ROW_FILTER]

            for upstream_output in upstream_outputs:
                try:
                    index_value = upstream_output["index_value"]
                    dataframe = upstream_output["dataframe"]

                    path_context = self.context_manager.create_path_context(
                        IndexValue(index_value)
                    )
                    path_context.current_dataframe = dataframe

                    from pipeline.models import RowFilterInput

                    input_data = RowFilterInput(
                        dataframe=dataframe, index_value=IndexValue(index_value)
                    )

                    output = processor.process(
                        node, input_data, global_context, path_context
                    )

                    # 在API边界转换为自定义DataFrame，只为DTO序列化
                    if hasattr(output.dataframe, "limit_rows"):
                        # 如果还是自定义DataFrame，直接使用
                        custom_df = output.dataframe
                    else:
                        # 如果是pandas DataFrame，转换为自定义DataFrame（仅在API边界）
                        custom_df = DataFrame.from_pandas(output.dataframe)

                    limited_df = custom_df.limit_rows(max_rows)

                    api_sheet = APISheetData(
                        sheet_name=f"过滤结果 (索引: {index_value})",
                        columns=limited_df.columns,
                        data=limited_df.data,
                        metadata={
                            "total_rows": custom_df.total_rows,
                            "preview_rows": limited_df.total_rows,
                            "filtered_count": output.filtered_count,
                            "index_value": str(index_value),
                        },
                    )
                    previews.append(api_sheet)

                except Exception as e:
                    continue

            return DataFramePreviewResult(
                success=True,
                node_id=node.id,
                node_type=node.type.value,
                dataframe_previews=previews,
            )

        except Exception as e:
            return DataFramePreviewResult(
                success=False, node_id=node.id, node_type=node.type.value, error=str(e)
            )

    def _preview_row_lookup_node(
        self, workspace_config: WorkspaceConfig, node: BaseNode, max_rows: int
    ) -> DataFramePreviewResult:
        """预览行查找节点 - 单入多出节点"""
        try:
            # 创建全局上下文（先创建，以便共享缓存）
            global_context = self.context_manager.create_global_context(
                workspace_config, ExecutionMode.TEST
            )

            # 获取上游节点的输出作为输入（共享全局上下文）
            upstream_outputs = self._get_upstream_dataframe_outputs(
                workspace_config, node, max_rows, global_context
            )
            if not upstream_outputs:
                return DataFramePreviewResult(
                    success=False,
                    node_id=node.id,
                    node_type=node.type.value,
                    error="无法获取上游节点的DataFrame输出",
                )

            previews = []
            processor = self.processors[NodeType.ROW_LOOKUP]

            for upstream_output in upstream_outputs:
                try:
                    index_value = upstream_output["index_value"]
                    dataframe = upstream_output["dataframe"]

                    path_context = self.context_manager.create_path_context(
                        IndexValue(index_value)
                    )
                    path_context.current_dataframe = dataframe

                    from pipeline.models import RowLookupInput

                    input_data = RowLookupInput(
                        dataframe=dataframe, index_value=IndexValue(index_value)
                    )

                    output = processor.process(
                        node, input_data, global_context, path_context
                    )

                    # 在API边界转换为自定义DataFrame，只为DTO序列化
                    if hasattr(output.dataframe, "limit_rows"):
                        # 如果还是自定义DataFrame，直接使用
                        custom_df = output.dataframe
                    else:
                        # 如果是pandas DataFrame，转换为自定义DataFrame（仅在API边界）
                        custom_df = DataFrame.from_pandas(output.dataframe)

                    limited_df = custom_df.limit_rows(max_rows)

                    api_sheet = APISheetData(
                        sheet_name=f"查找结果 (索引: {index_value})",
                        columns=limited_df.columns,
                        data=limited_df.data,
                        metadata={
                            "total_rows": custom_df.total_rows,
                            "preview_rows": limited_df.total_rows,
                            "matched_count": output.matched_count,
                            "index_value": str(index_value),
                        },
                    )
                    previews.append(api_sheet)

                except Exception as e:
                    continue

            return DataFramePreviewResult(
                success=True,
                node_id=node.id,
                node_type=node.type.value,
                dataframe_previews=previews,
            )

        except Exception as e:
            return DataFramePreviewResult(
                success=False, node_id=node.id, node_type=node.type.value, error=str(e)
            )

    def _preview_aggregator_node(
        self, workspace_config: WorkspaceConfig, node: BaseNode, max_rows: int
    ) -> AggregationPreviewResult:
        """预览聚合节点 - 单入单出节点"""
        try:
            # 创建全局上下文（先创建，以便共享缓存）
            global_context = self.context_manager.create_global_context(
                workspace_config, ExecutionMode.TEST
            )

            # 获取上游节点的输出作为输入（共享全局上下文）
            upstream_outputs = self._get_upstream_dataframe_outputs(
                workspace_config, node, max_rows, global_context
            )
            if not upstream_outputs:
                return AggregationPreviewResult(
                    success=False,
                    node_id=node.id,
                    node_type=node.type.value,
                    error="无法获取上游节点的DataFrame输出",
                )

            aggregation_results = []
            processor = self.processors[NodeType.AGGREGATOR]

            # 创建分支上下文（聚合节点需要分支上下文）
            branch_context = self.context_manager.create_branch_context(
                "preview_branch", "preview_index_source"
            )

            for upstream_output in upstream_outputs:
                try:
                    index_value = upstream_output["index_value"]
                    dataframe = upstream_output["dataframe"]

                    path_context = self.context_manager.create_path_context(
                        IndexValue(index_value)
                    )
                    path_context.last_non_aggregator_dataframe = dataframe
                    path_context.current_dataframe = dataframe

                    from pipeline.models import AggregatorInput

                    input_data = AggregatorInput(
                        dataframe=dataframe, index_value=IndexValue(index_value)
                    )

                    output = processor.process(
                        node, input_data, global_context, path_context, branch_context
                    )

                    aggregation_results.append(
                        {
                            "index_value": str(output.result.index_value),
                            "column_name": output.result.column_name,
                            "operation": output.result.operation.value,
                            "result_value": output.result.result_value,
                        }
                    )

                except Exception as e:
                    continue
            final_result = branch_context.get_final_results()
            final_output_col_name = (
                node.data.get("method") + "_" + node.data.get("statColumn")
            )
            final_columns = ["索引"] + [final_output_col_name]
            final_data = []
            for index_value, result in final_result.items():
                final_data.append([index_value] + [result[final_output_col_name]])
            final_df = APISheetData(
                sheet_name="统计测试：" + final_output_col_name,
                columns=final_columns,
                data=final_data,
                metadata={
                    "total_rows": len(final_data),
                    "preview_rows": len(final_data),
                },
            )

            return AggregationPreviewResult(
                success=True,
                node_id=node.id,
                node_type=node.type.value,
                aggregation_results=final_df,
            )

        except Exception as e:
            return AggregationPreviewResult(
                success=False, node_id=node.id, node_type=node.type.value, error=str(e)
            )

    def _preview_output_node(
        self, workspace_config: WorkspaceConfig, node: BaseNode, max_rows: int
    ) -> DataFramePreviewResult:
        """预览输出节点 - 多入节点"""
        try:
            # 输出节点需要完整的pipeline执行，使用现有的execute_pipeline逻辑
            request = create_execute_pipeline_request(
                workspace_config=workspace_config,
                target_node_id=node.id,
                execution_mode="test",
                test_mode_max_rows=max_rows,
            )

            result = execute_pipeline(request)

            if not result.success:
                return DataFramePreviewResult(
                    success=False,
                    node_id=node.id,
                    node_type=node.type.value,
                    error=result.error,
                )

            # 转换输出结果为预览格式
            previews = []
            if result.output_data and result.output_data.sheets:
                for sheet_data in result.output_data.sheets:
                    # 在API边界转换为自定义DataFrame，只为DTO序列化
                    if hasattr(sheet_data.dataframe, "limit_rows"):
                        # 如果还是自定义DataFrame，直接使用
                        custom_df = sheet_data.dataframe
                    else:
                        # 如果是pandas DataFrame，转换为自定义DataFrame（仅在API边界）
                        custom_df = DataFrame.from_pandas(sheet_data.dataframe)

                    # limited_df = custom_df.limit_rows(max_rows)
                    limited_df = custom_df

                    api_sheet = APISheetData(
                        sheet_name=sheet_data.sheet_name,
                        columns=limited_df.columns,
                        data=limited_df.data,
                        metadata={
                            "total_rows": custom_df.total_rows,
                            "preview_rows": limited_df.total_rows,
                            "branch_id": sheet_data.branch_id,
                            "source_name": sheet_data.source_name,
                        },
                    )
                    previews.append(api_sheet)

            return DataFramePreviewResult(
                success=True,
                node_id=node.id,
                node_type=node.type.value,
                dataframe_previews=previews,
            )

        except Exception as e:
            return DataFramePreviewResult(
                success=False, node_id=node.id, node_type=node.type.value, error=str(e)
            )

    def _get_upstream_index_values(
        self, workspace_config: WorkspaceConfig, target_node: BaseNode
    ) -> List[IndexValue]:
        """获取上游索引源节点的索引值"""
        try:
            # 找到上游索引源节点
            edges = workspace_config.flow_edges
            upstream_nodes = []

            for edge in edges:
                if edge.target == target_node.id:
                    upstream_nodes.append(edge.source)

            # 查找索引源节点
            for node in workspace_config.flow_nodes:
                if node.id in upstream_nodes and node.type == NodeType.INDEX_SOURCE:
                    # 执行索引源节点获取索引值
                    global_context = self.context_manager.create_global_context(
                        workspace_config, ExecutionMode.TEST
                    )
                    temp_path_context = self.context_manager.create_path_context(
                        IndexValue("temp")
                    )

                    processor = self.processors[NodeType.INDEX_SOURCE]
                    from pipeline.models import IndexSourceInput

                    input_data = IndexSourceInput()
                    output = processor.process(
                        node, input_data, global_context, temp_path_context
                    )

                    return output.index_values

            return []

        except Exception:
            return []

    def _get_upstream_dataframe_outputs(
        self,
        workspace_config: WorkspaceConfig,
        target_node: BaseNode,
        max_rows: int,
        shared_global_context: GlobalContext = None,
    ) -> List[Dict[str, Any]]:
        """获取上游节点的DataFrame输出"""
        upstream_start_time = time.time()

        # Performance monitoring handled by individual node executions
        try:
            # 使用PathAnalyzer分析完整执行路径
            path_analysis_start = time.time()
            analyzer = PathAnalyzer()
            execution_branches, _ = analyzer.analyze(
                workspace_config.flow_nodes,
                workspace_config.flow_edges,
                target_node.id,
            )
            path_analysis_time = (time.time() - path_analysis_start) * 1000
            print(f"PERF: Path analysis for upstream took {path_analysis_time:.2f}ms")

            if len(execution_branches) == 0:
                return []

            branch = list(execution_branches.values())[0]  # 只取第一个分支
            execution_nodes = branch.execution_nodes

            # 找到目标节点在执行路径中的位置
            target_index = -1
            for i, node_id in enumerate(execution_nodes):
                if node_id == target_node.id:
                    target_index = i
                    break

            if target_index <= 0:
                return []  # 目标节点是第一个节点或未找到，没有上游

            # 获取上游节点（目标节点的前一个节点）
            upstream_node_id = execution_nodes[target_index - 1]
            upstream_node = self._get_node_by_id(workspace_config, upstream_node_id)

            if not upstream_node or upstream_node.type == NodeType.INDEX_SOURCE:
                return []  # 上游是索引源节点，无DataFrame输出

            # 使用共享的全局上下文或创建新的
            if shared_global_context is not None:
                global_context = shared_global_context
                print("PERF: Using shared global context with existing cache")
            else:
                global_context = self.context_manager.create_global_context(
                    workspace_config, ExecutionMode.TEST
                )
                # 批量预加载优化：提前加载所有需要的文件
                try:
                    self._batch_preload_for_upstream(
                        execution_nodes, workspace_config, global_context
                    )
                except Exception as e:
                    print(f"PERF WARNING: Upstream batch preload failed - {str(e)}")
                    # 预加载失败不影响主流程

            # 首先获取索引值（从索引源节点开始）
            index_fetch_start = time.time()
            index_source_node_id = execution_nodes[0]
            index_source_node = self._get_node_by_id(
                workspace_config, index_source_node_id
            )

            if not index_source_node or index_source_node.type != NodeType.INDEX_SOURCE:
                return []

            # 执行索引源节点获取索引值
            temp_path_context = self.context_manager.create_path_context(
                IndexValue("temp")
            )
            index_processor: IndexSourceProcessor = self.processors[
                NodeType.INDEX_SOURCE
            ]
            from pipeline.models import IndexSourceInput

            index_input = IndexSourceInput()
            index_output = index_processor.process(
                index_source_node, index_input, global_context, temp_path_context
            )

            index_fetch_time = (time.time() - index_fetch_start) * 1000
            index_count = len(index_output.index_values)
            print(
                f"PERF: Index fetch took {index_fetch_time:.2f}ms, got {index_count} index values"
            )

            # 性能警告：如果索引值过多
            if index_count > 50:
                print(
                    f"PERF WARNING: Processing {index_count} index values - this may cause performance issues!"
                )

            # 为每个索引值执行到上游节点
            execution_start = time.time()
            outputs = []
            processor_call_count = 0

            for i, index_value in enumerate(index_output.index_values):
                try:
                    path_context = self.context_manager.create_path_context(index_value)
                    current_dataframe = None

                    # 按顺序执行每个节点直到上游节点
                    for j in range(1, target_index):  # 跳过索引源，执行到上游节点
                        node_id = execution_nodes[j]
                        node = self._get_node_by_id(workspace_config, node_id)
                        processor = self.processors[node.type]
                        processor_call_count += 1

                        if node.type == NodeType.SHEET_SELECTOR:
                            from pipeline.models import SheetSelectorInput

                            input_data = SheetSelectorInput(index_value=index_value)
                            output: SheetSelectorOutput = processor.process(
                                node, input_data, global_context, path_context
                            )
                            current_dataframe = output.dataframe
                            path_context.current_dataframe = current_dataframe

                        elif node.type == NodeType.ROW_FILTER:
                            from pipeline.models import RowFilterInput

                            input_data = RowFilterInput(
                                dataframe=current_dataframe, index_value=index_value
                            )
                            output: RowFilterOutput = processor.process(
                                node, input_data, global_context, path_context
                            )
                            current_dataframe = output.dataframe
                            path_context.current_dataframe = current_dataframe

                        elif node.type == NodeType.ROW_LOOKUP:
                            from pipeline.models import RowLookupInput

                            input_data = RowLookupInput(
                                dataframe=current_dataframe, index_value=index_value
                            )
                            output: RowLookupOutput = processor.process(
                                node, input_data, global_context, path_context
                            )
                            current_dataframe = output.dataframe
                            path_context.current_dataframe = current_dataframe

                        elif node.type == NodeType.AGGREGATOR:
                            # 聚合节点不产生DataFrame输出，但需要更新last_non_aggregator_dataframe
                            path_context.last_non_aggregator_dataframe = (
                                current_dataframe
                            )

                    # 限制预览行数并转换为自定义DataFrame（仅在API边界）
                    if current_dataframe is not None:
                        # 检查DataFrame是否为空（安全的方式检查pandas DataFrame）
                        try:
                            if (
                                hasattr(current_dataframe, "empty")
                                and current_dataframe.empty
                            ):
                                continue  # 跳过空DataFrame
                            elif (
                                hasattr(current_dataframe, "__len__")
                                and len(current_dataframe) == 0
                            ):
                                continue  # 跳过空DataFrame
                        except ValueError:
                            # 如果检查为空时出现ValueError，说明是pandas的布尔判断问题
                            # 这种情况下我们假设DataFrame不为空，继续处理
                            print(
                                f"SHOULD NOT HAPPEN: DataFrame is empty: {current_dataframe}"
                            )
                            pass

                        if hasattr(current_dataframe, "limit_rows"):
                            # 如果还是自定义DataFrame，直接使用
                            # limited_df = current_dataframe.limit_rows(max_rows)
                            limited_df = current_dataframe
                        else:
                            # 如果是pandas DataFrame，转换后限制行数
                            custom_df = DataFrame.from_pandas(current_dataframe)
                            # limited_df = custom_df.limit_rows(max_rows)
                            limited_df = custom_df

                        outputs.append(
                            {
                                "index_value": str(index_value),
                                "dataframe": limited_df,
                            }
                        )

                except Exception as e:
                    # 单个索引值失败不影响其他索引值
                    continue

            execution_time = (time.time() - execution_start) * 1000
            total_time = (time.time() - upstream_start_time) * 1000

            print(f"PERF: Upstream execution completed in {execution_time:.2f}ms")
            print(f"PERF: Total upstream processing time: {total_time:.2f}ms")
            print(f"PERF: Made {processor_call_count} processor calls")
            print(f"PERF: Generated {len(outputs)} output dataframes")

            # 性能警告检查
            if processor_call_count > 100:
                print(
                    f"PERF WARNING: Made {processor_call_count} processor calls - consider optimization!"
                )
            if total_time > 5000:  # 5秒
                print(
                    f"PERF WARNING: Upstream processing took {total_time:.2f}ms - very slow!"
                )

            return outputs

        except Exception as e:
            total_time = (time.time() - upstream_start_time) * 1000
            print(
                f"PERF: Upstream processing failed after {total_time:.2f}ms - {str(e)}"
            )
            return []

    # 保留原有的方法以保持兼容性
    @staticmethod
    def _convert_output_result_to_api_sheets(
        output_result: OutputResult,
    ) -> List[APISheetData]:
        """
        将新系统的OutputResult转换为API层面的Sheet数据

        Args:
            output_result: Pipeline输出结果

        Returns:
            API Sheet数据列表
        """
        api_sheets = []

        for sheet_data in output_result.sheets:
            api_sheet = APISheetData(
                sheet_name=sheet_data.sheet_name,
                columns=sheet_data.dataframe.columns,
                data=sheet_data.dataframe.data,
                metadata={
                    "total_rows": sheet_data.dataframe.total_rows,
                    "branch_id": sheet_data.branch_id,
                    "source_name": sheet_data.source_name,
                },
            )
            api_sheets.append(api_sheet)

        return api_sheets

    @staticmethod
    def _clean_sheet_data(sheets: List[APISheetData]) -> List[APISheetData]:
        """清理数据中的NaN、Inf等无效值"""
        cleaned_sheets = []

        for sheet in sheets:
            cleaned_data = []
            for row in sheet.data:
                cleaned_row = []
                for cell in row:
                    if isinstance(cell, float):
                        if pd.isna(cell) or pd.isinf(cell):
                            cleaned_row.append(None)
                        else:
                            cleaned_row.append(cell)
                    else:
                        cleaned_row.append(cell)
                cleaned_data.append(cleaned_row)

            cleaned_sheets.append(
                APISheetData(
                    sheet_name=sheet.sheet_name,
                    columns=sheet.columns,
                    data=cleaned_data,
                    metadata=sheet.metadata,
                )
            )

        return cleaned_sheets

    @staticmethod
    def _get_node_by_id(workspace_config: WorkspaceConfig, node_id: str) -> BaseNode:
        """根据节点ID获取节点"""
        for node in workspace_config.flow_nodes:
            if node.id == node_id:
                return node
        return None

    def get_performance_report(self) -> Dict[str, Any]:
        """获取性能报告"""
        return self.performance_analyzer.get_stats()

    def _batch_preload_for_upstream(
        self,
        execution_nodes: List[str],
        workspace_config: WorkspaceConfig,
        global_context,
    ):
        """
        为上游分析执行批量预加载

        Args:
            execution_nodes: 执行节点列表
            workspace_config: 工作区配置
            global_context: 全局上下文
        """
        # 分析文件需求
        batch_infos = self.file_analyzer.analyze_file_requirements(
            workspace_config, execution_nodes
        )

        if not batch_infos:
            print("PERF: No files to preload for upstream analysis")
            return

        # 执行批量预加载
        preload_summary = self.batch_preloader.preload_files(
            batch_infos, global_context
        )

        print(
            f"PERF: Upstream batch preload completed - {preload_summary.successful_sheets}/{preload_summary.total_sheets} sheets loaded"
        )

    def print_performance_report(self):
        """打印性能报告"""
        self.performance_analyzer.print_stats()

    def clear_performance_statistics(self):
        """清除性能统计"""
        self.performance_analyzer.reset()

    def enable_performance_monitoring(self):
        """启用性能监控"""
        self.performance_analyzer.enable()

    def disable_performance_monitoring(self):
        """禁用性能监控"""
        self.performance_analyzer.disable()
