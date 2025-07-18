"""
主Pipeline执行器
协调整个pipeline执行流程，使用分支独立执行避免笛卡尔积性能问题
这是整个pipeline系统的核心组件
"""

import time
from typing import Dict, List
import pandas as pd

from pipeline.models import (
    BaseNode,
    BranchContext,
    BranchExecutionResult,
    DataFrame,
    ExecutePipelineRequest,
    ExecutionMode,
    IndexExecutionResult,
    IndexSourceInput,
    IndexSourceOutput,
    IndexValue,
    NodeExecutionResult,
    NodeType,
    OutputInput,
    OutputResult,
    PathContext,
    PipelineExecutionResult,
    PipelineExecutionSummary,
    SheetSelectorOutput,
)
from pipeline.processors import (
    AggregatorProcessor,
    IndexSourceProcessor,
    OutputProcessor,
    RowFilterProcessor,
    RowLookupProcessor,
    SheetSelectorProcessor,
)

from .batch_preloader import BatchPreloader
from .context_manager import ContextManager
from .file_analyzer import FileAnalyzer
from .path_analyzer import ExecutionBranch, MultiInputNodeInfo, PathAnalyzer


class PipelineExecutor:
    """主Pipeline执行器 - 分支独立执行"""

    def __init__(self):
        self.path_analyzer = PathAnalyzer()
        self.context_manager = ContextManager()
        self.file_analyzer = FileAnalyzer()
        self.batch_preloader = BatchPreloader()

        # 用于特殊节点的处理器
        self.index_source_processor = IndexSourceProcessor()
        self.output_processor = OutputProcessor()

        self.processors = {
            NodeType.INDEX_SOURCE: self.index_source_processor,
            NodeType.SHEET_SELECTOR: SheetSelectorProcessor(),
            NodeType.ROW_FILTER: RowFilterProcessor(),
            NodeType.ROW_LOOKUP: RowLookupProcessor(),
            NodeType.AGGREGATOR: AggregatorProcessor(),
            NodeType.OUTPUT: self.output_processor,
        }

    def execute_pipeline(
        self, request: ExecutePipelineRequest
    ) -> PipelineExecutionResult:
        """
        执行Pipeline的主入口方法 - 分支独立执行

        Args:
            request: Pipeline执行请求

        Returns:
            Pipeline执行结果
        """
        start_time = time.time()

        try:
            # 1. 创建全局上下文
            global_context = self.context_manager.create_global_context(
                request.workspace_config, request.execution_mode
            )

            # 2. 创建节点映射
            node_map = {node.id: node for node in request.workspace_config.flow_nodes}

            # 3. 分析执行分支（新方法：反向分析）
            execution_branches, multi_input_nodes = self.path_analyzer.analyze(
                request.workspace_config.flow_nodes,
                request.workspace_config.flow_edges,
                request.target_node_id,
            )

            # 4. 批量预加载优化：分析并预加载所有需要的Excel文件
            self._batch_preload_files(
                execution_branches, request.workspace_config, global_context
            )

            if not execution_branches:
                return PipelineExecutionResult(
                    success=False,
                    error="No valid execution branches found",
                    execution_summary=self._create_empty_summary(
                        request.execution_mode
                    ),
                    index_results=[],
                    branch_results=[],
                    output_data=None,
                )

            # 5. 为每个分支独立执行（避免笛卡尔积）
            all_branch_results = []
            all_index_results = []

            for branch_id, branch in execution_branches.items():
                # 4.1 获取该分支的索引值（仅限该分支）
                index_values = self._get_branch_index_values(
                    branch, node_map, global_context
                )

                if not index_values:
                    continue  # 跳过没有索引值的分支

                # 4.2 为每个索引值执行该分支（不是所有分支）
                branch_index_results = []
                for index_value in index_values:
                    index_result = self._execute_single_branch_for_index(
                        branch, index_value, node_map, global_context
                    )
                    branch_index_results.append(index_result)
                    all_index_results.append(index_result)

                # 4.3 创建分支执行结果
                branch_result = self._create_branch_execution_result(
                    branch_id, branch_index_results
                )
                all_branch_results.append(branch_result)

            # 5. 执行输出节点
            output_data = self._execute_output_node(
                request.target_node_id,
                node_map,
                execution_branches,
                all_branch_results,
                global_context,
            )

            # 6. 计算执行摘要
            total_time = (time.time() - start_time) * 1000
            execution_summary = self._create_execution_summary(
                all_index_results,
                all_branch_results,
                total_time,
                request.execution_mode,
            )

            # 7. 清理资源
            self.context_manager.cleanup_branch_contexts()

            return PipelineExecutionResult(
                success=True,
                output_data=output_data,
                execution_summary=execution_summary,
                index_results=all_index_results,
                branch_results=all_branch_results,
                error=None,
                warnings=[],
            )

        except Exception as e:
            total_time = (time.time() - start_time) * 1000

            return PipelineExecutionResult(
                success=False,
                error=str(e),
                execution_summary=self._create_empty_summary(
                    request.execution_mode, total_time
                ),
                index_results=[],
                branch_results=[],
                output_data=None,
            )

    def _get_branch_index_values(
        self, branch: ExecutionBranch, node_map: Dict[str, BaseNode], global_context
    ) -> List[IndexValue]:
        """
        获取特定分支的索引值（不是所有分支的索引值）

        Args:
            branch: 执行分支
            node_map: 节点映射
            global_context: 全局上下文

        Returns:
            该分支的索引值列表
        """
        # 执行该分支的索引源节点
        index_source_id = branch.index_source_id

        if index_source_id not in node_map:
            raise ValueError(f"Index source node {index_source_id} not found")

        node = node_map[index_source_id]
        if node.type != NodeType.INDEX_SOURCE:
            raise ValueError(f"Node {index_source_id} is not an index source node")

        # 创建空输入和临时上下文
        input_data = IndexSourceInput()
        temp_path_context = self.context_manager.create_path_context(IndexValue("temp"))

        # 执行索引源节点
        result = self.index_source_processor.process(
            node, input_data, global_context, temp_path_context
        )

        return result.index_values

    def _execute_single_branch_for_index(
        self,
        branch: ExecutionBranch,
        index_value: IndexValue,
        node_map: Dict[str, BaseNode],
        global_context,
    ) -> IndexExecutionResult:
        """
        为特定索引值执行单个分支（不是所有分支）

        Args:
            branch: 执行分支
            index_value: 当前索引值
            node_map: 节点映射
            global_context: 全局上下文

        Returns:
            索引执行结果
        """
        start_time = time.time()
        all_node_results = []

        try:
            # 创建路径上下文
            path_context = self.context_manager.create_path_context(index_value)

            # 创建或获取分支上下文
            branch_context = self.context_manager.get_or_create_branch_context(
                branch.branch_id, branch.index_source_id
            )

            # 执行该分支的所有节点（按顺序）
            for node_id in branch.execution_nodes:
                if node_id not in node_map:
                    continue

                node = node_map[node_id]

                # 跳过输出节点和索引源节点（输出节点在最后统一处理，索引源已经在外部处理）
                if node.type == NodeType.OUTPUT or node.type == NodeType.INDEX_SOURCE:
                    continue

                # 执行节点
                try:
                    start_time = time.time()

                    # 根据节点类型准备输入
                    node_input = self._prepare_node_input(
                        node, index_value, path_context
                    )

                    # 执行节点处理器
                    processor = self.processors[node.type]
                    output = processor.process(
                        node, node_input, global_context, path_context, branch_context
                    )

                    execution_time = (time.time() - start_time) * 1000

                    # 创建执行结果 - 使用强类型判断输出序列化
                    serialized_output = self._serialize_node_output(output, node.type)

                    result = NodeExecutionResult(
                        node_id=node_id,
                        node_type=node.type,
                        success=True,
                        output=serialized_output,
                        error=None,
                        execution_time_ms=execution_time,
                    )
                    all_node_results.append(result)

                    # 更新路径上下文
                    self._update_path_context_from_output(
                        path_context, node.type, output
                    )

                    # 如果是非聚合节点，更新分支上下文的最后非聚合dataframe
                    if node.type not in [
                        NodeType.AGGREGATOR,
                        NodeType.OUTPUT,
                        NodeType.INDEX_SOURCE,
                    ] and hasattr(output, "dataframe"):
                        branch_context.last_non_aggregated_dataframe = output.dataframe
                        # 同时按索引值保存DataFrame
                        branch_context.add_index_dataframe(index_value, output.dataframe)

                except Exception as e:
                    error_result = NodeExecutionResult(
                        node_id=node_id,
                        node_type=node.type,
                        success=False,
                        output=None,
                        error=str(e),
                        execution_time_ms=0.0,
                    )
                    all_node_results.append(error_result)

            total_time = (time.time() - start_time) * 1000

            return IndexExecutionResult(
                index_value=index_value,
                success=True,
                node_results=all_node_results,
                error=None,
                total_execution_time_ms=total_time,
            )

        except Exception as e:
            total_time = (time.time() - start_time) * 1000

            return IndexExecutionResult(
                index_value=index_value,
                success=False,
                node_results=all_node_results,
                error=str(e),
                total_execution_time_ms=total_time,
            )

    def _create_branch_execution_result(
        self, branch_id: str, index_results: List[IndexExecutionResult]
    ) -> BranchExecutionResult:
        """
        创建分支执行结果

        Args:
            branch_id: 分支ID
            index_results: 该分支的索引执行结果列表

        Returns:
            分支执行结果
        """
        # 检查所有索引是否都执行成功
        success = all(result.success for result in index_results)

        # 收集处理的索引值
        processed_indices = [result.index_value for result in index_results]

        # 获取分支上下文的最终聚合结果
        branch_context = self.context_manager.get_branch_context(branch_id)
        final_aggregations = (
            branch_context.get_final_results() if branch_context else {}
        )

        # 收集错误信息
        errors = [result.error for result in index_results if result.error]
        error_message = "; ".join(errors) if errors else None

        return BranchExecutionResult(
            branch_id=branch_id,
            success=success,
            final_aggregations=final_aggregations,
            processed_indices=processed_indices,
            error=error_message,
        )

    def _execute_output_node(
        self,
        target_node_id: str,
        node_map: Dict[str, BaseNode],
        execution_branches: Dict[str, ExecutionBranch],
        branch_results: List[BranchExecutionResult],
        global_context,
    ) -> OutputResult:
        """
        执行输出节点

        Args:
            target_node_id: 目标节点ID
            node_map: 节点映射
            execution_branches: 执行分支字典
            branch_results: 分支执行结果列表
            global_context: 全局上下文

        Returns:
            输出结果
        """
        if target_node_id not in node_map:
            raise ValueError(f"Target node {target_node_id} not found")

        target_node = node_map[target_node_id]

        if target_node.type != NodeType.OUTPUT:
            raise ValueError(f"Target node {target_node_id} is not an output node")

        # 收集各分支的聚合结果和非聚合dataframe结果
        branch_aggregated_results = {}
        branch_dataframes = {}

        for branch_id, branch in execution_branches.items():
            branch_context = self.context_manager.get_branch_context(branch_id)
            if branch_context:
                # 获取分支的聚合结果
                branch_final_results = branch_context.get_final_results()
                branch_aggregated_results[branch_id] = branch_final_results

                # 如果没有聚合结果，尝试获取按索引值组织的dataframe输出
                if not branch_final_results:
                    index_dataframes = self._get_index_dataframes_for_branch(branch_id)
                    if index_dataframes:
                        branch_dataframes[branch_id] = index_dataframes

        # 创建输出节点输入 - 传递按分支组织的数据
        output_input = OutputInput(
            branch_aggregated_results=branch_aggregated_results,
            branch_dataframes=branch_dataframes,
        )

        # 创建临时路径上下文（输出节点不需要特定的路径上下文）
        temp_path_context = self.context_manager.create_path_context(
            IndexValue("output")
        )

        # 执行输出节点
        result = self.output_processor.process(
            target_node,
            output_input,
            global_context,
            temp_path_context,
            branch_results,
            node_map,
            self.context_manager,
        )

        # if not result.success:
        #     raise ValueError(f"Output node execution failed: {result.error}")

        return result

    def _batch_preload_files(
        self,
        execution_branches: Dict[str, ExecutionBranch],
        workspace_config,
        global_context,
    ):
        """
        批量预加载所有需要的Excel文件

        Args:
            execution_branches: 执行分支字典
            workspace_config: 工作区配置
            global_context: 全局上下文
        """
        try:
            # 收集所有执行节点
            all_execution_nodes = []
            for branch in execution_branches.values():
                all_execution_nodes.extend(branch.execution_nodes)

            # 去重
            unique_nodes = list(set(all_execution_nodes))

            # 分析文件需求
            batch_infos = self.file_analyzer.analyze_file_requirements(
                workspace_config, unique_nodes
            )

            if not batch_infos:
                # print("PERF: No files to preload")
                return

            # 执行批量预加载
            preload_summary = self.batch_preloader.preload_files(
                batch_infos, global_context
            )

            # 记录预加载结果到性能分析器
            from ..performance.analyzer import get_performance_analyzer

            analyzer = get_performance_analyzer()

            # 这里可以添加预加载相关的性能统计
            # print(
            #     f"PERF: Batch preload completed - {preload_summary.successful_sheets}/{preload_summary.total_sheets} sheets loaded"
            # )

        except Exception as e:
            # print(
            #     f"PERF WARNING: Batch preload failed - {str(e)}, falling back to on-demand loading"
            # )
            pass
            # 预加载失败不应该影响主流程，继续执行

    def _create_execution_summary(
        self,
        index_results: List[IndexExecutionResult],
        branch_results: List[BranchExecutionResult],
        total_time_ms: float,
        execution_mode: ExecutionMode,
    ) -> PipelineExecutionSummary:
        """
        创建执行摘要

        Args:
            index_results: 索引执行结果列表
            branch_results: 分支执行结果列表
            total_time_ms: 总执行时间（毫秒）
            execution_mode: 执行模式

        Returns:
            执行摘要
        """
        total_nodes_executed = sum(len(result.node_results) for result in index_results)

        return PipelineExecutionSummary(
            total_indices_processed=len(index_results),
            total_nodes_executed=total_nodes_executed,
            total_branches=len(branch_results),
            total_execution_time_ms=total_time_ms,
            execution_mode=execution_mode,
        )

    def _create_empty_summary(
        self, execution_mode: ExecutionMode, total_time_ms: float = 0.0
    ) -> PipelineExecutionSummary:
        """
        创建空的执行摘要

        Args:
            execution_mode: 执行模式
            total_time_ms: 总执行时间（毫秒）

        Returns:
            空的执行摘要
        """
        return PipelineExecutionSummary(
            total_indices_processed=0,
            total_nodes_executed=0,
            total_branches=0,
            total_execution_time_ms=total_time_ms,
            execution_mode=execution_mode,
        )

    def _prepare_node_input(
        self, node: BaseNode, index_value: IndexValue, path_context: PathContext
    ):
        """
        根据节点类型准备输入数据

        Args:
            node: 节点配置
            index_value: 当前索引值
            path_context: 路径上下文

        Returns:
            节点输入数据
        """
        from ..models import (
            AggregatorInput,
            IndexSourceInput,
            OutputInput,
            RowFilterInput,
            RowLookupInput,
            SheetSelectorInput,
        )

        if node.type == NodeType.INDEX_SOURCE:
            return IndexSourceInput()
        elif node.type == NodeType.SHEET_SELECTOR:
            return SheetSelectorInput(index_value=index_value)
        elif node.type == NodeType.ROW_FILTER:
            return RowFilterInput(
                dataframe=path_context.current_dataframe, index_value=index_value
            )
        elif node.type == NodeType.ROW_LOOKUP:
            return RowLookupInput(
                dataframe=path_context.current_dataframe, index_value=index_value
            )
        elif node.type == NodeType.AGGREGATOR:
            return AggregatorInput(
                dataframe=(
                    path_context.last_non_aggregator_dataframe
                    if path_context.last_non_aggregator_dataframe is not None
                    else path_context.current_dataframe
                ),
                index_value=index_value,
            )
        elif node.type == NodeType.OUTPUT:
            # 输出节点在其他地方单独处理，这里不应该被调用
            return OutputInput(branch_aggregated_results={})
        else:
            raise ValueError(f"Unknown node type: {node.type}")

    def _update_path_context_from_output(
        self, path_context: PathContext, node_type: NodeType, output
    ):
        """
        根据节点输出更新路径上下文

        Args:
            path_context: 路径上下文
            node_type: 节点类型
            output: 节点输出
        """
        # 更新当前DataFrame
        if hasattr(output, "dataframe"):
            path_context.current_dataframe = output.dataframe

            # 如果不是聚合节点，也更新last_non_aggregator_dataframe
            if node_type != NodeType.AGGREGATOR:
                path_context.last_non_aggregator_dataframe = output.dataframe

    def _serialize_node_output(self, output, node_type: NodeType):
        """
        根据节点类型强类型序列化节点输出

        Args:
            output: 节点输出
            node_type: 节点类型

        Returns:
            序列化后的输出字典

        Raises:
            ValueError: 如果输出类型不匹配预期
        """
        from ..models import (
            AggregatorOutput,
            IndexSourceOutput,
            OutputResult,
            RowFilterOutput,
            RowLookupOutput,
            SheetSelectorOutput,
        )

        try:
            if node_type == NodeType.INDEX_SOURCE:
                if not isinstance(output, IndexSourceOutput):
                    raise ValueError(f"Expected IndexSourceOutput, got {type(output)}")
                return output.dict()

            elif node_type == NodeType.SHEET_SELECTOR:
                if not isinstance(output, SheetSelectorOutput):
                    raise ValueError(
                        f"Expected SheetSelectorOutput, got {type(output)}"
                    )
                return output.dict()

            elif node_type == NodeType.ROW_FILTER:
                if not isinstance(output, RowFilterOutput):
                    raise ValueError(f"Expected RowFilterOutput, got {type(output)}")
                return output.dict()

            elif node_type == NodeType.ROW_LOOKUP:
                if not isinstance(output, RowLookupOutput):
                    raise ValueError(f"Expected RowLookupOutput, got {type(output)}")
                return output.dict()

            elif node_type == NodeType.AGGREGATOR:
                if not isinstance(output, AggregatorOutput):
                    raise ValueError(f"Expected AggregatorOutput, got {type(output)}")
                return output.dict()

            elif node_type == NodeType.OUTPUT:
                if not isinstance(output, OutputResult):
                    raise ValueError(f"Expected OutputResult, got {type(output)}")
                return output.dict()

            else:
                raise ValueError(f"Unknown node type: {node_type}")

        except AttributeError as e:
            # 如果output没有model_dump方法，提供更详细的错误信息
            raise ValueError(
                f"Output for {node_type} node does not have model_dump method. "
                f"Output type: {type(output)}, value: {output}"
            ) from e
        except Exception as e:
            # 捕获其他序列化错误
            raise ValueError(
                f"Failed to serialize output for {node_type} node. "
                f"Output type: {type(output)}, error: {str(e)}"
            ) from e

    def _get_last_dataframe_for_branch(
        self,
        branch_id: str,
        branch: ExecutionBranch,
        branch_results: List[BranchExecutionResult],
        node_map: Dict[str, BaseNode],
    ):
        """
        获取分支的最后一个非聚合节点的dataframe输出

        Args:
            branch_id: 分支ID
            branch: 执行分支
            branch_results: 分支执行结果列表
            node_map: 节点映射

        Returns:
            最后一个非聚合节点的dataframe，如果找不到则返回None
        """
        try:
            # 直接从分支上下文获取最后的非聚合dataframe
            branch_context = self.context_manager.get_branch_context(branch_id)
            if (
                branch_context
                and branch_context.last_non_aggregated_dataframe is not None
            ):
                return branch_context.last_non_aggregated_dataframe

            return None

        except Exception as e:
            # print(f"Warning: Failed to get last dataframe for branch {branch_id}: {e}")
            return None

    def _get_index_dataframes_for_branch(self, branch_id: str) -> Dict[IndexValue, pd.DataFrame]:
        """
        获取分支的按索引值组织的dataframe输出

        Args:
            branch_id: 分支ID

        Returns:
            按索引值组织的dataframe字典，如果找不到则返回空字典
        """
        try:
            branch_context = self.context_manager.get_branch_context(branch_id)
            if branch_context:
                return branch_context.get_index_dataframes()
            return {}
        except Exception as e:
            # print(f"Warning: Failed to get index dataframes for branch {branch_id}: {e}")
            return {}

    def _get_node_latest_dataframe_from_path_context(
        self, node_id: str, branch_id: str
    ):
        """
        从路径上下文中获取节点的最新dataframe输出

        Args:
            node_id: 节点ID
            branch_id: 分支ID

        Returns:
            节点的dataframe输出，如果找不到则返回None
        """
        # 这个方法现在已经不需要了，被上面的方法替代
        return None
