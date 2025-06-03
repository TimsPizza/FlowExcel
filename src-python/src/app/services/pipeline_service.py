"""
Pipeline processing service.
为不同类型节点提供专门的预览和执行方法，按照新的节点连接规则设计。
"""

from typing import List, Dict, Any, Optional, Union
import pandas as pd

# 使用新的API模型
from app.models import PipelineExecutionResponse, APISheetData
from app.utils import (
    convert_workspace_config_from_json,
    create_execute_pipeline_request,
)
from app.services.workspace_service import WorkspaceService

# 使用新的pipeline模块
from pipeline import execute_pipeline, PipelineExecutor
from pipeline.models import (
    WorkspaceConfig,
    PipelineExecutionResult,
    OutputResult,
    SheetData,
    ExecutionMode,
    ExecutePipelineRequest,
    BaseNode,
    NodeType,
    IndexValue,
    GlobalContext,
    PathContext,
    BranchContext,
)
from pipeline.execution.context_manager import ContextManager
from pipeline.processors import (
    IndexSourceProcessor,
    SheetSelectorProcessor,
    RowFilterProcessor,
    RowLookupProcessor,
    AggregatorProcessor,
    OutputProcessor,
)


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
        self.context_manager = ContextManager()
        self.processors = {
            NodeType.INDEX_SOURCE: IndexSourceProcessor(),
            NodeType.SHEET_SELECTOR: SheetSelectorProcessor(),
            NodeType.ROW_FILTER: RowFilterProcessor(),
            NodeType.ROW_LOOKUP: RowLookupProcessor(),
            NodeType.AGGREGATOR: AggregatorProcessor(),
            NodeType.OUTPUT: OutputProcessor(),
        }

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
        self, workspace_id: str, node_id: str, test_mode_max_rows: int = 100
    ) -> Dict[str, Any]:
        """
        预览单个节点的执行结果，根据节点类型调用不同的预览方法

        Args:
            workspace_id: 工作区ID
            node_id: 要预览的节点ID
            test_mode_max_rows: 预览数据的最大行数

        Returns:
            节点预览结果
        """
        try:
            # 加载工作区配置
            workspace_data = WorkspaceService.load_workspace(workspace_id)
            workspace_config = convert_workspace_config_from_json(workspace_data)

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
                    "node_id": node_id,
                }

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
                    "node_id": node_id,
                }

            return result.to_dict()

        except Exception as e:
            return {
                "success": False,
                "error": f"预览节点时发生错误: {str(e)}",
                "node_id": node_id,
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

                    # 限制预览行数
                    limited_df = output.dataframe.limit_rows(max_rows)
                    # limited_df = output.dataframe

                    api_sheet = APISheetData(
                        sheet_name=f"索引: {index_value}",
                        columns=limited_df.columns,
                        data=limited_df.data,
                        metadata={
                            "total_rows": output.dataframe.total_rows,
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
            # 获取上游节点的输出作为输入
            upstream_outputs = self._get_upstream_dataframe_outputs(
                workspace_config, node, max_rows
            )
            if not upstream_outputs:
                return DataFramePreviewResult(
                    success=False,
                    node_id=node.id,
                    node_type=node.type.value,
                    error="无法获取上游节点的DataFrame输出",
                )

            global_context = self.context_manager.create_global_context(
                workspace_config, ExecutionMode.TEST
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

                    # 限制预览行数
                    limited_df = output.dataframe.limit_rows(max_rows)
                    # limited_df = output.dataframe

                    api_sheet = APISheetData(
                        sheet_name=f"过滤结果 (索引: {index_value})",
                        columns=limited_df.columns,
                        data=limited_df.data,
                        metadata={
                            "total_rows": output.dataframe.total_rows,
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
            # 获取上游节点的输出作为输入
            upstream_outputs = self._get_upstream_dataframe_outputs(
                workspace_config, node, max_rows
            )
            if not upstream_outputs:
                return DataFramePreviewResult(
                    success=False,
                    node_id=node.id,
                    node_type=node.type.value,
                    error="无法获取上游节点的DataFrame输出",
                )

            global_context = self.context_manager.create_global_context(
                workspace_config, ExecutionMode.TEST
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

                    # 限制预览行数
                    limited_df = output.dataframe.limit_rows(max_rows)
                    # limited_df = output.dataframe

                    api_sheet = APISheetData(
                        sheet_name=f"查找结果 (索引: {index_value})",
                        columns=limited_df.columns,
                        data=limited_df.data,
                        metadata={
                            "total_rows": output.dataframe.total_rows,
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
            # 获取上游节点的输出作为输入
            upstream_outputs = self._get_upstream_dataframe_outputs(
                workspace_config, node, max_rows
            )
            if not upstream_outputs:
                return AggregationPreviewResult(
                    success=False,
                    node_id=node.id,
                    node_type=node.type.value,
                    error="无法获取上游节点的DataFrame输出",
                )

            global_context = self.context_manager.create_global_context(
                workspace_config, ExecutionMode.TEST
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
                    limited_df = sheet_data.dataframe.limit_rows(max_rows)
                    # limited_df = sheet_data.dataframe

                    api_sheet = APISheetData(
                        sheet_name=sheet_data.sheet_name,
                        columns=limited_df.columns,
                        data=limited_df.data,
                        metadata={
                            "total_rows": sheet_data.dataframe.total_rows,
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
        self, workspace_config: WorkspaceConfig, target_node: BaseNode, max_rows: int
    ) -> List[Dict[str, Any]]:
        """获取上游节点的DataFrame输出"""
        try:
            # 递归找到索引源，然后执行到上游节点
            edges = workspace_config.flow_edges
            upstream_node_id = None

            for edge in edges:
                if edge.target == target_node.id:
                    upstream_node_id = edge.source
                    break
            # 找到最接近的非聚合节点以获取完整输出
            if upstream_node_id:
                # 检查当前上游节点是否为聚合节点
                current_upstream_node = None
                for node in workspace_config.flow_nodes:
                    if node.id == upstream_node_id:
                        current_upstream_node = node
                        break
                
                # 如果是聚合节点，继续向上查找非聚合节点
                if current_upstream_node and current_upstream_node.type == NodeType.AGGREGATOR:
                    visited_nodes = set([target_node.id])
                    while current_upstream_node and current_upstream_node.type == NodeType.AGGREGATOR:
                        visited_nodes.add(current_upstream_node.id)
                        # 查找当前聚合节点的上游节点
                        next_upstream_id = None
                        for edge in edges:
                            if edge.target == current_upstream_node.id and edge.source not in visited_nodes:
                                next_upstream_id = edge.source
                                break
                        
                        if not next_upstream_id:
                            break  # 没有更多上游节点
                        
                        # 查找下一个上游节点
                        current_upstream_node = None
                        for node in workspace_config.flow_nodes:
                            if node.id == next_upstream_id:
                                current_upstream_node = node
                                break
                    
                    # 更新上游节点ID为找到的非聚合节点
                    if current_upstream_node and current_upstream_node.type != NodeType.AGGREGATOR:
                        upstream_node_id = current_upstream_node.id

            if not upstream_node_id:
                return []

            # 找到上游节点
            upstream_node = None
            for node in workspace_config.flow_nodes:
                if node.id == upstream_node_id:
                    upstream_node = node
                    break

            if not upstream_node:
                return []

            # 根据上游节点类型递归获取输出
            if upstream_node.type == NodeType.INDEX_SOURCE:
                # 如果上游是索引源，无法提供DataFrame
                return []
            elif upstream_node.type == NodeType.SHEET_SELECTOR:
                # 递归预览表选择节点
                result = self._preview_sheet_selector_node(
                    workspace_config, upstream_node, max_rows
                )
                if result.success:
                    outputs = []
                    for preview in result.dataframe_previews:
                        from pipeline.models import DataFrame

                        df = DataFrame(
                            columns=preview.columns,
                            data=preview.data,
                            total_rows=preview.metadata.get(
                                "total_rows", len(preview.data)
                            ),
                        )
                        outputs.append(
                            {
                                "index_value": preview.metadata.get("index_value", ""),
                                "dataframe": df,
                            }
                        )
                    return outputs
            elif upstream_node.type in [NodeType.ROW_FILTER, NodeType.ROW_LOOKUP]:
                # 递归预览过滤/查找节点
                if upstream_node.type == NodeType.ROW_FILTER:
                    result = self._preview_row_filter_node(
                        workspace_config, upstream_node, max_rows
                    )
                else:
                    result = self._preview_row_lookup_node(
                        workspace_config, upstream_node, max_rows
                    )

                if result.success:
                    outputs = []
                    for preview in result.dataframe_previews:
                        from pipeline.models import DataFrame

                        df = DataFrame(
                            columns=preview.columns,
                            data=preview.data,
                            total_rows=preview.metadata.get(
                                "total_rows", len(preview.data)
                            ),
                        )
                        outputs.append(
                            {
                                "index_value": preview.metadata.get("index_value", ""),
                                "dataframe": df,
                            }
                        )
                    return outputs

            return []

        except Exception:
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
