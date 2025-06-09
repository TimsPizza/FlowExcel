import os
import sys

def resource_path(relative_path: str) -> str:
    """
    Get absolute path to resource, works for dev and for PyInstaller's onedir mode.
    """
    if getattr(sys, 'frozen', False):
        # We are running in a bundle (packaged by PyInstaller)
        # sys.executable is the path to the executable.
        base_path = os.path.dirname(sys.executable)
    else:
        # We are running in a normal Python environment (development)
        # This assumes the script is in src-python/src/app
        base_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

    return os.path.join(base_path, relative_path)

"""
工作区配置转换工具
处理前端工作区配置到pipeline系统类型的转换
"""

import os
import sys
from typing import Dict, Any, Optional
from dataclasses import asdict
import json
import pandas as pd
import datetime
import numpy as np

from pipeline.models import (
    WorkspaceConfig, FileInfo, BaseNode, Edge, NodeType, ExecutionMode,
    ExecutePipelineRequest
)


def convert_workspace_config_from_json(workspace_data: Dict[str, Any]) -> WorkspaceConfig:
    """
    将前端JSON格式的工作区配置转换为pipeline系统的WorkspaceConfig
    
    Args:
        workspace_data: 前端工作区配置字典
        
    Returns:
        转换后的WorkspaceConfig对象
    """
    # 转换文件信息
    files = []
    for file_data in workspace_data.get("files", []):
        file_info = FileInfo(
            id=file_data["id"],
            name=file_data.get("name", file_data.get("alias", "")),
            path=file_data["path"],
            sheet_metas=file_data.get("sheet_metas", [])
        )
        files.append(file_info)
    
    # 转换节点信息
    flow_nodes = []
    for node_data in workspace_data.get("flow_nodes", []):
        # 将前端节点类型转换为NodeType枚举
        node_type_str = node_data.get("type") or node_data.get("data", {}).get("nodeType")
        
        node_type_mapping = {
            "indexSource": NodeType.INDEX_SOURCE,
            "sheetSelector": NodeType.SHEET_SELECTOR,
            "rowFilter": NodeType.ROW_FILTER,
            "rowLookup": NodeType.ROW_LOOKUP,
            "aggregator": NodeType.AGGREGATOR,
            "output": NodeType.OUTPUT,
        }
        
        node_type = node_type_mapping.get(node_type_str, NodeType.INDEX_SOURCE)
        
        base_node = BaseNode(
            id=node_data["id"],
            type=node_type,
            data=node_data.get("data", {})
        )
        flow_nodes.append(base_node)
    
    # 转换边信息
    flow_edges = []
    for edge_data in workspace_data.get("flow_edges", []):
        edge = Edge(
            source=edge_data["source"],
            target=edge_data["target"]
        )
        flow_edges.append(edge)
    
    return WorkspaceConfig(
        id=workspace_data["id"],
        name=workspace_data["name"],
        files=files,
        flow_nodes=flow_nodes,
        flow_edges=flow_edges
    )


def create_execute_pipeline_request(
    workspace_config: WorkspaceConfig,
    target_node_id: str,
    execution_mode: str = "production",
    test_mode_max_rows: int = 100,
) -> ExecutePipelineRequest:
    """
    创建pipeline执行请求
    
    Args:
        workspace_config: 工作区配置
        target_node_id: 目标节点ID
        execution_mode: 执行模式字符串
        test_mode_max_rows: 测试模式最大行数
        
    Returns:
        ExecutePipelineRequest对象
    """
    # 转换执行模式
    exec_mode = ExecutionMode.TEST if execution_mode.lower() == "test" else ExecutionMode.PRODUCTION
    
    return ExecutePipelineRequest(
        workspace_config=workspace_config,
        target_node_id=target_node_id,
        execution_mode=exec_mode,
        test_mode_max_rows=test_mode_max_rows,
    ) 
    



def serialize_value(obj):
    """Serializes a single value, handling special types."""
    if isinstance(obj, (datetime.datetime, pd.Timestamp)):
        return obj.isoformat()
    if isinstance(obj, (float, np.floating)):
        if np.isnan(obj) or np.isinf(obj):
            return None  # Convert NaN and Infinity to null
        return float(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    # 处理字符串编码问题，特别是Windows系统
    if isinstance(obj, str):
        try:
            # 确保字符串可以正确编码
            obj.encode('utf-8')
            return obj
        except UnicodeEncodeError:
            # 如果包含无法编码的字符，则使用安全的替换
            return obj.encode('utf-8', errors='replace').decode('utf-8')
    return obj


def recursively_serialize_dict(data):
    """Recursively traverses a dict/list structure and applies serialize_value."""
    if isinstance(data, dict):
        return {k: recursively_serialize_dict(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [recursively_serialize_dict(item) for item in data]
    else:
        return serialize_value(data)


def normalize_response(data) -> str:
    # This might need adjustment if 'data' is not already a dict
    # Assuming 'data' is a Pydantic model or dataclass
    if hasattr(data, "dict"):  # Pydantic V1
        data_dict = data.dict()
    elif hasattr(data, "model_dump"):  # Pydantic V2
        data_dict = data.model_dump()
    elif hasattr(data, "__dict__"):  # Basic object
        data_dict = data.__dict__
    elif isinstance(data, dict):
        data_dict = data
    else:
        # Cannot convert to dict easily, try direct serialization
        # This path might fail if data contains unserializable types
        try:
            return json.dumps(
                data, ensure_ascii=False, indent=2, default=serialize_value
            )
        except TypeError:
            raise TypeError(
                f"Cannot automatically serialize type {type(data)}. Convert to dict first."
            )

    serialized_dict = recursively_serialize_dict(data_dict)
    return json.dumps(serialized_dict, ensure_ascii=False, indent=2, allow_nan=False)
