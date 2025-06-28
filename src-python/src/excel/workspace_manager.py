#!/usr/bin/env python3
"""
Workspace management module for handling workspace configurations.
"""

import hashlib
import os
import json
import shutil
import zipfile
import uuid
from typing import List, Dict, Any, Optional
from pathlib import Path
from pydantic import BaseModel
from config import APP_ROOT_DIR
from app.models import FileInfo, FileInfoResponse


class WorkspaceSummary(BaseModel):
    id: str
    name: str


class WorkspaceManager:
    def __init__(self):
        # Get the workspace directory relative to the Python script location
        self.script_dir = APP_ROOT_DIR
        self.workspace_dir = Path(self.script_dir) / "workspace"
        self.ensure_workspace_dir()

    def ensure_workspace_dir(self):
        """Ensure the workspace directory exists."""
        self.workspace_dir.mkdir(parents=True, exist_ok=True)

    def get_workspace_path(self, workspace_id: str) -> Path:
        """获取工作区目录路径"""
        return self.workspace_dir / workspace_id
    
    def get_workspace_files_path(self, workspace_id: str) -> Path:
        """获取工作区文件目录路径"""
        return self.get_workspace_path(workspace_id) / "files"
    
    def ensure_workspace_structure(self, workspace_id: str) -> tuple[Path, Path]:
        """确保工作区目录结构存在"""
        workspace_path = self.get_workspace_path(workspace_id)
        files_path = self.get_workspace_files_path(workspace_id)
        
        workspace_path.mkdir(parents=True, exist_ok=True)
        files_path.mkdir(parents=True, exist_ok=True)
        
        return workspace_path, files_path

    def list_workspaces(self) -> List[WorkspaceSummary]:
        """List all available workspaces."""
        workspaces = []

        try:
            # 检查新格式（目录结构）
            for item in self.workspace_dir.iterdir():
                if item.is_dir():
                    config_file = item / "workspace.json"
                    if config_file.exists():
                        try:
                            with open(config_file, "r", encoding="utf-8") as f:
                                config = json.load(f)
                            
                            workspace_id = item.name
                            if config.get("id") == workspace_id:
                                workspaces.append(
                                    WorkspaceSummary(
                                        id=config["id"],
                                        name=config.get("name", f"Workspace {workspace_id}"),
                                    )
                                )
                        except (json.JSONDecodeError, KeyError) as e:
                            continue
                        except Exception as e:
                            continue
            
            # 检查旧格式（.json文件）- 向后兼容
            for file_path in self.workspace_dir.glob("*.json"):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        config = json.load(f)
                    
                    workspace_id = file_path.stem
                    if config.get("id") == workspace_id:
                        # 检查是否已经在新格式中存在
                        if not any(ws.id == workspace_id for ws in workspaces):
                            workspaces.append(
                                WorkspaceSummary(
                                    id=config["id"],
                                    name=config.get("name", f"Workspace {workspace_id}"),
                                )
                            )
                except (json.JSONDecodeError, KeyError) as e:
                    continue
                except Exception as e:
                    continue
                    
        except Exception as e:
            raise Exception(f"Failed to list workspaces: {str(e)}")

        return workspaces

    def load_workspace(self, workspace_id: str) -> Dict[str, Any]:
        """Load a workspace configuration by ID."""
        # 优先检查新格式
        new_format_path = self.get_workspace_path(workspace_id) / "workspace.json"
        if new_format_path.exists():
            return self._load_new_format_workspace(workspace_id)
        
        # 回退到旧格式
        old_format_path = self.workspace_dir / f"{workspace_id}.json"
        if old_format_path.exists():
            return self._load_old_format_workspace(workspace_id)
        
        raise FileNotFoundError(f"Workspace '{workspace_id}' not found")

    def _load_new_format_workspace(self, workspace_id: str) -> Dict[str, Any]:
        """加载新格式工作区配置"""
        config_file = self.get_workspace_path(workspace_id) / "workspace.json"
        
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                config = json.load(f)

            # 验证ID匹配
            if config.get("id") != workspace_id:
                raise ValueError(
                    f"Workspace ID in file ({config.get('id')}) does not match requested ID ({workspace_id})"
                )

            # 新格式中文件路径已经是绝对路径，直接返回
            return config
            
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in workspace file: {str(e)}")
        except Exception as e:
            raise Exception(f"Failed to load workspace: {str(e)}")

    def _load_old_format_workspace(self, workspace_id: str) -> Dict[str, Any]:
        """加载旧格式工作区配置（向后兼容）"""
        file_path = self.workspace_dir / f"{workspace_id}.json"

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                config = json.load(f)

            # 验证ID匹配
            if config.get("id") != workspace_id:
                raise ValueError(
                    f"Workspace ID in file ({config.get('id')}) does not match requested ID ({workspace_id})"
                )

            return config
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in workspace file: {str(e)}")
        except Exception as e:
            raise Exception(f"Failed to load workspace: {str(e)}")

    def save_workspace(self, workspace_id: str, config_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save a workspace configuration with file management."""
        # 验证ID匹配
        if config_data.get("id") != workspace_id:
            raise ValueError(
                f"Workspace ID in config ({config_data.get('id')}) does not match save ID ({workspace_id})"
            )

        try:
            # 确保工作区目录结构存在
            workspace_path, files_path = self.ensure_workspace_structure(workspace_id)

            # 处理文件：复制到工作区目录
            updated_config = config_data.copy()
            for file_meta in updated_config.get("files", []):
                source_path = Path(file_meta["path"])
                target_path = files_path / source_path.name
                
                # 如果文件不在工作区内，复制过来
                if not target_path.exists() or target_path.resolve() != source_path.resolve():
                    if source_path.exists():
                        shutil.copy2(source_path, target_path)
                        file_meta["path"] = str(target_path.resolve())

            # 保存配置文件到新格式位置
            config_file = workspace_path / "workspace.json"
            with open(config_file, "w", encoding="utf-8") as f:
                json.dump(updated_config, f, indent=2, ensure_ascii=False)

            # 删除旧格式文件（如果存在）
            old_format_file = self.workspace_dir / f"{workspace_id}.json"
            if old_format_file.exists():
                old_format_file.unlink()

            return updated_config
        except Exception as e:
            raise Exception(f"Failed to save workspace: {str(e)}")

    def export_workspace(self, workspace_id: str, export_path: str) -> bool:
        """导出工作区为ZIP文件"""
        workspace_path = self.get_workspace_path(workspace_id)
        
        if not workspace_path.exists():
            raise FileNotFoundError(f"Workspace '{workspace_id}' not found")
        
        try:
            with zipfile.ZipFile(export_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file_path in workspace_path.rglob('*'):
                    if file_path.is_file():
                        # 保持相对目录结构
                        arcname = file_path.relative_to(workspace_path)
                        zipf.write(file_path, arcname)
            
            return True
        except Exception as e:
            raise Exception(f"Failed to export workspace: {str(e)}")

    def import_workspace(self, zip_path: str, new_workspace_id: str = None) -> str:
        """从ZIP导入工作区"""
        if not new_workspace_id:
            new_workspace_id = str(uuid.uuid4())
        
        zip_path = Path(zip_path)
        if not zip_path.exists():
            raise FileNotFoundError(f"ZIP file '{zip_path}' not found")
        
        try:
            workspace_path = self.get_workspace_path(new_workspace_id)
            
            # 解压ZIP文件
            with zipfile.ZipFile(zip_path, 'r') as zipf:
                zipf.extractall(workspace_path)
            
            # 更新配置文件
            config_file = workspace_path / "workspace.json"
            if config_file.exists():
                with open(config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                
                # 重新映射文件路径为当前环境的绝对路径
                for file_meta in config.get("files", []):
                    filename = Path(file_meta["path"]).name
                    new_path = workspace_path / "files" / filename
                    file_meta["path"] = str(new_path.resolve())
                
                # 更新workspace ID
                config["id"] = new_workspace_id
                
                # 保存更新后的配置
                with open(config_file, 'w', encoding='utf-8') as f:
                    json.dump(config, f, indent=2, ensure_ascii=False)
            
            return new_workspace_id
            
        except Exception as e:
            raise Exception(f"Failed to import workspace: {str(e)}")

    def get_workspace_files_path_str(self, workspace_id: str) -> str:
        """获取工作区files目录的字符串路径（用于前端调用）"""
        files_path = self.get_workspace_files_path(workspace_id)
        return str(files_path.resolve())

    def delete_workspace(self, workspace_id: str) -> bool:
        """Delete a workspace configuration."""
        # 删除新格式目录
        new_format_path = self.get_workspace_path(workspace_id)
        if new_format_path.exists():
            shutil.rmtree(new_format_path)
            return True
        
        # 删除旧格式文件
        old_format_path = self.workspace_dir / f"{workspace_id}.json"
        if old_format_path.exists():
            old_format_path.unlink()
            return True
        
        raise FileNotFoundError(f"Workspace '{workspace_id}' not found")

    @staticmethod
    def light_hash(path: str, head: int = 1024, tail: int = 1024) -> str:
        size = os.path.getsize(path)
        with open(path, "rb") as f:
            start = f.read(head)
            if size > tail:
                f.seek(-tail, os.SEEK_END)
                end = f.read(tail)
            else:
                end = b""
        return hashlib.md5(start + end).hexdigest()

    def get_file_info(self, file_path: str) -> FileInfo:
        """Get the hash of a file."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        file_info = FileInfo(
            last_modified=os.path.getmtime(file_path),
            file_size=os.path.getsize(file_path),
            file_hash=WorkspaceManager.light_hash(file_path),
        )
        return file_info


# Global workspace manager instance
workspace_manager = WorkspaceManager()
