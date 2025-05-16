from dataclasses import dataclass
from typing import Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar('T')


class PythonResponse(Generic[T], BaseModel):
    status: str
    message: Optional[str] = None
    data: Optional[T] = None  
    
@dataclass
class ExcelInfo:
    sheets: list[str]
    sheet_info: dict[str, dict[str, list[str]]]

@dataclass
class PreviewData:
    columns: list[str]
    data: list[list[str | int]] 

@dataclass
class IndexMapping:
    index_source: dict[str, str]
    data_source: dict[str, str]
    mapping: dict[str, str]
    