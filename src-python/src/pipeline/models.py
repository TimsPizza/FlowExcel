"""
完整的Pipeline系统数据类型定义
包括节点输入输出、执行上下文、结果类型等所有类型定义
"""

from enum import Enum
from typing import List, Dict, Any, Optional, Union, TypeVar, Generic, ClassVar
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pydantic import BaseModel, Field
import pandas as pd
import time
from threading import Lock
from pipeline.performance.analyzer import get_performance_analyzer


# ==================== 基础数据类型 ====================


class ExecutionMode(str, Enum):
    """执行模式"""

    TEST = "test"  # 测试模式：限制数据量，不输出文件
    PRODUCTION = "production"  # 生产模式：完整数据，输出文件


class NodeType(str, Enum):
    """节点类型"""

    INDEX_SOURCE = "indexSource"
    SHEET_SELECTOR = "sheetSelector"
    ROW_FILTER = "rowFilter"
    ROW_LOOKUP = "rowLookup"
    AGGREGATOR = "aggregator"
    OUTPUT = "output"


class AggregationOperation(str, Enum):
    """聚合操作类型"""

    SUM = "sum"
    COUNT = "count"
    AVERAGE = "average"
    MIN = "min"
    MAX = "max"
    FIRST = "first"
    LAST = "last"


class IndexValue(str):
    """索引值类型 - 强类型化的字符串"""

    pass


class DataFrame(BaseModel):
    """DataFrame封装 - 序列化友好的pandas DataFrame表示"""

    columns: List[str] = Field(..., description="列名列表")
    data: List[List[Union[str, int, float, None]]] = Field(
        ..., description="数据行列表"
    )
    total_rows: int = Field(..., description="总行数")

    @classmethod
    def from_pandas(cls, df: pd.DataFrame) -> "DataFrame":
        """从pandas DataFrame创建"""
        try:
            analyzer = get_performance_analyzer()
            conversion_id = analyzer.onDataFrameFromPandasStart(len(df))
        except ImportError:
            analyzer = None
            conversion_id = None

        try:
            result = cls(
                columns=df.columns.tolist(), data=df.values.tolist(), total_rows=len(df)
            )

            if analyzer and conversion_id:
                analyzer.onDataFrameFromPandasFinish(conversion_id, len(df))
            return result
        except Exception as e:
            if analyzer and conversion_id:
                analyzer.onDataFrameFromPandasFinish(conversion_id, len(df))
            raise e

    def to_pandas(self) -> pd.DataFrame:
        """转换为pandas DataFrame"""
        try:
            analyzer = get_performance_analyzer()
            conversion_id = analyzer.onDataFrameToPandasStart(len(self.data))
        except ImportError:
            analyzer = None
            conversion_id = None

        try:
            result = pd.DataFrame(self.data, columns=self.columns)

            if analyzer and conversion_id:
                analyzer.onDataFrameToPandasFinish(conversion_id, len(self.data))
            return result
        except Exception as e:
            if analyzer and conversion_id:
                analyzer.onDataFrameToPandasFinish(conversion_id, len(self.data))
            raise e

    def limit_rows(self, max_rows: int) -> "DataFrame":
        """限制行数 - 用于测试模式"""
        if len(self.data) <= max_rows:
            return self
        return DataFrame(
            columns=self.columns,
            data=self.data[:max_rows],
            total_rows=self.total_rows,  # 保持原始总行数信息
        )


# ==================== 节点输入输出基类 ====================


class NodeInput(BaseModel):
    """节点输入基类"""

    pass


class NodeOutput(BaseModel):
    """节点输出基类"""

    pass


# 1. 索引源节点
class IndexSourceInput(NodeInput):
    """索引源节点输入 - 无输入"""

    pass


class IndexSourceOutput(NodeOutput):
    """索引源节点输出"""

    index_values: List[IndexValue] = Field(..., description="提取的索引值列表")
    source_column: Optional[str] = Field(None, description="源列名（如果按列提取）")


# 2. 表选择节点
class SheetSelectorInput(NodeInput):
    """表选择节点输入"""

    index_value: IndexValue = Field(..., description="当前索引值")


class SheetSelectorOutput(NodeOutput):
    """表选择节点输出"""

    dataframe: Union[DataFrame, pd.DataFrame] = Field(
        ..., description="选中的DataFrame"
    )
    sheet_name: str = Field(..., description="实际使用的sheet名")
    index_value: IndexValue = Field(..., description="对应的索引值")

    class Config:
        arbitrary_types_allowed = True  # 允许pandas DataFrame


# 3. 行过滤节点
class RowFilterInput(NodeInput):
    """行过滤节点输入"""

    dataframe: Union[DataFrame, pd.DataFrame] = Field(
        ..., description="待过滤的DataFrame"
    )
    index_value: IndexValue = Field(..., description="当前索引值")

    class Config:
        arbitrary_types_allowed = True  # 允许pandas DataFrame


class RowFilterOutput(NodeOutput):
    """行过滤节点输出"""

    dataframe: Union[DataFrame, pd.DataFrame] = Field(
        ..., description="过滤后的DataFrame"
    )
    index_value: IndexValue = Field(..., description="对应的索引值")
    filtered_count: int = Field(..., description="过滤后的行数")

    class Config:
        arbitrary_types_allowed = True  # 允许pandas DataFrame


# 4. 行查找节点
class RowLookupInput(NodeInput):
    """行查找节点输入"""

    dataframe: Union[DataFrame, pd.DataFrame] = Field(..., description="源DataFrame")
    index_value: IndexValue = Field(..., description="用于匹配的索引值")

    class Config:
        arbitrary_types_allowed = True  # 允许pandas DataFrame


class RowLookupOutput(NodeOutput):
    """行查找节点输出"""

    dataframe: Union[DataFrame, pd.DataFrame] = Field(
        ..., description="匹配的行组成的DataFrame"
    )
    index_value: IndexValue = Field(..., description="对应的索引值")
    matched_count: int = Field(..., description="匹配的行数")

    class Config:
        arbitrary_types_allowed = True  # 允许pandas DataFrame


# 5. 聚合节点
class AggregatorInput(NodeInput):
    """聚合节点输入"""

    dataframe: Union[DataFrame, pd.DataFrame] = Field(
        ..., description="完整的上游非聚合节点输出DataFrame"
    )
    index_value: IndexValue = Field(..., description="当前索引值")

    class Config:
        arbitrary_types_allowed = True  # 允许pandas DataFrame


class AggregationResult(BaseModel):
    """单个聚合结果"""

    index_value: IndexValue = Field(..., description="索引值")
    column_name: str = Field(..., description="输出列名")
    operation: AggregationOperation = Field(..., description="聚合操作")
    result_value: Union[int, float, str, None] = Field(..., description="聚合结果值")


class AggregatorOutput(NodeOutput):
    """聚合节点输出"""

    result: AggregationResult = Field(..., description="聚合结果")


# 6. 输出节点
class OutputInput(NodeInput):
    """输出节点输入"""

    branch_aggregated_results: Dict[
        str, Dict[IndexValue, Dict[str, Union[int, float, str, None]]]
    ] = Field(
        ..., description="按分支组织的聚合结果，格式为 {分支ID: {索引值: {列名: 值}}}"
    )


class SheetData(BaseModel):
    """单个Sheet的数据"""

    sheet_name: str = Field(..., description="Sheet名称")
    dataframe: DataFrame = Field(..., description="Sheet内容")
    branch_id: str = Field(..., description="对应的分支ID")
    source_name: str = Field(..., description="索引源的易读名称")


class OutputResult(NodeOutput):
    """输出节点输出"""

    sheets: List[SheetData] = Field(..., description="多个Sheet数据")
    total_sheets: int = Field(..., description="总Sheet数量")


# ==================== 执行上下文类型 ====================


class FileInfo(BaseModel):
    """文件信息"""

    id: str = Field(..., description="文件ID")
    name: str = Field(..., description="文件名")
    path: str = Field(..., description="文件路径")
    sheet_metas: List[Dict[str, Any]] = Field(..., description="Sheet元数据")


class GlobalContext(BaseModel):
    """全局执行上下文 - 整个pipeline执行期间共享"""

    files: Dict[str, FileInfo] = Field(default_factory=dict, description="文件信息映射")
    loaded_dataframes: Dict[str, pd.DataFrame] = Field(
        default_factory=dict, description="已加载的DataFrame缓存"
    )
    execution_mode: ExecutionMode = Field(
        default=ExecutionMode.PRODUCTION, description="执行模式"
    )

    class Config:
        arbitrary_types_allowed = True  # 允许pandas DataFrame


class PathContext(BaseModel):
    """路径执行上下文 - 单个索引值执行期间的上下文"""

    current_index: IndexValue = Field(..., description="当前索引值")
    last_non_aggregator_dataframe: Optional[Union[DataFrame, pd.DataFrame]] = Field(
        None, description="最近的非聚合节点输出DataFrame"
    )
    current_dataframe: Optional[Union[DataFrame, pd.DataFrame]] = Field(
        None, description="当前节点的DataFrame"
    )
    execution_trace: List[str] = Field(default_factory=list, description="执行轨迹")

    class Config:
        arbitrary_types_allowed = True  # 允许pandas DataFrame


class BranchContext(BaseModel):
    """分支执行上下文 - 横跨所有索引值的分支级上下文"""

    branch_id: str = Field(..., description="分支标识")
    index_source_node_id: str = Field(..., description="分支对应的索引源节点ID")
    aggregation_results: Dict[IndexValue, List[AggregationResult]] = Field(
        default_factory=dict, description="按索引值组织的聚合结果"
    )
    branch_metadata: Dict[str, Any] = Field(
        default_factory=dict, description="分支元数据"
    )

    def add_aggregation_result(self, result: AggregationResult):
        """添加聚合结果"""
        if result.index_value not in self.aggregation_results:
            self.aggregation_results[result.index_value] = []
        self.aggregation_results[result.index_value].append(result)

    def get_final_results(
        self,
    ) -> Dict[IndexValue, Dict[str, Union[int, float, str, None]]]:
        """获取最终聚合结果"""
        final_results = {}
        for index_value, results in self.aggregation_results.items():
            final_results[index_value] = {
                result.column_name: result.result_value for result in results
            }
        return final_results


# ==================== 节点定义类型 ====================


class BaseNode(BaseModel):
    """基础节点模型"""

    id: str = Field(..., description="节点ID")
    type: NodeType = Field(..., description="节点类型")
    data: Dict[str, Any] = Field(..., description="节点配置数据")


class Edge(BaseModel):
    """边定义"""

    source: str = Field(..., description="源节点ID")
    target: str = Field(..., description="目标节点ID")


# ==================== 执行结果类型 ====================


class NodeExecutionResult(BaseModel):
    """单个节点执行结果"""

    node_id: str = Field(..., description="节点ID")
    node_type: NodeType = Field(..., description="节点类型")
    success: bool = Field(..., description="执行是否成功")
    output: Optional[Dict[str, Any]] = Field(None, description="节点输出")
    error: Optional[str] = Field(None, description="错误信息")
    execution_time_ms: float = Field(..., description="执行时间（毫秒）")


class IndexExecutionResult(BaseModel):
    """单个索引值的执行结果"""

    index_value: IndexValue = Field(..., description="索引值")
    success: bool = Field(..., description="执行是否成功")
    node_results: List[NodeExecutionResult] = Field(..., description="节点执行结果列表")
    error: Optional[str] = Field(None, description="错误信息")
    total_execution_time_ms: float = Field(..., description="总执行时间（毫秒）")


class BranchExecutionResult(BaseModel):
    """分支执行结果"""

    branch_id: str = Field(..., description="分支ID")
    success: bool = Field(..., description="执行是否成功")
    final_aggregations: Dict[IndexValue, Dict[str, Union[int, float, str, None]]] = (
        Field(..., description="最终聚合结果")
    )
    processed_indices: List[IndexValue] = Field(..., description="处理的索引值列表")
    error: Optional[str] = Field(None, description="错误信息")


# ==================== 最外层API返回类型 ====================


class PipelineExecutionSummary(BaseModel):
    """Pipeline执行摘要"""

    total_indices_processed: int = Field(..., description="处理的索引总数")
    total_nodes_executed: int = Field(..., description="执行的节点总数")
    total_branches: int = Field(..., description="分支总数")
    total_execution_time_ms: float = Field(..., description="总执行时间（毫秒）")
    execution_mode: ExecutionMode = Field(..., description="执行模式")


class PipelineExecutionResult(BaseModel):
    """Pipeline执行的最终结果 - 最外层API返回"""

    success: bool = Field(..., description="整体执行是否成功")

    # 执行结果数据
    output_data: Optional[OutputResult] = Field(None, description="输出节点的结果数据")

    # 执行过程信息
    execution_summary: PipelineExecutionSummary = Field(..., description="执行摘要")
    index_results: List[IndexExecutionResult] = Field(
        ..., description="各索引值执行结果"
    )
    branch_results: List[BranchExecutionResult] = Field(
        ..., description="各分支执行结果"
    )

    # 错误信息
    error: Optional[str] = Field(None, description="全局错误信息")
    warnings: List[str] = Field(default_factory=list, description="警告信息列表")

    # 文件输出信息（仅生产模式）
    output_file_path: Optional[str] = Field(None, description="输出文件路径")
    output_file_size_bytes: Optional[int] = Field(None, description="输出文件大小")


# ==================== 工作区配置类型 ====================


class WorkspaceConfig(BaseModel):
    """工作区配置"""

    id: str = Field(..., description="工作区ID")
    name: str = Field(..., description="工作区名称")
    files: List[FileInfo] = Field(..., description="文件列表")
    flow_nodes: List[BaseNode] = Field(..., description="流程节点列表")
    flow_edges: List[Edge] = Field(..., description="流程边列表")


# ==================== 主API接口类型 ====================


class ExecutePipelineRequest(BaseModel):
    """执行Pipeline的请求参数"""

    workspace_config: WorkspaceConfig = Field(..., description="工作区配置")
    target_node_id: str = Field(..., description="目标节点ID")
    execution_mode: ExecutionMode = Field(
        default=ExecutionMode.PRODUCTION, description="执行模式"
    )
    test_mode_max_rows: int = Field(default=100, description="测试模式最大行数限制")
    output_file_path: Optional[str] = Field(
        None, description="输出文件路径（生产模式）"
    )


# ==================== 类型验证工具 ====================


def validate_node_input_output_compatibility(
    node_type: NodeType, input_data: NodeInput, output_data: NodeOutput
) -> bool:
    """验证节点输入输出类型兼容性"""
    type_mapping = {
        NodeType.INDEX_SOURCE: (IndexSourceInput, IndexSourceOutput),
        NodeType.SHEET_SELECTOR: (SheetSelectorInput, SheetSelectorOutput),
        NodeType.ROW_FILTER: (RowFilterInput, RowFilterOutput),
        NodeType.ROW_LOOKUP: (RowLookupInput, RowLookupOutput),
        NodeType.AGGREGATOR: (AggregatorInput, AggregatorOutput),
        NodeType.OUTPUT: (OutputInput, OutputResult),
    }

    expected_input, expected_output = type_mapping.get(node_type, (None, None))
    if expected_input is None:
        return False

    return isinstance(input_data, expected_input) and isinstance(
        output_data, expected_output
    )


# ==================== 导出所有类型 ====================

__all__ = [
    # 基础类型
    "ExecutionMode",
    "NodeType",
    "AggregationOperation",
    "IndexValue",
    "DataFrame",
    # 节点输入输出类型
    "NodeInput",
    "NodeOutput",
    "IndexSourceInput",
    "IndexSourceOutput",
    "SheetSelectorInput",
    "SheetSelectorOutput",
    "RowFilterInput",
    "RowFilterOutput",
    "RowLookupInput",
    "RowLookupOutput",
    "AggregatorInput",
    "AggregatorOutput",
    "AggregationResult",
    "OutputInput",
    "OutputResult",
    "SheetData",
    # 执行上下文类型
    "FileInfo",
    "GlobalContext",
    "PathContext",
    "BranchContext",
    # 节点和边类型
    "BaseNode",
    "Edge",
    # 执行结果类型
    "NodeExecutionResult",
    "IndexExecutionResult",
    "BranchExecutionResult",
    # 最外层API类型
    "PipelineExecutionSummary",
    "PipelineExecutionResult",
    "WorkspaceConfig",
    "ExecutePipelineRequest",
    # 工具函数
    "validate_node_input_output_compatibility",
]
