"""
RowLookup节点测试类
从row_lookup.json加载测试用例并执行
"""

import unittest
from .test_base import BaseTestFramework, TestSuiteResult
from pipeline.models import NodeType


class TestRowLookup(BaseTestFramework):
    """RowLookup节点测试类"""
    
    def __init__(self):
        super().__init__()
        self.node_type = NodeType.ROW_LOOKUP
        self.processor = self.processors[self.node_type]
    
    def run_tests(self) -> TestSuiteResult:
        """运行所有RowLookup测试"""
        print(f"\n🔍 开始执行 {self.node_type.value} 节点测试...")
        
        # 加载测试规范
        test_specs = self.load_test_specs("row_lookup.json")
        test_cases = test_specs["test_cases"]
        
        # 设置全局上下文
        global_context = self.setup_global_context()
        
        # 创建测试套件结果
        suite_result = TestSuiteResult(f"RowLookup ({len(test_cases)} 个测试)")
        
        # 执行每个测试用例
        for i, test_case in enumerate(test_cases, 1):
            print(f"  ⏳ 执行测试 {i}/{len(test_cases)}: {test_case['test_name']}")
            
            test_result = self.run_single_test(
                test_case=test_case,
                processor=self.processor,
                global_context=global_context
            )
            
            suite_result.add_test_result(test_result)
            
            # 显示测试结果
            status = "✅" if test_result.success else "❌"
            print(f"     {status} {test_result.test_id} - {test_result.execution_time:.3f}s")
            
            if not test_result.success:
                print(f"        错误: {test_result.error}")
        
        return suite_result


class TestRowLookupUnittest(unittest.TestCase):
    """RowLookup节点单元测试类 - 兼容unittest"""
    
    def setUp(self):
        self.test_framework = TestRowLookup()
    
    def test_all_row_lookup_cases(self):
        """测试所有RowLookup测试用例"""
        suite_result = self.test_framework.run_tests()
        
        # 断言所有测试都通过
        self.assertEqual(
            suite_result.failed_tests, 0,
            f"{suite_result.failed_tests} 个RowLookup测试失败"
        )
        
        # 确保有测试用例执行
        self.assertGreater(
            suite_result.total_tests, 0,
            "没有找到RowLookup测试用例"
        )


if __name__ == "__main__":
    # 直接运行测试
    test_runner = TestRowLookup()
    result = test_runner.run_tests()
    print(f"\n📊 {result.get_summary()}")
    
    # 如果有失败的测试，显示详细信息
    failed_tests = [r for r in result.test_results if not r.success]
    if failed_tests:
        print("\n❌ 失败的测试详细信息:")
        for failed_test in failed_tests:
            print(f"  - {failed_test.test_id}")
            print(f"    错误: {failed_test.error}")
            if failed_test.expected_result:
                print(f"    期望结果: {failed_test.expected_result}")
            print() 