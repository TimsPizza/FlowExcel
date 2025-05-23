#!/usr/bin/env python3
"""
使用真实JSON数据测试Pipeline执行功能
"""

import json
import sys
import os

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(__file__))

from pipeline import execute_pipeline, test_pipeline_node

# 用户提供的实际JSON数据
REAL_DATA = {
    "id": "17b43160-7c47-44b0-9129-d05eb392f03b",
    "name": "测试",
    "files": [
        {
            "id": "20392f90-e260-4ecb-8ad6-39df4edac192",
            "name": "弹条生产记录.xlsx",
            "path": "/Users/timspizza/code/python/excel/弹条生产记录.xlsx",
            "sheet_metas": [
                {"sheet_name": "W1型", "header_row": 1},
                {"sheet_name": "Ⅲ型", "header_row": 1},
                {"sheet_name": "Ⅱ", "header_row": 1},
                {"sheet_name": "A型", "header_row": 1},
                {"sheet_name": "大Ⅱ型", "header_row": 1},
                {"sheet_name": "DI型", "header_row": 1},
                {"sheet_name": "小II型", "header_row": 1},
                {"sheet_name": "B型", "header_row": 1},
                {"sheet_name": "X3", "header_row": 1},
                {"sheet_name": "A3", "header_row": 1},
                {"sheet_name": "小II", "header_row": 1},
                {"sheet_name": "X2", "header_row": 1},
                {"sheet_name": "W4型", "header_row": 1},
                {"sheet_name": "FW4", "header_row": 1},
                {"sheet_name": "W2型", "header_row": 1},
                {"sheet_name": "C4型", "header_row": 1},
                {"sheet_name": "DZIII", "header_row": 1},
                {"sheet_name": "PR单趾", "header_row": 1},
                {"sheet_name": "小阻力", "header_row": 1},
                {"sheet_name": "WJ-2", "header_row": 1},
                {"sheet_name": "WJ-5 G型", "header_row": 1},
            ],
        },
        {
            "id": "9a80ba61-2a90-4e57-82d4-715710dd230b",
            "name": "入库单.xlsx",
            "path": "/Users/timspizza/code/python/excel/入库单.xlsx",
            "sheet_metas": [{"sheet_name": "产成品入库单列表", "header_row": 0}],
        },
        {
            "id": "45693368-86c1-43b4-9af2-91224183ed7d",
            "name": "在制品.XLSX",
            "path": "/Users/timspizza/code/python/excel/在制品.XLSX",
            "sheet_metas": [{"sheet_name": "sheet1", "header_row": 0}],
        },
        {
            "id": "d575fa71-c867-4a12-b910-b6342e2583ed",
            "name": "出库单.XLS",
            "path": "/Users/timspizza/code/python/excel/出库单.XLS",
            "sheet_metas": [{"sheet_name": "sheet1", "header_row": 3}],
        },
    ],
    "flow_nodes": [
        {
            "id": "8b94edb5-2d85-48fa-92dd-5787f2e11389",
            "type": "indexSource",
            "position": {"x": 254.7516965741935, "y": -545.7272099200771},
            "data": {
                "nodeType": "indexSource",
                "id": "8b94edb5-2d85-48fa-92dd-5787f2e11389",
                "label": "索引源",
                "sourceFileID": "9a80ba61-2a90-4e57-82d4-715710dd230b",
                "bySheetName": "False",
                "sheetName": "产成品入库单列表",
                "byColumn": "True",
                "columnName": "规格型号",
            },
        },
        {
            "id": "99484f15-46fb-4151-a28d-62c320233432",
            "type": "sheetSelector",
            "position": {"x": 256.6537355412845, "y": -483.17323833733775},
            "data": {
                "nodeType": "sheetSelector",
                "id": "99484f15-46fb-4151-a28d-62c320233432",
                "label": "Sheet定位",
                "targetFileID": "20392f90-e260-4ecb-8ad6-39df4edac192",
                "mode": "auto_by_index",
            },
        },
        {
            "id": "3e42efdb-4f0c-4287-b816-b7b8d8dc1f32",
            "type": "aggregator",
            "position": {"x": 233.4395831278567, "y": -417.06147969816146},
            "data": {
                "nodeType": "aggregator",
                "id": "3e42efdb-4f0c-4287-b816-b7b8d8dc1f32",
                "label": "统计",
                "statColumn": "成品报废",
                "method": "sum",
            },
        },
        {
            "id": "26dbc186-3cf5-4f80-9cc1-44d36d845b58",
            "type": "output",
            "position": {"x": 233.1552687071458, "y": -262.31458670260395},
            "data": {
                "nodeType": "output",
                "id": "26dbc186-3cf5-4f80-9cc1-44d36d845b58",
                "label": "输出",
                "outputFormat": "excel",
            },
        },
        {
            "id": "1ed5bc4b-a1d6-4701-aef3-0c34d68adcfb",
            "type": "indexSource",
            "position": {"x": -99.194693710052, "y": -557.9023143440066},
            "data": {
                "nodeType": "indexSource",
                "id": "1ed5bc4b-a1d6-4701-aef3-0c34d68adcfb",
                "label": "索引源",
                "sourceFileID": "d575fa71-c867-4a12-b910-b6342e2583ed",
                "bySheetName": "False",
                "sheetName": "sheet1",
                "byColumn": "True",
                "columnName": "制单人",
            },
        },
        {
            "id": "21e3054f-0231-4d92-b820-30fba4ecd80c",
            "type": "sheetSelector",
            "position": {"x": -94.56448899814356, "y": -473.25781485200105},
            "data": {
                "nodeType": "sheetSelector",
                "id": "21e3054f-0231-4d92-b820-30fba4ecd80c",
                "label": "Sheet定位",
                "targetFileID": "20392f90-e260-4ecb-8ad6-39df4edac192",
                "mode": "manual",
                "manualSheetName": "W1型",
            },
        },
        {
            "id": "533ca2d3-2536-465e-a542-dac89b9faf53",
            "type": "aggregator",
            "position": {"x": -86.0947973583117, "y": -333.254769875719},
            "data": {
                "nodeType": "aggregator",
                "id": "533ca2d3-2536-465e-a542-dac89b9faf53",
                "label": "统计",
                "statColumn": "金额",
                "method": "sum",
            },
        },
        {
            "id": "f2ea4ffc-b96d-42fd-b10c-8f178e0ea21e",
            "type": "aggregator",
            "position": {"x": 221.45676478854867, "y": -350.8646668021156},
            "data": {
                "nodeType": "aggregator",
                "id": "f2ea4ffc-b96d-42fd-b10c-8f178e0ea21e",
                "label": "平均",
                "statColumn": "回火报废",
                "method": "avg",
            },
        },
        {
            "id": "22d6a30d-37fe-4a66-9f4f-0056e71143b5",
            "type": "rowLookup",
            "position": {"x": -94.64233272099244, "y": -401.9446308611866},
            "data": {
                "nodeType": "rowLookup",
                "id": "22d6a30d-37fe-4a66-9f4f-0056e71143b5",
                "label": "行查找/列匹配",
                "matchColumn": "制单人",
            },
        },
    ],
    "flow_edges": [
        {
            "id": "edge-8b94edb5-2d85-48fa-92dd-5787f2e11389-99484f15-46fb-4151-a28d-62c320233432-1747776278216",
            "source": "8b94edb5-2d85-48fa-92dd-5787f2e11389",
            "target": "99484f15-46fb-4151-a28d-62c320233432",
        },
        {
            "id": "edge-1ed5bc4b-a1d6-4701-aef3-0c34d68adcfb-21e3054f-0231-4d92-b820-30fba4ecd80c-1747790186689",
            "source": "1ed5bc4b-a1d6-4701-aef3-0c34d68adcfb",
            "target": "21e3054f-0231-4d92-b820-30fba4ecd80c",
        },
        {
            "id": "edge-533ca2d3-2536-465e-a542-dac89b9faf53-26dbc186-3cf5-4f80-9cc1-44d36d845b58-1747790287457",
            "source": "533ca2d3-2536-465e-a542-dac89b9faf53",
            "target": "26dbc186-3cf5-4f80-9cc1-44d36d845b58",
        },
        {
            "id": "edge-3e42efdb-4f0c-4287-b816-b7b8d8dc1f32-f2ea4ffc-b96d-42fd-b10c-8f178e0ea21e-1747796682798",
            "source": "3e42efdb-4f0c-4287-b816-b7b8d8dc1f32",
            "target": "f2ea4ffc-b96d-42fd-b10c-8f178e0ea21e",
        },
        {
            "id": "edge-f2ea4ffc-b96d-42fd-b10c-8f178e0ea21e-26dbc186-3cf5-4f80-9cc1-44d36d845b58-1747796692584",
            "source": "f2ea4ffc-b96d-42fd-b10c-8f178e0ea21e",
            "target": "26dbc186-3cf5-4f80-9cc1-44d36d845b58",
        },
        {
            "id": "edge-21e3054f-0231-4d92-b820-30fba4ecd80c-22d6a30d-37fe-4a66-9f4f-0056e71143b5-1747978855623",
            "source": "21e3054f-0231-4d92-b820-30fba4ecd80c",
            "target": "22d6a30d-37fe-4a66-9f4f-0056e71143b5",
        },
        {
            "id": "edge-22d6a30d-37fe-4a66-9f4f-0056e71143b5-533ca2d3-2536-465e-a542-dac89b9faf53-1747978857983",
            "source": "22d6a30d-37fe-4a66-9f4f-0056e71143b5",
            "target": "533ca2d3-2536-465e-a542-dac89b9faf53",
        },
        {
            "id": "edge-99484f15-46fb-4151-a28d-62c320233432-3e42efdb-4f0c-4287-b816-b7b8d8dc1f32-1747978995282",
            "source": "99484f15-46fb-4151-a28d-62c320233432",
            "target": "3e42efdb-4f0c-4287-b816-b7b8d8dc1f32",
        },
    ],
}


def test_index_source_node():
    """测试索引源节点"""
    print("=== 测试索引源节点 ===")

    try:
        pipeline_json = json.dumps(REAL_DATA)
        result = test_pipeline_node(
            pipeline_json, "8b94edb5-2d85-48fa-92dd-5787f2e11389"
        )

        print("索引源节点测试结果:")
        print(json.dumps(result, indent=2, ensure_ascii=False))

    except Exception as e:
        print(f"索引源节点测试失败: {e}")
        import traceback

        traceback.print_exc()


def test_sheet_selector_node():
    """测试Sheet定位节点"""
    print("\n=== 测试Sheet定位节点 ===")

    try:
        pipeline_json = json.dumps(REAL_DATA)
        result = test_pipeline_node(
            pipeline_json, "99484f15-46fb-4151-a28d-62c320233432"
        )

        print("Sheet定位节点测试结果:")
        print(json.dumps(result, indent=2, ensure_ascii=False))

    except Exception as e:
        print(f"Sheet定位节点测试失败: {e}")
        import traceback

        traceback.print_exc()


def test_aggregator_node():
    """测试聚合节点"""
    print("\n=== 测试聚合节点 ===")

    try:
        pipeline_json = json.dumps(REAL_DATA)
        # result = test_pipeline_node(
        #     pipeline_json, "3e42efdb-4f0c-4287-b816-b7b8d8dc1f32"
        # )

        # print("聚合节点测试结果:")
        # print(json.dumps(result, indent=2, ensure_ascii=False))
        
        result2 = test_pipeline_node(
            pipeline_json, "3e42efdb-4f0c-4287-b816-b7b8d8dc1f32"
        )
        
        print("聚合节点2测试结果:")
        print(json.dumps(result2, indent=2, ensure_ascii=False))
        

    except Exception as e:
        print(f"聚合节点测试失败: {e}")
        import traceback

        traceback.print_exc()


def test_full_pipeline():
    """测试完整的pipeline"""
    print("\n=== 测试完整Pipeline ===")

    try:
        pipeline_json = json.dumps(REAL_DATA)
        result = execute_pipeline(pipeline_json)

        print("完整pipeline执行结果:")
        print(json.dumps(result, indent=2, ensure_ascii=False))

    except Exception as e:
        print(f"完整pipeline测试失败: {e}")
        import traceback

        traceback.print_exc()


def test_with_non_existent_sheet():
    """测试包含不存在sheet的场景"""
    print("\n=== 测试不存在Sheet的情况 ===")

    # 创建一个包含不存在索引的测试数据
    test_data = REAL_DATA.copy()

    # 修改索引源，添加一个不存在的索引值
    # 这里我们创建一个简单的测试，手动添加一个不存在的索引
    test_data["flow_nodes"] = [
        {
            "id": "test_index_source",
            "type": "indexSource",
            "data": {
                "nodeType": "indexSource",
                "sourceFileID": "9a80ba61-2a90-4e57-82d4-715710dd230b",
                "sheetName": "产成品入库单列表",
                "byColumn": False,  # 使用sheet名模式
                "columnName": "规格型号",
            },
        },
        {
            "id": "test_sheet_selector",
            "type": "sheetSelector",
            "data": {
                "nodeType": "sheetSelector",
                "targetFileID": "20392f90-e260-4ecb-8ad6-39df4edac192",
                "mode": "manual",
                "manualSheetName": "不存在的Sheet",  # 这个sheet不存在
            },
        },
    ]

    test_data["flow_edges"] = [
        {"source": "test_index_source", "target": "test_sheet_selector"}
    ]

    try:
        pipeline_json = json.dumps(test_data)
        result = execute_pipeline(pipeline_json)

        print("不存在sheet测试结果:")
        print(json.dumps(result, indent=2, ensure_ascii=False))

    except Exception as e:
        print(f"不存在sheet测试失败: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    print("使用真实数据测试Pipeline执行...")

    # 依次测试各个节点
    # test_index_source_node()
    # test_sheet_selector_node()
    test_aggregator_node()
    # test_full_pipeline()
    # test_with_non_existent_sheet()
