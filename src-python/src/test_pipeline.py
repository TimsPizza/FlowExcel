#!/usr/bin/env python3
"""
测试Pipeline执行功能的脚本
"""

import json
import sys
import os

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(__file__))

from pipeline import execute_pipeline, test_pipeline_node

def test_with_sample_data():
    """使用示例数据测试pipeline"""
    
    # 简化的测试数据，模拟用户提供的JSON结构
    test_data = {
        "files": [
            {
                "id": "file1",
                "name": "test.xlsx",
                "path": "/path/to/test.xlsx",  # 这里需要一个真实的Excel文件路径
                "sheet_metas": [
                    {"sheet_name": "Sheet1", "header_row": 0}
                ]
            }
        ],
        "flow_nodes": [
            {
                "id": "node1",
                "type": "indexSource",
                "data": {
                    "nodeType": "indexSource",
                    "sourceFileID": "file1",
                    "sheetName": "Sheet1",
                    "columnName": "Category",
                    "byColumn": True
                }
            }
        ],
        "flow_edges": []
    }
    
    try:
        # 测试执行
        pipeline_json = json.dumps(test_data)
        result = execute_pipeline(pipeline_json)
        
        print("Pipeline execution result:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        # 测试单节点
        node_result = test_pipeline_node(pipeline_json, "node1")
        print("\nSingle node test result:")
        print(json.dumps(node_result, indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("Testing Pipeline execution...")
    test_with_sample_data() 