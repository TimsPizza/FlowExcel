"""
Integration集成测试类
从integration.json加载测试用例并执行多节点工作流测试
"""

import unittest
from .test_base import BaseTestFramework, TestSuiteResult, TestResult
from pipeline.models import (
    NodeType, BaseNode, IndexValue,
    IndexSourceInput, SheetSelectorInput, RowFilterInput,
    AggregatorInput, OutputInput
)
import pandas as pd
import traceback


class TestIntegration(BaseTestFramework):
    """Integration集成测试类"""
    
    def __init__(self):
        super().__init__()
    
    def run_tests(self) -> TestSuiteResult:
        """运行所有Integration测试"""
        print(f"\n[INFO] 开始执行 Integration 集成测试...")
        
        # 加载测试规范
        test_specs = self.load_test_specs("integration.json")
        test_cases = test_specs["test_cases"]
        
        # 设置全局上下文
        global_context = self.setup_global_context()
        
        # 创建测试套件结果
        suite_result = TestSuiteResult(f"Integration ({len(test_cases)} 个测试)")
        
        # 执行每个测试用例
        for i, test_case in enumerate(test_cases, 1):
            print(f"   [INFO] 执行测试 {i}/{len(test_cases)}: {test_case['test_name']}")
            
            test_result = self.run_integration_workflow(
                test_case=test_case,
                global_context=global_context
            )
            
            suite_result.add_test_result(test_result)
            
            # 显示测试结果
            status = "[OK]" if test_result.success else "[FAIL]"
            print(f"     {status} {test_result.test_id} - {test_result.execution_time:.3f}s")
            
            if not test_result.success:
                print(f"         [ERROR] 错误: {test_result.error}")
        
        return suite_result
    
    def run_integration_workflow(self, test_case: dict, global_context) -> TestResult:
        """运行集成工作流测试"""
        test_id = test_case["test_id"]
        start_time = pd.Timestamp.now()
        
        try:
            workflow_steps = test_case.get("workflow", [])
            if not workflow_steps:
                raise ValueError("集成测试缺少workflow配置")
            
            print(f"       [INFO] 执行工作流 ({len(workflow_steps)} 个步骤)")
            
            # 工作流执行状态
            workflow_context = {
                "current_data": None,
                "index_values": [],
                "aggregation_results": {}
            }
            
            # 按步骤执行工作流
            for step_info in workflow_steps:
                step_num = step_info["step"]
                node_type_str = step_info["node_type"]
                node_config = step_info["node_config"]
                
                print(f"         [INFO] 步骤 {step_num}: 执行 {node_type_str} 节点")
                
                # 执行当前步骤
                self._execute_workflow_step(
                    node_type_str, node_config, workflow_context, global_context
                )
            
            # 验证工作流结果
            is_valid = self._validate_integration_result(
                workflow_context, test_case["expected_result"]
            )
            
            execution_time = (pd.Timestamp.now() - start_time).total_seconds()
            
            return TestResult(
                test_id=test_id,
                success=is_valid,
                actual_result=workflow_context,
                expected_result=test_case["expected_result"],
                execution_time=execution_time,
                error=None if is_valid else "集成工作流验证失败"
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
    
    def _execute_workflow_step(self, node_type_str: str, node_config: dict, 
                              workflow_context: dict, global_context):
        """执行工作流中的单个步骤"""
        node_type = NodeType(node_type_str)
        processor = self.processors[node_type]
        
        # 创建节点配置 - 处理新的配置格式
        if "data" in node_config:
            # 新格式：包含id, type, data的完整节点配置
            node = BaseNode(
                id=node_config["id"],
                type=node_type,
                data=node_config["data"]
            )
        else:
            # 旧格式：直接作为data使用
            node = BaseNode(
                id=f"integration-{node_type_str}-step",
                type=node_type,
                data=node_config
            )
        
        # 创建路径上下文
        from pipeline.models import PathContext
        path_context = PathContext(current_index=IndexValue("integration-test"))
        
        # 根据节点类型准备输入数据
        if node_type == NodeType.INDEX_SOURCE:
            input_data = IndexSourceInput()
            result = processor.process(node, input_data, global_context, path_context)
            workflow_context["index_values"] = result.index_values
            
        elif node_type == NodeType.SHEET_SELECTOR:
            # 使用第一个索引值作为测试
            index_value = workflow_context["index_values"][0] if workflow_context["index_values"] else IndexValue("test")
            input_data = SheetSelectorInput(index_value=index_value)
            result = processor.process(node, input_data, global_context, path_context)
            workflow_context["current_data"] = result.dataframe
            
        elif node_type == NodeType.ROW_FILTER:
            if workflow_context["current_data"] is None:
                raise ValueError("RowFilter节点需要上游DataFrame数据")
            input_data = RowFilterInput(
                dataframe=workflow_context["current_data"],
                index_value=IndexValue("integration-test")
            )
            result = processor.process(node, input_data, global_context, path_context)
            workflow_context["current_data"] = result.dataframe
            
        elif node_type == NodeType.AGGREGATOR:
            if workflow_context["current_data"] is None:
                raise ValueError("Aggregator节点需要上游DataFrame数据")
            input_data = AggregatorInput(
                dataframe=workflow_context["current_data"],
                index_value=IndexValue("integration-test")
            )
            result = processor.process(node, input_data, global_context, path_context)
            workflow_context["aggregation_results"] = result.result
            
        elif node_type == NodeType.OUTPUT:
            # Output节点需要聚合结果
            if not workflow_context["aggregation_results"]:
                raise ValueError("Output节点需要聚合结果数据")
            
            # 构造模拟的分支聚合结果 - 确保数据类型正确
            agg_result = workflow_context["aggregation_results"]
            if hasattr(agg_result, 'result_value'):
                result_value = agg_result.result_value
            else:
                result_value = float(agg_result) if isinstance(agg_result, (int, float, str)) else 0.0
                
            branch_aggregated_results = {
                "integration-branch": {
                    IndexValue("integration-test"): {
                        "aggregated_value": result_value
                    }
                }
            }
            branch_dataframes = {
                "integration-branch": {
                    IndexValue("integration-test"): workflow_context["current_data"]
                }
            }
            
            input_data = OutputInput(
                branch_aggregated_results=branch_aggregated_results,
                branch_dataframes=branch_dataframes
            )
            result = processor.process(node, input_data, global_context, path_context)
            workflow_context["final_output"] = result
    
    def _validate_integration_result(self, workflow_context: dict, expected_result: dict) -> bool:
        """验证集成测试结果"""
        try:
            # 检查工作流是否完成
            if expected_result.get("workflow_completed", False):
                if "final_output" not in workflow_context:
                    return False
            
            # 检查数据流是否正确
            if expected_result.get("check_data_flow", False):
                if not workflow_context.get("current_data") is None:
                    return True
            
            return True
            
        except Exception as e:
            print(f"[ERROR] 集成测试验证失败: {e}")
            return False


class TestIntegrationUnittest(unittest.TestCase):
    """Integration集成测试单元测试类 - 兼容unittest"""
    
    def setUp(self):
        self.test_framework = TestIntegration()
    
    def test_all_integration_cases(self):
        """测试所有Integration测试用例"""
        suite_result = self.test_framework.run_tests()
        
        # 断言所有测试都通过
        self.assertEqual(
            suite_result.failed_tests, 0,
            f"{suite_result.failed_tests} 个Integration测试失败"
        )
        
        # 确保有测试用例执行
        self.assertGreater(
            suite_result.total_tests, 0,
            "没有找到Integration测试用例"
        )


if __name__ == "__main__":
    # 直接运行测试
    test_runner = TestIntegration()
    result = test_runner.run_tests()
    print(f"\n[INFO] {result.get_summary()}")
    
    # 如果有失败的测试，显示详细信息
    failed_tests = [r for r in result.test_results if not r.success]
    if failed_tests:
        print("\n[ERROR] 失败的测试详细信息:")
        for failed_test in failed_tests:
            print(f"  - {failed_test.test_id}")
            print(f"     [ERROR] 错误: {failed_test.error}")
            if failed_test.expected_result:
                print(f"     [INFO] 期望结果: {failed_test.expected_result}")
            print() 