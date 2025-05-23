# src-python/src/pipeline/models.py
from enum import Enum
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field
import pandas as pd

class NodeType(str, Enum):
    INDEX_SOURCE = "indexSource"
    SHEET_SELECTOR = "sheetSelector" 
    ROW_FILTER = "rowFilter"
    ROW_LOOKUP = "rowLookup"
    AGGREGATOR = "aggregator"
    OUTPUT = "output"

class BaseNode(BaseModel):
    id: str
    type: NodeType
    data: Dict[str, Any]

class Edge(BaseModel):
    source: str
    target: str

class Pipeline(BaseModel):
    nodes: List[BaseNode] = []
    edges: List[Edge] = []

class FileInfo(BaseModel):
    """文件信息"""
    id: str
    name: str
    path: str
    sheet_metas: List[Dict[str, Any]]

class ExecutionContext(BaseModel):
    """执行上下文，包含当前索引值和相关信息"""
    current_index: Optional[str] = None
    index_source_id: Optional[str] = None
    files: Dict[str, FileInfo] = {}
    loaded_dataframes: Dict[str, pd.DataFrame] = Field(default_factory=dict)
    
    class Config:
        arbitrary_types_allowed = True

class PipelineResult(BaseModel):
    """Pipeline执行结果"""
    node_id: str
    index_value: Optional[str] = None
    result_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    
class ExecutionResults(BaseModel):
    """完整的执行结果集合"""
    results: Dict[str, List[PipelineResult]] = Field(default_factory=dict)  # node_id -> list of results
    success: bool = True
    error: Optional[str] = None