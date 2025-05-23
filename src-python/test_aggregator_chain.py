#!/usr/bin/env python3

import json
import sys
import os

# 添加src目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from pipeline.processor import PipelineExecutor
from pipeline.models import NodeType

def test_aggregator_chain():
    """测试多个统计节点串联的情况"""
    
    # 创建测试数据
    test_data = {
        "files": [
            {
                "id": "test_file_1",
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
                "id": "index_source_1",
                "type": NodeType.INDEX_SOURCE,
                "data": {
                    "sourceFileID": "test_file_1",
                    "sheetName": "Sheet1", 
                    "columnName": "型号",
                    "byColumn": True
                }
            },
            {
                "id": "sheet_selector_1", 
                "type": NodeType.SHEET_SELECTOR,
                "data": {
                    "targetFileID": "test_file_1",
                    "mode": "auto_by_index"
                }
            },
            {
                "id": "aggregator_1",
                "type": NodeType.AGGREGATOR,
                "data": {
                    "statColumn": "废料重量",
                    "method": "sum",
                    "outputAs": "总废料重量"
                }
            },
            {
                "id": "aggregator_2",
                "type": NodeType.AGGREGATOR, 
                "data": {
                    "statColumn": "数量",
                    "method": "count",
                    "outputAs": "总数量"
                }
            }
        ],
        "flow_edges": [
            {"source": "index_source_1", "target": "sheet_selector_1"},
            {"source": "sheet_selector_1", "target": "aggregator_1"},
            {"source": "aggregator_1", "target": "aggregator_2"}
        ]
    }
    
    # 执行测试
    executor = PipelineExecutor()
    
    print("测试第一个聚合节点:")
    result1 = executor.execute(test_data, target_node_id="aggregator_1")
    print(f"Success: {result1.success}")
    if result1.success:
        print(f"Results keys: {list(result1.results.keys())}")
        if "aggregator_1" in result1.results:
            for i, result in enumerate(result1.results["aggregator_1"]):
                print(f"  Result {i}: {result.result_data}")
    else:
        print(f"Error: {result1.error}")
    
    print("\n测试第二个聚合节点:")
    result2 = executor.execute(test_data, target_node_id="aggregator_2")
    print(f"Success: {result2.success}")
    if result2.success:
        print(f"Results keys: {list(result2.results.keys())}")
        if "aggregator_2" in result2.results:
            for i, result in enumerate(result2.results["aggregator_2"]):
                print(f"  Result {i}: {result.result_data}")
    else:
        print(f"Error: {result2.error}")

if __name__ == "__main__":
    test_aggregator_chain() 