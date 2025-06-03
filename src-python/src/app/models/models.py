"""
API请求和响应模型定义
只包含API层面的请求响应类型，核心pipeline类型在pipeline.models中定义
"""

from typing import List, Optional, Dict, Any, Union, Generic, TypeVar
from pydantic import BaseModel, Field

T = TypeVar('T')

# ============================================================================
# 通用API响应模型
# ============================================================================

class PythonResponse(Generic[T], BaseModel):
    """通用Python响应包装器"""
    status: str
    message: Optional[str] = None
    data: Optional[T] = None


class APIResponse(BaseModel):
    """标准API响应包装器"""
    success: bool = Field(..., description="请求是否成功")
    data: Optional[Any] = Field(None, description="响应数据")
    error: Optional[str] = Field(None, description="错误信息")
    message: Optional[str] = Field(None, description="可选消息")


class HealthResponse(BaseModel):
    """健康检查响应模型"""
    status: str = Field(..., description="服务状态")
    timestamp: Optional[str] = Field(None, description="当前时间戳")
    version: Optional[str] = Field(None, description="服务版本")
    service: Optional[str] = Field(None, description="服务名称")


class ErrorResponse(BaseModel):
    """错误响应模型"""
    error_type: str = Field(
        ...,
        description="错误类型 (例如: 'FileNotFound', 'InvalidHeader', 'ProcessingError')",
    )
    message: str = Field(..., description="详细错误信息")


# ============================================================================
# Excel文件操作相关的API请求/响应模型
# ============================================================================

class PreviewRequest(BaseModel):
    """Excel预览请求模型"""
    file_path: str = Field(..., description="Excel文件路径")


class IndexValuesRequest(BaseModel):
    """获取索引值请求模型"""
    file_path: str = Field(..., description="Excel文件路径")
    sheet_name: str = Field(..., description="Sheet名称")
    header_row: int = Field(..., description="标题行号")
    column_name: str = Field(..., description="要获取值的列名")


class HeaderRowRequest(BaseModel):
    """读取标题行请求模型"""
    file_path: str = Field(..., description="Excel文件路径")
    sheet_name: str = Field(..., description="Sheet名称")
    header_row: int = Field(..., description="标题行号")


class SheetNamesRequest(BaseModel):
    """读取Sheet名称请求模型"""
    file_path: str = Field(..., description="Excel文件路径")


# Excel相关响应模型
class SheetInfo(BaseModel):
    """Sheet信息"""
    sheet_name: str = Field(..., description="Sheet名称")
    columns: List[str] = Field(..., description="列名列表")
    preview_data: List[List[Any]] = Field(..., description="预览数据行")


class FilePreviewResponse(BaseModel):
    """文件预览响应"""
    sheets: List[SheetInfo] = Field(..., description="Sheet列表及其信息")


class PreviewResponse(BaseModel):
    """预览响应（兼容性）"""
    sheets: List[SheetInfo] = Field(..., description="Sheet列表及其信息")


class IndexValues(BaseModel):
    """索引值数据"""
    column: str = Field(..., description="列名")
    data: List[Any] = Field(..., description="值列表")


class IndexValuesResponse(BaseModel):
    """索引值响应"""
    values: IndexValues = Field(..., description="列的唯一值")


class TryReadHeaderRowResponse(BaseModel):
    """尝试读取标题行响应"""
    column_names: List[Any] = Field(..., description="列名列表")


class TryReadSheetNamesResponse(BaseModel):
    """尝试读取Sheet名称响应"""
    sheet_names: List[Any] = Field(..., description="Sheet名称列表")


class FileDetailsResponse(BaseModel):
    """文件详情响应"""
    columns: List[str] = Field(..., description="列名列表")
    preview_data: List[Dict[str, Any]] = Field(..., description="预览数据")


# ============================================================================
# Pipeline执行相关的API请求/响应模型
# ============================================================================

class PipelineRequest(BaseModel):
    """Pipeline执行请求模型"""
    workspace_id: str = Field(..., description="工作区ID")
    target_node_id: str = Field(..., description="目标节点ID") 
    execution_mode: str = Field(default="production", description="执行模式: test 或 production")
    test_mode_max_rows: int = Field(default=100, description="测试模式最大行数限制")
    output_file_path: Optional[str] = Field(None, description="输出文件路径（生产模式）")


class TestNodeRequest(BaseModel):
    """测试Pipeline节点请求模型"""
    workspace_id: Optional[str] = Field(None, description="工作区ID（用于向后兼容）")
    workspace_config_json: Optional[str] = Field(None, description="工作区配置JSON（优先使用）")
    node_id: str = Field(..., description="节点ID")
    execution_mode: str = Field(default="test", description="执行模式: test 或 production")
    test_mode_max_rows: int = Field(default=100, description="测试模式最大行数限制")


class PipelineExecutionResponse(BaseModel):
    """Pipeline执行响应模型"""
    result: Any = Field(..., description="Pipeline执行结果")
    execution_time: Optional[float] = Field(None, description="执行时间（秒）")


class NodeTestResponse(BaseModel):
    """节点测试响应模型"""
    result: Any = Field(..., description="节点测试结果")
    node_id: str = Field(..., description="测试的节点ID")


# API层面的Sheet数据表示（用于响应）
class APISheetData(BaseModel):
    """API层面的Sheet数据结构"""
    sheet_name: str = Field(..., description="Sheet名称")
    columns: List[str] = Field(..., description="列名列表")
    data: List[List[Union[str, int, float, None]]] = Field(..., description="数据行列表")
    metadata: Optional[Dict[str, Any]] = Field(None, description="元数据")


class NodeTestAPIResponse(BaseModel):
    """节点测试API响应"""
    success: bool = Field(..., description="请求是否成功")
    sheets: Optional[List[APISheetData]] = Field(None, description="格式化后的Sheet数据")
    error: Optional[str] = Field(None, description="错误信息")


# ============================================================================
# 工作区管理相关的API请求/响应模型
# ============================================================================

class SaveWorkspaceRequest(BaseModel):
    """保存工作区请求模型"""
    workspace_id: str = Field(..., description="工作区ID")
    config_json: str = Field(..., description="工作区配置JSON字符串")


class LoadWorkspaceRequest(BaseModel):
    """加载工作区请求模型"""
    workspace_id: str = Field(..., description="要加载的工作区ID")


class WorkspaceInfo(BaseModel):
    """工作区信息模型"""
    id: str = Field(..., description="工作区ID")
    name: str = Field(..., description="工作区名称")


class WorkspaceListResponse(BaseModel):
    """工作区列表响应模型"""
    workspaces: List[WorkspaceInfo] = Field(..., description="工作区列表")


# ============================================================================
# 文件元数据模型（用于API层面的文件管理）
# ============================================================================

class FileMeta(BaseModel):
    """文件元数据（API层面）"""
    id: str = Field(
        ...,
        description="文件唯一标识符（例如前端生成的UUID）",
    )
    alias: str = Field(..., description="用户定义的文件名")
    path: str = Field(..., description="Excel文件的绝对路径")
    header_row: int = Field(..., description="标题行的1-based索引")
    sheet_name: Optional[str] = Field(
        None, description="要读取的Sheet名称（如果不是第一个）"
    )
    columns: List[str] = Field(
        [], description="列名列表（由后端读取后填充）"
    )