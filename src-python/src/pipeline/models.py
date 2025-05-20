# src-python/src/pipeline/models.py
from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

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