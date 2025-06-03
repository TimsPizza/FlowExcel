"""
Workspace management API router.
Handles workspace CRUD operations including list, load, save, and delete.
"""

import json
import traceback
from fastapi import APIRouter

from app.models import (
    APIResponse,
    SaveWorkspaceRequest,
)
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/workspace", tags=["workspace"])


@router.get("/list", response_model=APIResponse)
async def list_workspaces():
    """List all available workspaces."""
    try:
        response_data = WorkspaceService.list_workspaces()
        return APIResponse(success=True, data=response_data.dict())
    except Exception as e:
        error_msg = f"Error listing workspaces: {str(e)}"
        traceback.print_exc()
        return APIResponse(success=False, error=error_msg)


@router.get("/load/{workspace_id}", response_model=APIResponse)
async def load_workspace(workspace_id: str):
    """Load a workspace configuration by ID."""
    try:
        workspace_config = WorkspaceService.load_workspace(workspace_id)
        return APIResponse(success=True, data=workspace_config)
    except FileNotFoundError as e:
        return APIResponse(success=False, error=str(e))
    except Exception as e:
        error_msg = f"Error loading workspace: {str(e)}"
        traceback.print_exc()
        return APIResponse(success=False, error=error_msg)


@router.post("/save", response_model=APIResponse)
async def save_workspace(request: SaveWorkspaceRequest):
    """Save a workspace configuration."""
    try:
        result = WorkspaceService.save_workspace(request.workspace_id, request.config_json)
        return APIResponse(success=True, data=result)
    except json.JSONDecodeError as e:
        return APIResponse(success=False, error=f"Invalid workspace configuration JSON: {str(e)}")
    except Exception as e:
        error_msg = f"Error saving workspace: {str(e)}"
        traceback.print_exc()
        return APIResponse(success=False, error=error_msg)


@router.delete("/delete/{workspace_id}", response_model=APIResponse)
async def delete_workspace(workspace_id: str):
    """Delete a workspace configuration."""
    try:
        result = WorkspaceService.delete_workspace(workspace_id)
        return APIResponse(success=True, data={"deleted": result})
    except FileNotFoundError as e:
        return APIResponse(success=False, error=str(e))
    except Exception as e:
        error_msg = f"Error deleting workspace: {str(e)}"
        traceback.print_exc()
        return APIResponse(success=False, error=error_msg) 