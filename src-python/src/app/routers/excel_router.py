"""
Excel processing API router.
Handles all Excel file operations including preview, header reading, and sheet operations.
"""

import traceback
from fastapi import APIRouter, Request

from app.models import (
    APIResponse,
    PreviewRequest,
    IndexValuesRequest,
    HeaderRowRequest,
    SheetNamesRequest,
)
from app.services.excel_service import ExcelService
from app.utils import recursively_serialize_dict
from ..decorators.i18n_error_handler import i18n_error_handler

router = APIRouter(prefix="/excel", tags=["excel"])


@router.post("/preview", response_model=APIResponse)
@i18n_error_handler
async def preview_excel_data(request: Request, preview_request: PreviewRequest):
    """Preview Excel data from a file."""
    try:
        result = ExcelService.get_preview(file_path=preview_request.file_path)
        normalized_result = recursively_serialize_dict(result.dict())
        return APIResponse(success=True, data=normalized_result)
    except Exception as e:
        traceback.print_exc()
        # 装饰器会自动处理异常和本地化
        raise


@router.post("/index-values", response_model=APIResponse)
@i18n_error_handler
async def get_index_values_endpoint(request: Request, index_request: IndexValuesRequest):
    """Get unique values from specified columns as index."""
    try:
        response_data = ExcelService.get_index_values(
            file_path=index_request.file_path,
            sheet_name=index_request.sheet_name,
            header_row=index_request.header_row,
            column_name=index_request.column_name,
        )
        return APIResponse(success=True, data=response_data.dict())
    except Exception as e:
        traceback.print_exc()
        # 装饰器会自动处理异常和本地化
        raise


@router.post("/header-row", response_model=APIResponse)
@i18n_error_handler
async def try_read_header_row_endpoint(request: Request, header_request: HeaderRowRequest):
    """Try to read the header row from an Excel file."""
    try:
        response_data = ExcelService.read_header_row(
            file_path=header_request.file_path,
            sheet_name=header_request.sheet_name,
            header_row=header_request.header_row,
        )
        return APIResponse(success=True, data=response_data)
    except Exception as e:
        traceback.print_exc()
        # 装饰器会自动处理异常和本地化
        raise


@router.post("/sheet-names", response_model=APIResponse)
@i18n_error_handler
async def try_read_sheet_names_endpoint(request: Request, sheet_request: SheetNamesRequest):
    """Try to read the sheet names from an Excel file."""
    try:
        response_data = ExcelService.read_sheet_names(file_path=sheet_request.file_path)
        return APIResponse(success=True, data=response_data.dict())
    except Exception as e:
        traceback.print_exc()
        # 装饰器会自动处理异常和本地化
        raise
