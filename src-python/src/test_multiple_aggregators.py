import sys
import os
sys.path.append('src-python/src')
from pipeline import test_pipeline_node
import json

# 创建一个包含多个聚合节点的测试配置
test_config = {
    "files": [
        {
            "id": "test-file-1",
            "name": "test.xlsx",
            "path": "/Users/timspizza/code/python/excel/入库单.xlsx",
            "sheet_metas": [
                {"sheet_name": "产成品入库单列表", "header_row": 0}
            ]
        }
    ],
    "flow_nodes": [
        {
            "id": "index-1",
            "type": "indexSource",
            "data": {
                "nodeType": "indexSource",
                "sourceFileID": "test-file-1",
                "sheetName": "产成品入库单列表",
                "byColumn": True,
                "columnName": "规格型号"
            }
        },
        {
            "id": "sheet-1",
            "type": "sheetSelector",
            "data": {
                "nodeType": "sheetSelector",
                "targetFileID": "test-file-1",
                "mode": "manual",
                "manualSheetName": "产成品入库单列表"
            }
        },
        {
            "id": "agg-1",
            "type": "aggregator",
            "data": {
                "nodeType": "aggregator",
                "statColumn": "数量",
                "method": "sum"
            }
        },
        {
            "id": "agg-2", 
            "type": "aggregator",
            "data": {
                "nodeType": "aggregator",
                "statColumn": "数量",
                "method": "avg"
            }
        },
        {
            "id": "agg-3",
            "type": "aggregator", 
            "data": {
                "nodeType": "aggregator",
                "statColumn": "数量",
                "method": "count"
            }
        }
    ],
    "flow_edges": [
        {"source": "index-1", "target": "sheet-1"},
        {"source": "sheet-1", "target": "agg-1"},
        {"source": "agg-1", "target": "agg-2"},
        {"source": "agg-2", "target": "agg-3"}
    ]
}

print("测试多个聚合节点串联...")
print("=" * 50)

# 测试执行到第一个聚合节点
print("\n1. 测试执行到 agg-1:")
result1 = test_pipeline_node(json.dumps(test_config), "agg-1")
print(f"返回的节点数量: {len(result1.get('results', {}))}")
print(f"节点ID列表: {list(result1.get('results', {}).keys())}")

# 测试执行到第二个聚合节点
print("\n2. 测试执行到 agg-2:")
result2 = test_pipeline_node(json.dumps(test_config), "agg-2")
print(f"返回的节点数量: {len(result2.get('results', {}))}")
print(f"节点ID列表: {list(result2.get('results', {}).keys())}")

# 测试执行到第三个聚合节点
print("\n3. 测试执行到 agg-3:")
result3 = test_pipeline_node(json.dumps(test_config), "agg-3")
print(f"返回的节点数量: {len(result3.get('results', {}))}")
print(f"节点ID列表: {list(result3.get('results', {}).keys())}")

print("\n预期结果:")
print("agg-1: 只有 agg-1")
print("agg-2: 有 agg-1 和 agg-2")
print("agg-3: 有 agg-1, agg-2 和 agg-3") 