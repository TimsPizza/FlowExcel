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
    FileInfo,
    ImportWorkspaceResponse,
    GetWorkspaceFilesPathResponse,
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
    
    @staticmethod
    def get_file_info(file_path: str) -> FileInfo:
        """Get the hash of a file."""
        return workspace_manager.get_file_info(file_path)
    
    @staticmethod
    def export_workspace(workspace_id: str, export_path: str) -> bool:
        """导出工作区为ZIP文件"""
        return workspace_manager.export_workspace(workspace_id, export_path)
    
    @staticmethod
    def import_workspace(zip_path: str, new_workspace_id: str = None) -> ImportWorkspaceResponse:
        """从ZIP导入工作区"""
        workspace_id = workspace_manager.import_workspace(zip_path, new_workspace_id)
        return ImportWorkspaceResponse(workspace_id=workspace_id)
    
    @staticmethod
    def get_workspace_files_path(workspace_id: str) -> GetWorkspaceFilesPathResponse:
        """获取工作区files目录路径"""
        files_path = workspace_manager.get_workspace_files_path_str(workspace_id)
        return GetWorkspaceFilesPathResponse(files_path=files_path)