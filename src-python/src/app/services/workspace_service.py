"""
Workspace management service.
Encapsulates business logic for workspace operations.
"""

import json
from typing import Any, Dict, List
from excel.workspace_manager import workspace_manager
from app.models import (
    WorkspaceInfo,
    WorkspaceListResponse,
)


class WorkspaceService:
    """Service class for workspace operations."""
    
    @staticmethod
    def list_workspaces() -> WorkspaceListResponse:
        """List all available workspaces."""
        workspaces = workspace_manager.list_workspaces()
        workspace_list = [WorkspaceInfo(id=ws.id, name=ws.name) for ws in workspaces]
        return WorkspaceListResponse(workspaces=workspace_list)
    
    @staticmethod
    def load_workspace(workspace_id: str) -> Dict[str, Any]:
        """Load a workspace configuration by ID."""
        return workspace_manager.load_workspace(workspace_id)
    
    @staticmethod
    def save_workspace(workspace_id: str, config_json: str) -> Dict[str, Any]:
        """Save a workspace configuration."""
        config_data = json.loads(config_json)
        return workspace_manager.save_workspace(workspace_id, config_data)
    
    @staticmethod
    def delete_workspace(workspace_id: str) -> bool:
        """Delete a workspace configuration."""
        return workspace_manager.delete_workspace(workspace_id) 