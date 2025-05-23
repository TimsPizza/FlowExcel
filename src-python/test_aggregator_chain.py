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
    test_data ={
  "id": "17b43160-7c47-44b0-9129-d05eb392f03b",
  "name": "测试",
  "files": [
    {
      "id": "20392f90-e260-4ecb-8ad6-39df4edac192",
      "name": "弹条生产记录.xlsx",
      "path": "/Users/timspizza/code/python/excel/弹条生产记录.xlsx",
      "sheet_metas": [
        {
          "sheet_name": "W1型",
          "header_row": 1
        },
        {
          "sheet_name": "Ⅲ型",
          "header_row": 1
        },
        {
          "sheet_name": "Ⅱ",
          "header_row": 1
        },
        {
          "sheet_name": "A型",
          "header_row": 1
        },
        {
          "sheet_name": "大Ⅱ型",
          "header_row": 1
        },
        {
          "sheet_name": "DI型",
          "header_row": 1
        },
        {
          "sheet_name": "小II型",
          "header_row": 1
        },
        {
          "sheet_name": "B型",
          "header_row": 1
        },
        {
          "sheet_name": "X3",
          "header_row": 1
        },
        {
          "sheet_name": "A3",
          "header_row": 1
        },
        {
          "sheet_name": "小II",
          "header_row": 1
        },
        {
          "sheet_name": "X2",
          "header_row": 1
        },
        {
          "sheet_name": "W4型",
          "header_row": 1
        },
        {
          "sheet_name": "FW4",
          "header_row": 1
        },
        {
          "sheet_name": "W2型",
          "header_row": 1
        },
        {
          "sheet_name": "C4型",
          "header_row": 1
        },
        {
          "sheet_name": "DZIII",
          "header_row": 1
        },
        {
          "sheet_name": "PR单趾",
          "header_row": 1
        },
        {
          "sheet_name": "小阻力",
          "header_row": 1
        },
        {
          "sheet_name": "WJ-2",
          "header_row": 1
        },
        {
          "sheet_name": "WJ-5 G型",
          "header_row": 1
        }
      ]
    },
    {
      "id": "9a80ba61-2a90-4e57-82d4-715710dd230b",
      "name": "入库单.xlsx",
      "path": "/Users/timspizza/code/python/excel/入库单.xlsx",
      "sheet_metas": [
        {
          "sheet_name": "产成品入库单列表",
          "header_row": 0
        }
      ]
    },
    {
      "id": "45693368-86c1-43b4-9af2-91224183ed7d",
      "name": "在制品.XLSX",
      "path": "/Users/timspizza/code/python/excel/在制品.XLSX",
      "sheet_metas": [
        {
          "sheet_name": "sheet1",
          "header_row": 0
        }
      ]
    },
    {
      "id": "d575fa71-c867-4a12-b910-b6342e2583ed",
      "name": "出库单.XLS",
      "path": "/Users/timspizza/code/python/excel/出库单.XLS",
      "sheet_metas": [
        {
          "sheet_name": "sheet1",
          "header_row": 3
        }
      ]
    }
  ],
  "flow_nodes": [
    {
      "id": "8b94edb5-2d85-48fa-92dd-5787f2e11389",
      "type": "indexSource",
      "position": {
        "x": 254.7516965741935,
        "y": -545.7272099200771
      },
      "data": {
        "nodeType": "indexSource",
        "id": "8b94edb5-2d85-48fa-92dd-5787f2e11389",
        "label": "索引源",
        "sourceFileID": "9a80ba61-2a90-4e57-82d4-715710dd230b",
        "bySheetName": false,
        "sheetName": "产成品入库单列表",
        "byColumn": true,
        "columnName": "规格型号"
      }
    },
    {
      "id": "99484f15-46fb-4151-a28d-62c320233432",
      "type": "sheetSelector",
      "position": {
        "x": 256.6537355412845,
        "y": -483.17323833733775
      },
      "data": {
        "nodeType": "sheetSelector",
        "id": "99484f15-46fb-4151-a28d-62c320233432",
        "label": "Sheet定位",
        "targetFileID": "20392f90-e260-4ecb-8ad6-39df4edac192",
        "mode": "auto_by_index"
      }
    },
    {
      "id": "3e42efdb-4f0c-4287-b816-b7b8d8dc1f32",
      "type": "aggregator",
      "position": {
        "x": 234.45466682330232,
        "y": -383.88433771188016
      },
      "data": {
        "nodeType": "aggregator",
        "id": "3e42efdb-4f0c-4287-b816-b7b8d8dc1f32",
        "label": "统计",
        "statColumn": "淬火报废",
        "method": "sum",
        "error": "Pipeline测试失败: JSON Parse error: Unexpected identifier \"NaN\""
      }
    },
    {
      "id": "26dbc186-3cf5-4f80-9cc1-44d36d845b58",
      "type": "output",
      "position": {
        "x": 235.17799285599057,
        "y": -169.26927585574725
      },
      "data": {
        "nodeType": "output",
        "id": "26dbc186-3cf5-4f80-9cc1-44d36d845b58",
        "label": "输出",
        "outputFormat": "excel"
      }
    },
    {
      "id": "1ed5bc4b-a1d6-4701-aef3-0c34d68adcfb",
      "type": "indexSource",
      "position": {
        "x": -97.1883766885179,
        "y": -546.8675707255691
      },
      "data": {
        "nodeType": "indexSource",
        "id": "1ed5bc4b-a1d6-4701-aef3-0c34d68adcfb",
        "label": "索引源",
        "sourceFileID": "9a80ba61-2a90-4e57-82d4-715710dd230b",
        "bySheetName": "False",
        "sheetName": "产成品入库单列表",
        "byColumn": "True",
        "columnName": "规格型号"
      }
    },
    {
      "id": "21e3054f-0231-4d92-b820-30fba4ecd80c",
      "type": "sheetSelector",
      "position": {
        "x": -52.75668459347171,
        "y": -330.80159243608216
      },
      "data": {
        "nodeType": "sheetSelector",
        "id": "21e3054f-0231-4d92-b820-30fba4ecd80c",
        "label": "Sheet定位",
        "targetFileID": "45693368-86c1-43b4-9af2-91224183ed7d",
        "mode": "manual",
        "manualSheetName": "sheet1"
      }
    },
    {
      "id": "533ca2d3-2536-465e-a542-dac89b9faf53",
      "type": "aggregator",
      "position": {
        "x": -166.34946299428287,
        "y": -169.03769139717934
      },
      "data": {
        "nodeType": "aggregator",
        "id": "533ca2d3-2536-465e-a542-dac89b9faf53",
        "label": "统计",
        "statColumn": "累计投产数量",
        "method": "sum"
      }
    },
    {
      "id": "f2ea4ffc-b96d-42fd-b10c-8f178e0ea21e",
      "type": "aggregator",
      "position": {
        "x": 263.93397191428767,
        "y": -288.1602181879296
      },
      "data": {
        "nodeType": "aggregator",
        "id": "f2ea4ffc-b96d-42fd-b10c-8f178e0ea21e",
        "label": "统计",
        "statColumn": "成品报废",
        "method": "sum",
        "error": "无结果数据"
      }
    },
    {
      "id": "22d6a30d-37fe-4a66-9f4f-0056e71143b5",
      "type": "rowLookup",
      "position": {
        "x": -100.56341909175998,
        "y": -271.4544980479895
      },
      "data": {
        "nodeType": "rowLookup",
        "id": "22d6a30d-37fe-4a66-9f4f-0056e71143b5",
        "label": "行查找/列匹配",
        "matchColumn": "规格型号",
        "error": "测试运行失败"
      }
    }
  ],
  "flow_edges": [
    {
      "id": "edge-8b94edb5-2d85-48fa-92dd-5787f2e11389-99484f15-46fb-4151-a28d-62c320233432-1747776278216",
      "source": "8b94edb5-2d85-48fa-92dd-5787f2e11389",
      "target": "99484f15-46fb-4151-a28d-62c320233432"
    },
    {
      "id": "edge-1ed5bc4b-a1d6-4701-aef3-0c34d68adcfb-21e3054f-0231-4d92-b820-30fba4ecd80c-1747790186689",
      "source": "1ed5bc4b-a1d6-4701-aef3-0c34d68adcfb",
      "target": "21e3054f-0231-4d92-b820-30fba4ecd80c"
    },
    {
      "id": "edge-533ca2d3-2536-465e-a542-dac89b9faf53-26dbc186-3cf5-4f80-9cc1-44d36d845b58-1747790287457",
      "source": "533ca2d3-2536-465e-a542-dac89b9faf53",
      "target": "26dbc186-3cf5-4f80-9cc1-44d36d845b58"
    },
    {
      "id": "edge-3e42efdb-4f0c-4287-b816-b7b8d8dc1f32-f2ea4ffc-b96d-42fd-b10c-8f178e0ea21e-1747796682798",
      "source": "3e42efdb-4f0c-4287-b816-b7b8d8dc1f32",
      "target": "f2ea4ffc-b96d-42fd-b10c-8f178e0ea21e"
    },
    {
      "id": "edge-f2ea4ffc-b96d-42fd-b10c-8f178e0ea21e-26dbc186-3cf5-4f80-9cc1-44d36d845b58-1747796692584",
      "source": "f2ea4ffc-b96d-42fd-b10c-8f178e0ea21e",
      "target": "26dbc186-3cf5-4f80-9cc1-44d36d845b58"
    },
    {
      "id": "edge-21e3054f-0231-4d92-b820-30fba4ecd80c-22d6a30d-37fe-4a66-9f4f-0056e71143b5-1747978855623",
      "source": "21e3054f-0231-4d92-b820-30fba4ecd80c",
      "target": "22d6a30d-37fe-4a66-9f4f-0056e71143b5"
    },
    {
      "id": "edge-22d6a30d-37fe-4a66-9f4f-0056e71143b5-533ca2d3-2536-465e-a542-dac89b9faf53-1747978857983",
      "source": "22d6a30d-37fe-4a66-9f4f-0056e71143b5",
      "target": "533ca2d3-2536-465e-a542-dac89b9faf53"
    },
    {
      "id": "edge-99484f15-46fb-4151-a28d-62c320233432-3e42efdb-4f0c-4287-b816-b7b8d8dc1f32-1747978995282",
      "source": "99484f15-46fb-4151-a28d-62c320233432",
      "target": "3e42efdb-4f0c-4287-b816-b7b8d8dc1f32"
    }
  ]
}
    
    # 执行测试
    executor = PipelineExecutor()
    
    print("测试第一个聚合节点:")
    result1 = executor.execute(test_data, target_node_id="3e42efdb-4f0c-4287-b816-b7b8d8dc1f32")
    print(f"Success: {result1.success}")
    if result1.success:
        print(f"Results keys: {list(result1.results.keys())}")
        if "3e42efdb-4f0c-4287-b816-b7b8d8dc1f32" in result1.results:
            for i, result in enumerate(result1.results["3e42efdb-4f0c-4287-b816-b7b8d8dc1f32"]):
                print(f"  Result {i}: {result.result_data}")
    else:
        print(f"Error: {result1.error}")
    
    print("\n测试第二个聚合节点:")
    result2 = executor.execute(test_data, target_node_id="f2ea4ffc-b96d-42fd-b10c-8f178e0ea21e")
    print(f"Success: {result2.success}")
    if result2.success:
        print(f"Results keys: {list(result2.results.keys())}")
        if "f2ea4ffc-b96d-42fd-b10c-8f178e0ea21e" in result2.results:
            for i, result in enumerate(result2.results["f2ea4ffc-b96d-42fd-b10c-8f178e0ea21e"]):
                print(f"  Result {i}: {result.result_data}")
    else:
        print(f"Error: {result2.error}")

if __name__ == "__main__":
    test_aggregator_chain() 