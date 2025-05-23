#!/usr/bin/env python3
"""
集成测试脚本 - 测试新的pipeline API
"""

import json
import sys
import os

# 添加src目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from pipeline import execute_pipeline, test_pipeline_node

def test_simple_pipeline():
    """测试一个简单的pipeline"""
    
    # 构造测试数据
    test_pipeline = {
        "id": "test-workspace",
        "name": "Test Workspace",
        "files": [
            {
                "id": "file1",
                "name": "test.xlsx",
                "path": "/path/to/test.xlsx",
                "sheet_metas": [
                    {
                        "sheet_name": "Sheet1",
                        "header_row": 0
                    }
                ]
            }
        ],
        "flow_nodes": [
            {
                "id": "node1",
                "type": "indexSource",
                "position": {"x": 100, "y": 100},
                "data": {
                    "id": "node1",
                    "nodeType": "indexSource",
                    "label": "索引源",
                    "sourceFileID": "file1",
                    "bySheetName": False,
                    "sheetName": "Sheet1",
                    "byColumn": True,
                    "columnName": "类型"
                }
            },
            {
                "id": "node2",
                "type": "output",
                "position": {"x": 300, "y": 100},
                "data": {
                    "id": "node2",
                    "nodeType": "output",
                    "label": "输出",
                    "outputFormat": "table"
                }
            }
        ],
        "flow_edges": [
            {
                "id": "edge1",
                "source": "node1",
                "target": "node2"
            }
        ]
    }
    
    print("测试execute_pipeline...")
    try:
        result = execute_pipeline(json.dumps(test_pipeline))
        print("execute_pipeline结果:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        print()
    except Exception as e:
        print(f"execute_pipeline失败: {e}")
        print()
    
    print("测试test_pipeline_node...")
    try:
        result = test_pipeline_node(json.dumps(test_pipeline), "node1")
        print("test_pipeline_node结果:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        print()
    except Exception as e:
        print(f"test_pipeline_node失败: {e}")
        print()

if __name__ == "__main__":
    test_simple_pipeline() 