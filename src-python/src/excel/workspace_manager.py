#!/usr/bin/env python3
"""
Workspace management module for handling workspace configurations.
"""

import hashlib
import os
import json
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
        self.workspace_dir = self.script_dir + "/" + "workspace"
        self.ensure_workspace_dir()

    def ensure_workspace_dir(self):
        """Ensure the workspace directory exists."""
        os.makedirs(self.workspace_dir, exist_ok=True)

    def list_workspaces(self) -> List[WorkspaceSummary]:
        """List all available workspaces."""
        workspaces = []

        try:
            for file_path in os.listdir(self.workspace_dir):
                if file_path.endswith(".json"):
                    try:
                        with open(
                            self.workspace_dir + "/" + file_path, "r", encoding="utf-8"
                        ) as f:
                            config = json.load(f)
                    except Exception as e:
                        # print(f"Warning: Invalid workspace file {file_path}: {e}")
                        continue

                    # Ensure the ID in the file matches the filename for consistency
                try:
                    workspace_id = file_path.split(".")[0]
                    if config.get("id") == workspace_id:
                        workspaces.append(
                            WorkspaceSummary(
                                id=config["id"],
                                name=config.get("name", f"Workspace {workspace_id}"),
                            )
                        )
                except (json.JSONDecodeError, KeyError) as e:
                    # print(f"Warning: Invalid workspace file {file_path}: {e}")
                    continue
                except Exception as e:
                    # print(f"Warning: Failed to load workspace file {file_path}: {e}")
                    continue
        except Exception as e:
            raise Exception(f"Failed to list workspaces: {str(e)}")

        return workspaces

    def load_workspace(self, workspace_id: str) -> Dict[str, Any]:
        """Load a workspace configuration by ID."""
        file_path = self.workspace_dir + "/" + workspace_id + ".json"

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Workspace file for ID '{workspace_id}' not found")

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                config = json.load(f)

            # Validate that the ID matches
            if config.get("id") != workspace_id:
                raise ValueError(
                    f"Workspace ID in file ({config.get('id')}) does not match requested ID ({workspace_id})"
                )

            return config
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in workspace file: {str(e)}")
        except Exception as e:
            raise Exception(f"Failed to load workspace: {str(e)}")

    def save_workspace(
        self, workspace_id: str, config_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Save a workspace configuration."""
        # Validate that the ID in config matches the workspace_id
        if config_data.get("id") != workspace_id:
            raise ValueError(
                f"Workspace ID in config ({config_data.get('id')}) does not match save ID ({workspace_id})"
            )

        file_path = self.workspace_dir + "/" + workspace_id + ".json"

        try:
            # Ensure the workspace directory exists
            self.ensure_workspace_dir()

            # Write the configuration to file
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(config_data, f, indent=2, ensure_ascii=False)

            return config_data
        except Exception as e:
            raise Exception(f"Failed to save workspace: {str(e)}")

    def delete_workspace(self, workspace_id: str) -> bool:
        """Delete a workspace configuration."""
        file_path = self.workspace_dir + "/" + workspace_id + ".json"

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Workspace file for ID '{workspace_id}' not found")

        try:
            os.remove(file_path)
            return True
        except Exception as e:
            raise Exception(f"Failed to delete workspace: {str(e)}")

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
