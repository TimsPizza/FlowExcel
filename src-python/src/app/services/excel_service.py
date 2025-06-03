"""
Excel processing service.
Encapsulates business logic for Excel file operations.
"""

from typing import Any, List
from excel.excel_ops import (
    get_excel_preview,
    try_read_header_row,
    get_index_values,
    try_read_sheet_names,
)
from ..models import (
    PreviewResponse,
    IndexValuesResponse,
    TryReadHeaderRowResponse,
    TryReadSheetNamesResponse,
)


class ExcelService:
    """Service class for Excel operations."""
    
    @staticmethod
    def get_preview(file_path: str) -> Any:
        """Get Excel file preview."""
        return get_excel_preview(file_path=file_path)
    
    @staticmethod
    def get_index_values(
        file_path: str,
        sheet_name: str,
        header_row: int,
        column_name: str
    ) -> IndexValuesResponse:
        """Get unique values from specified column."""
        values = get_index_values(
            file_path=file_path,
            sheet_name=sheet_name,
            header_row=header_row,
            column_name=column_name
        )
        return IndexValuesResponse(values=values)
    
    @staticmethod
    def read_header_row(
        file_path: str,
        sheet_name: str,
        header_row: int
    ) -> TryReadHeaderRowResponse:
        """Read header row from Excel file."""
        column_names = try_read_header_row(
            file_path=file_path,
            sheet_name=sheet_name,
            header_row=header_row
        )
        return TryReadHeaderRowResponse(column_names=column_names)
    
    @staticmethod
    def read_sheet_names(file_path: str) -> TryReadSheetNamesResponse:
        """Read sheet names from Excel file."""
        sheet_names = try_read_sheet_names(file_path=file_path)
        return TryReadSheetNamesResponse(sheet_names=sheet_names) 