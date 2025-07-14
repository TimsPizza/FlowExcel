"""
FlowExcel测试框架基础类
提供测试配置加载、结果验证、错误处理等核心功能
"""

import json
import os
import sys
import unittest
import traceback
from typing import Dict, List, Any, Optional, Union
from pathlib import Path
import pandas as pd

# 添加src到Python路径
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))

from pipeline.models import (
    BaseNode, GlobalContext, PathContext, BranchContext,
    FileInfo, ExecutionMode, NodeType, IndexValue
)
from pipeline.processors import (
    IndexSourceProcessor, SheetSelectorProcessor, RowFilterProcessor,
    RowLookupProcessor, AggregatorProcessor, OutputProcessor
)


class TestResult:
    """测试结果类"""
    
    def __init__(self, test_id: str, success: bool, error: Optional[str] = None, 
                 actual_result: Any = None, expected_result: Any = None, 
                 execution_time: float = 0.0):
        self.test_id = test_id
        self.success = success
        self.error = error
        self.actual_result = actual_result
        self.expected_result = expected_result
        self.execution_time = execution_time


class TestSuiteResult:
    """测试套件结果类"""
    
    def __init__(self, suite_name: str):
        self.suite_name = suite_name
        self.test_results: List[TestResult] = []
        self.total_tests = 0
        self.passed_tests = 0
        self.failed_tests = 0
        self.total_time = 0.0
    
    def add_test_result(self, result: TestResult):
        self.test_results.append(result)
        self.total_tests += 1
        if result.success:
            self.passed_tests += 1
        else:
            self.failed_tests += 1
        self.total_time += result.execution_time
    
    def get_summary(self) -> str:
        success_rate = (self.passed_tests / self.total_tests * 100) if self.total_tests > 0 else 0
        return (f"{self.suite_name}: {self.passed_tests}/{self.total_tests} 通过 "
                f"({success_rate:.1f}%), 耗时: {self.total_time:.2f}s")


class BaseTestFramework:
    """基础测试框架类"""
    
    def __init__(self, test_specs_dir: str = "test_data/test_specs"):
        self.test_specs_dir = Path(test_specs_dir)
        self.test_data_dir = Path("test_data")
        self.excel_file_path = self.test_data_dir / "excel_files" / "test_case.xlsx"
        self.global_context = None
        
        # 处理器映射
        self.processors = {
            NodeType.INDEX_SOURCE: IndexSourceProcessor(),
            NodeType.SHEET_SELECTOR: SheetSelectorProcessor(),
            NodeType.ROW_FILTER: RowFilterProcessor(),
            NodeType.ROW_LOOKUP: RowLookupProcessor(),
            NodeType.AGGREGATOR: AggregatorProcessor(),
            NodeType.OUTPUT: OutputProcessor(),
        }
    
    def setup_global_context(self) -> GlobalContext:
        """设置全局上下文"""
        if self.global_context is not None:
            return self.global_context
            
        # 创建文件信息
        file_info = FileInfo(
            id="test-file-93fac9a3-f4b3-410a-932c-32620bd11122",
            name="test_case.xlsx",
            path=str(self.excel_file_path),
            sheet_metas=[
                {"sheet_name": "Sheet1_Perfect_Clean", "header_row": 0},
                {"sheet_name": "Sheet2_Slightly_Messy", "header_row": 0},
                {"sheet_name": "Sheet3_Moderately_Complex", "header_row": 0},
                {"sheet_name": "Sheet4_Very_Messy", "header_row": 0},
                {"sheet_name": "Sheet5_Extreme_Chaos", "header_row": 0},
                {"sheet_name": "Sheet6_Edge_Cases", "header_row": 0},
                {"sheet_name": "Sheet7_Real_World_Sales", "header_row": 0},
                {"sheet_name": "Sheet8_Inventory_Complex", "header_row": 0},
            ]
        )
        
        self.global_context = GlobalContext(
            files={"test-file-93fac9a3-f4b3-410a-932c-32620bd11122": file_info},
            execution_mode=ExecutionMode.TEST
        )
        
        return self.global_context
    
    def load_test_specs(self, filename: str) -> Dict[str, Any]:
        """加载测试规范文件"""
        spec_path = self.test_specs_dir / filename
        try:
            with open(spec_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            raise FileNotFoundError(f"无法加载测试规范文件 {spec_path}: {e}")
    
    def create_node_from_config(self, node_config: Dict[str, Any]) -> BaseNode:
        """从配置创建节点"""
        return BaseNode(
            id=node_config["id"],
            type=NodeType(node_config["type"]),
            data=node_config["data"]
        )
    
    def validate_result(self, actual: Any, expected: Dict[str, Any], 
                       validation_rules: Dict[str, Any]) -> tuple[bool, str]:
        """验证结果，返回(是否成功, 详细错误信息)"""
        try:
            if expected["type"] == "index_list":
                if not hasattr(actual, 'index_values'):
                    return False, f"期望有index_values属性的对象，但得到: {type(actual)}"
                actual_values = [str(val) for val in actual.index_values]
                expected_values = expected["data"]
                
                # 检查数量
                if len(actual_values) != expected["count"]:
                    return False, f"数量不匹配: 期望{expected['count']}个值，实际得到{len(actual_values)}个值"
                
                # 检查唯一性
                if validation_rules.get("check_unique", False):
                    if len(set(actual_values)) != len(actual_values):
                        duplicates = [x for x in actual_values if actual_values.count(x) > 1]
                        return False, f"唯一性检查失败: 发现重复值 {list(set(duplicates))}"
                
                # 检查内容（忽略顺序）
                actual_set = set(actual_values)
                expected_set = set(expected_values)
                
                if actual_set != expected_set:
                    missing = expected_set - actual_set
                    extra = actual_set - expected_set
                    error_parts = []
                    if missing:
                        error_parts.append(f"缺失值: {list(missing)}")
                    if extra:
                        error_parts.append(f"多余值: {list(extra)}")
                    return False, f"内容不匹配 - {', '.join(error_parts)}"
                
                return True, ""
                
            elif expected["type"] == "dataframe":
                if not hasattr(actual, 'dataframe') or not isinstance(actual.dataframe, pd.DataFrame):
                    return False, f"期望DataFrame对象，但得到: {type(actual)}"
                
                df = actual.dataframe
                
                # 验证行数
                if hasattr(expected, 'row_count') and len(df) != expected["row_count"]:
                    return False, f"行数不匹配: 期望{expected['row_count']}行，实际得到{len(df)}行"
                
                # 验证工作表名
                if "sheet_name" in expected:
                    if hasattr(actual, 'sheet_name'):
                        if actual.sheet_name != expected["sheet_name"]:
                            return False, f"工作表名不匹配: 期望'{expected['sheet_name']}'，实际得到'{actual.sheet_name}'"
                    else:
                        return False, f"期望工作表名'{expected['sheet_name']}'，但结果中没有sheet_name属性"
                
                return True, ""
                
            elif expected["type"] == "aggregation_result":
                if not hasattr(actual, 'result'):
                    return False, f"期望聚合结果对象，但得到: {type(actual)}"
                
                result = actual.result
                expected_method = expected["aggregation_method"]
                expected_value = expected["result_value"]
                
                # 检查聚合方法
                if str(result.operation) != expected_method:
                    return False, f"聚合方法不匹配: 期望'{expected_method}'，实际得到'{result.operation}'"
                
                # 检查数值结果（考虑浮点精度）
                if isinstance(expected_value, (int, float)) and isinstance(result.result_value, (int, float)):
                    diff = abs(float(result.result_value) - float(expected_value))
                    if diff >= 0.0001:
                        return False, f"数值结果不匹配: 期望{expected_value}，实际得到{result.result_value}（差异: {diff}）"
                else:
                    if str(result.result_value) != str(expected_value):
                        return False, f"结果值不匹配: 期望'{expected_value}'，实际得到'{result.result_value}'"
                
                return True, ""
            
            return True, ""
            
        except Exception as e:
            return False, f"验证过程中出错: {type(e).__name__}: {str(e)}"
    
    def run_single_test(self, test_case: Dict[str, Any], processor, 
                       global_context: GlobalContext) -> TestResult:
        """运行单个测试用例"""
        test_id = test_case["test_id"]
        start_time = pd.Timestamp.now()
        
        try:
            # 创建节点
            node = self.create_node_from_config(test_case["node_config"])
            
            # 创建路径上下文
            path_context = PathContext(current_index=IndexValue("test"))
            
            # 准备输入数据
            input_data = self._prepare_input_data(test_case, processor.node_type)
            
            # 执行节点处理
            actual_result = processor.process(
                node=node,
                input_data=input_data,
                global_context=global_context,
                path_context=path_context
            )
            
            # 验证结果
            validation_rules = test_case.get("validation_rules", {})
            is_valid, error_msg = self.validate_result(
                actual_result, 
                test_case["expected_result"], 
                validation_rules
            )
            
            execution_time = (pd.Timestamp.now() - start_time).total_seconds()
            
            return TestResult(
                test_id=test_id,
                success=is_valid,
                actual_result=actual_result,
                expected_result=test_case["expected_result"],
                execution_time=execution_time,
                error=error_msg if not is_valid else None
            )
            
        except Exception as e:
            execution_time = (pd.Timestamp.now() - start_time).total_seconds()
            error_msg = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
            
            return TestResult(
                test_id=test_id,
                success=False,
                error=error_msg,
                execution_time=execution_time
            )
    
    def _prepare_input_data(self, test_case: Dict[str, Any], node_type: NodeType):
        """准备节点输入数据"""
        from pipeline.models import (
            IndexSourceInput, SheetSelectorInput, RowFilterInput, 
            RowLookupInput, AggregatorInput, OutputInput, IndexValue
        )
        
        if node_type == NodeType.INDEX_SOURCE:
            return IndexSourceInput()
        elif node_type == NodeType.SHEET_SELECTOR:
            # 为SheetSelector使用正确的index_value，根据测试用例的模式决定
            node_data = test_case["node_config"]["data"]
            mode = node_data.get("mode", "auto_by_index")
            
            if mode == "auto_by_index":
                # 对于自动索引模式，使用测试期望的sheet名作为index_value
                expected_sheet = test_case["expected_result"]["sheet_name"]
                return SheetSelectorInput(index_value=IndexValue(expected_sheet))
            else:
                # 对于手动模式，index_value不重要，但仍需要提供
                return SheetSelectorInput(index_value=IndexValue("manual_mode"))
        elif node_type == NodeType.ROW_FILTER:
            # 需要从上下文加载DataFrame
            sheet_name = test_case["sheet_name"]
            df = pd.read_excel(self.excel_file_path, sheet_name=sheet_name, header=0)
            return RowFilterInput(dataframe=df, index_value=IndexValue("test"))
        elif node_type == NodeType.ROW_LOOKUP:
            # 需要从上下文加载DataFrame
            sheet_name = test_case["sheet_name"]
            df = pd.read_excel(self.excel_file_path, sheet_name=sheet_name, header=0)
            return RowLookupInput(dataframe=df, index_value=IndexValue("test"))
        elif node_type == NodeType.AGGREGATOR:
            # 需要从上下文加载DataFrame
            sheet_name = test_case["sheet_name"]
            df = pd.read_excel(self.excel_file_path, sheet_name=sheet_name, header=0)
            return AggregatorInput(dataframe=df, index_value=IndexValue("test"))
        elif node_type == NodeType.OUTPUT:
            # 为Output节点创建mock的聚合结果数据
            mock_branch_results = {
                "branch_1": {
                    IndexValue("test"): {
                        "count": 10,
                        "sum": 1000.0,
                        "avg": 100.0
                    }
                }
            }
            mock_dataframes = {
                "branch_1": pd.DataFrame({
                    "Column1": [1, 2, 3],
                    "Column2": ["A", "B", "C"]
                })
            }
            return OutputInput(
                branch_aggregated_results=mock_branch_results,
                branch_dataframes=mock_dataframes
            )
        else:
            # 其他未知类型
            return None
    
    def print_test_summary(self, suite_results: List[TestSuiteResult]):
        """打印测试总结"""
        print("\n" + "="*80)
        print("FlowExcel 测试框架执行总结")
        print("="*80)
        
        total_tests = 0
        total_passed = 0
        total_failed = 0
        total_time = 0.0
        
        for suite_result in suite_results:
            print(f"\n[INFO] {suite_result.get_summary()}")
            
            total_tests += suite_result.total_tests
            total_passed += suite_result.passed_tests
            total_failed += suite_result.failed_tests
            total_time += suite_result.total_time
            
            # 显示失败的测试
            failed_tests = [r for r in suite_result.test_results if not r.success]
            if failed_tests:
                print(f"    [ERROR] 失败的测试:")
                for failed_test in failed_tests:
                    print(f"      - {failed_test.test_id}: {failed_test.error}")
        
        print("\n" + "-"*80)
        success_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0
        print(f"[INFO] 总计: {total_passed}/{total_tests} 通过 ({success_rate:.1f}%)")
        print(f"[INFO] 总耗时: {total_time:.2f}s")
        
        if total_failed == 0:
            print("[OK] 所有测试通过!")
        else:
            print(f"[ERROR]  {total_failed} 个测试失败")
        
        print("="*80) 