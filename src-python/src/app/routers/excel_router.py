"""
Excel processing API router.
Handles all Excel file operations including preview, header reading, and sheet operations.
"""

import traceback
from fastapi import APIRouter

from app.models import (
    APIResponse,
    PreviewRequest,
    IndexValuesRequest,
    HeaderRowRequest,
    SheetNamesRequest,
)
from app.services.excel_service import ExcelService

router = APIRouter(prefix="/excel", tags=["excel"])


@router.post("/preview", response_model=APIResponse)
async def preview_excel_data(request: PreviewRequest):
    """Preview Excel data from a file."""
    try:
        result = ExcelService.get_preview(file_path=request.file_path)
        return APIResponse(success=True, data=result)
    except Exception as e:
        error_msg = f"Error previewing Excel data: {str(e)}"
        traceback.print_exc()
        return APIResponse(success=False, error=error_msg)


@router.post("/index-values", response_model=APIResponse)
async def get_index_values_endpoint(request: IndexValuesRequest):
    """Get unique values from specified columns as index."""
    try:
        response_data = ExcelService.get_index_values(
            file_path=request.file_path,
            sheet_name=request.sheet_name,
            header_row=request.header_row,
            column_name=request.column_name,
        )
        return APIResponse(success=True, data=response_data.dict())
    except Exception as e:
        error_msg = f"Error getting index values: {str(e)}"
        traceback.print_exc()
        return APIResponse(success=False, error=error_msg)


@router.post("/header-row", response_model=APIResponse)
async def try_read_header_row_endpoint(request: HeaderRowRequest):
    """Try to read the header row from an Excel file."""
    try:
        response_data = ExcelService.read_header_row(
            file_path=request.file_path,
            sheet_name=request.sheet_name,
            header_row=request.header_row,
        )
        return APIResponse(success=True, data=response_data)
    except Exception as e:
        error_msg = f"Error reading header row: {str(e)}"
        traceback.print_exc()
        return APIResponse(success=False, error=error_msg)


@router.post("/sheet-names", response_model=APIResponse)
async def try_read_sheet_names_endpoint(request: SheetNamesRequest):
    """Try to read the sheet names from an Excel file."""
    try:
        response_data = ExcelService.read_sheet_names(file_path=request.file_path)
        return APIResponse(success=True, data=response_data.dict())
    except Exception as e:
        error_msg = f"Error reading sheet names: {str(e)}"
        traceback.print_exc()
        return APIResponse(success=False, error=error_msg)
