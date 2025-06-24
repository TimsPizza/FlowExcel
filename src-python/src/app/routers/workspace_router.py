"""
Workspace management API router.
Handles workspace CRUD operations including list, load, save, and delete.
"""

import json
import traceback
from fastapi import APIRouter, Request

from app.models import (
    APIResponse,
    SaveWorkspaceRequest,
    FileInfoRequest,
    FileInfoResponse,
)
from app.services.workspace_service import WorkspaceService
from app.utils import recursively_serialize_dict
from ..middleware.i18n_middleware import LocalizedAPIResponse
from ..decorators.i18n_error_handler import i18n_error_handler

router = APIRouter(prefix="/workspace", tags=["workspace"])


@router.get("/list", response_model=APIResponse)
@i18n_error_handler
async def list_workspaces(request: Request):
    """List all available workspaces."""
    try:
        response_data = WorkspaceService.list_workspaces()
        return APIResponse(success=True, data=response_data.dict())
    except Exception as e:
        traceback.print_exc()
        # 装饰器会自动处理异常和本地化
        raise


@router.get("/load/{workspace_id}", response_model=APIResponse)
@i18n_error_handler
async def load_workspace(workspace_id: str, request: Request):
    """Load a workspace configuration by ID."""
    try:
        workspace_config = WorkspaceService.load_workspace(workspace_id)
        return APIResponse(success=True, data=workspace_config)
    except FileNotFoundError as e:
        # 装饰器会自动使用 error.file_not_found
        raise
    except Exception as e:
        traceback.print_exc()
        # 装饰器会自动处理异常和本地化
        raise


@router.post("/save", response_model=APIResponse)
@i18n_error_handler
async def save_workspace(request: Request, save_request: SaveWorkspaceRequest):
    """Save a workspace configuration."""
    try:
        result = WorkspaceService.save_workspace(
            save_request.workspace_id, save_request.config_json
        )
        return APIResponse(success=True, data=result)
    except json.JSONDecodeError as e:
        # 装饰器会自动使用 error.invalid_json
        raise
    except Exception as e:
        traceback.print_exc()
        # 装饰器会自动处理异常和本地化
        raise


@router.delete("/delete/{workspace_id}", response_model=APIResponse)
@i18n_error_handler
async def delete_workspace(workspace_id: str, request: Request):
    """Delete a workspace configuration."""
    try:
        result = WorkspaceService.delete_workspace(workspace_id)
        return APIResponse(success=True, data={"deleted": result})
    except FileNotFoundError as e:
        # 装饰器会自动使用 error.file_not_found
        raise
    except Exception as e:
        traceback.print_exc()
        # 装饰器会自动处理异常和本地化
        raise


@router.post("/file-info", response_model=APIResponse)
@i18n_error_handler
async def get_file_info(request: Request, file_request: FileInfoRequest):
    try:
        file_path = file_request.file_path
        file_info = WorkspaceService.get_file_info(file_path)
        file_info_response = FileInfoResponse(file_info=file_info)
        serilized = recursively_serialize_dict(file_info_response.dict())
        return APIResponse(success=True, data=serilized)

    except FileNotFoundError as e:
        # 装饰器会自动使用 error.file_not_found
        raise
    except Exception as e:
        # 装饰器会自动处理异常和本地化
        raise
