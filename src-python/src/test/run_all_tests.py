"""
FlowExcel主测试运行器
运行所有节点测试和集成测试，生成完整的测试报告和coverage报告
"""

import os
import sys
import time
import json
from datetime import datetime
from pathlib import Path
import subprocess

# 添加src到Python路径
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

# 导入所有测试类
from test_cases.test_index_source import TestIndexSource
from test_cases.test_sheet_selector import TestSheetSelector
from test_cases.test_row_filter import TestRowFilter
from test_cases.test_row_lookup import TestRowLookup
from test_cases.test_aggregator import TestAggregator
from test_cases.test_output import TestOutput
from test_cases.test_integration import TestIntegration
from test_cases.test_base import TestSuiteResult


class FlowExcelTestRunner:
    """FlowExcel主测试运行器"""
    
    def __init__(self):
        self.start_time = None
        self.end_time = None
        self.suite_results = []
        
        # 初始化所有测试类
        self.test_suites = {
            "IndexSource": TestIndexSource(),
            "SheetSelector": TestSheetSelector(), 
            "RowFilter": TestRowFilter(),
            "RowLookup": TestRowLookup(),
            "Aggregator": TestAggregator(),
            "Output": TestOutput(),
            "Integration": TestIntegration()
        }
    
    def run_all_tests(self, enable_coverage=True):
        """运行所有测试套件"""
        print("🚀 FlowExcel 测试框架启动")
        print("="*80)
        
        self.start_time = time.time()
        
        # 运行每个测试套件，即使某个失败也继续执行
        for suite_name, test_suite in self.test_suites.items():
            try:
                print(f"\n🔧 正在执行 {suite_name} 测试套件...")
                
                suite_result = test_suite.run_tests()
                self.suite_results.append(suite_result)
                
                # 显示套件结果简要信息
                status = "✅" if suite_result.failed_tests == 0 else "❌"
                print(f"   {status} {suite_result.get_summary()}")
                
            except Exception as e:
                print(f"   ❌ {suite_name} 测试套件执行失败: {e}")
                
                # 创建失败的套件结果
                failed_result = TestSuiteResult(f"{suite_name} (执行失败)")
                failed_result.total_tests = 1
                failed_result.failed_tests = 1
                failed_result.total_time = 0.0
                self.suite_results.append(failed_result)
        
        self.end_time = time.time()
        
        # 生成测试报告
        self.generate_test_report()
        
        # 生成coverage报告
        if enable_coverage:
            self.generate_coverage_report()
        
        # 显示最终总结
        self.print_final_summary()
    
    def generate_test_report(self):
        """生成详细的测试报告"""
        print("\n📊 生成测试报告...")
        
        report_dir = Path("test_results")
        report_dir.mkdir(exist_ok=True)
        
        # 生成JSON格式报告
        report_data = {
            "test_run_info": {
                "timestamp": datetime.now().isoformat(),
                "total_duration_seconds": self.end_time - self.start_time,
                "test_framework": "FlowExcel Custom Test Framework",
                "python_version": sys.version
            },
            "summary": self._get_overall_summary(),
            "suite_results": []
        }
        
        # 添加每个套件的详细结果
        for suite_result in self.suite_results:
            suite_data = {
                "suite_name": suite_result.suite_name,
                "total_tests": suite_result.total_tests,
                "passed_tests": suite_result.passed_tests,
                "failed_tests": suite_result.failed_tests,
                "duration_seconds": suite_result.total_time,
                "success_rate": (suite_result.passed_tests / suite_result.total_tests * 100) if suite_result.total_tests > 0 else 0,
                "failed_test_details": [
                    {
                        "test_id": r.test_id,
                        "error": r.error,
                        "execution_time": r.execution_time
                    }
                    for r in suite_result.test_results if not r.success
                ]
            }
            report_data["suite_results"].append(suite_data)
        
        # 保存JSON报告
        report_file = report_dir / f"test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        print(f"   💾 测试报告已保存: {report_file}")
        
        # 生成简要的文本报告
        txt_report_file = report_dir / "latest_test_summary.txt"
        with open(txt_report_file, 'w', encoding='utf-8') as f:
            f.write("FlowExcel 测试执行总结\n")
            f.write("="*50 + "\n\n")
            f.write(f"执行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"总耗时: {self.end_time - self.start_time:.2f}秒\n\n")
            
            summary = self._get_overall_summary()
            f.write(f"总测试数: {summary['total_tests']}\n")
            f.write(f"通过: {summary['passed_tests']}\n")
            f.write(f"失败: {summary['failed_tests']}\n")
            f.write(f"成功率: {summary['success_rate']:.1f}%\n\n")
            
            # 每个套件的结果
            for suite_result in self.suite_results:
                f.write(f"{suite_result.get_summary()}\n")
                
                # 失败测试详情
                failed_tests = [r for r in suite_result.test_results if not r.success]
                if failed_tests:
                    f.write("  失败的测试:\n")
                    for failed_test in failed_tests:
                        f.write(f"    - {failed_test.test_id}: {failed_test.error}\n")
                f.write("\n")
        
        print(f"   📄 简要报告已保存: {txt_report_file}")
    
    def generate_coverage_report(self):
        """生成代码覆盖率报告"""
        print("\n📈 生成代码覆盖率报告...")
        
        try:
            # 检查是否安装了coverage
            subprocess.run(["coverage", "--version"], check=True, capture_output=False)
            
            # 运行coverage分析
            print("   🔍 执行代码覆盖率分析...")
            
            # 执行coverage运行
            coverage_cmd = [
                "coverage", "run", "--rcfile=.coveragerc", 
                "-m", "pytest", 
                "test_index_source.py", 
                "test_sheet_selector.py",
                "test_row_filter.py",
                "test_row_lookup.py", 
                "test_aggregator.py",
                "test_output.py",
                "test_integration.py",
                "-v"
            ]
            
            result = subprocess.run(coverage_cmd, capture_output=True, text=True)
            
            # 生成coverage报告
            print("   📊 生成覆盖率报告...")
            
            # 文本报告
            subprocess.run(["coverage", "report", "--rcfile=.coveragerc"], check=True, capture_output=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            # HTML报告
            html_result = subprocess.run(
                ["coverage", "html", "--rcfile=.coveragerc"], 
                capture_output=False
            )
            
            if html_result.returncode == 0:
                print("   🌐 HTML覆盖率报告已生成: test_results/coverage_html/index.html")

        except subprocess.CalledProcessError as e:
            print(f"   ⚠️ Coverage报告生成失败: {e}")
            print("   💡 请确保已安装coverage: pip install coverage")
        except FileNotFoundError:
            print("   ⚠️ 未找到coverage工具")
            print("   💡 请安装coverage: pip install coverage")
    
    def _get_overall_summary(self):
        """获取总体测试摘要"""
        total_tests = sum(s.total_tests for s in self.suite_results)
        passed_tests = sum(s.passed_tests for s in self.suite_results)
        failed_tests = sum(s.failed_tests for s in self.suite_results)
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        return {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "success_rate": success_rate
        }
    
    def print_final_summary(self):
        """打印最终测试总结"""
        summary = self._get_overall_summary()
        
        print("\n" + "="*80)
        print("🎯 FlowExcel 测试框架执行完成")
        print("="*80)
        print(f"⏱️  总耗时: {self.end_time - self.start_time:.2f}秒")
        print(f"📊 测试套件数: {len(self.suite_results)}")
        print(f"🔢 总测试数: {summary['total_tests']}")
        print(f"✅ 通过: {summary['passed_tests']}")
        print(f"❌ 失败: {summary['failed_tests']}")
        print(f"📈 成功率: {summary['success_rate']:.1f}%")
        
        # 显示失败的套件
        failed_suites = [s for s in self.suite_results if s.failed_tests > 0]
        if failed_suites:
            print(f"\n⚠️  有 {len(failed_suites)} 个测试套件包含失败的测试:")
            for suite in failed_suites:
                print(f"   - {suite.suite_name}: {suite.failed_tests} 个失败")
        else:
            print("\n🎉 所有测试套件都通过了!")
        
        print("\n📁 测试结果文件:")
        print("   - test_results/test_report_*.json  (详细测试报告)")
        print("   - test_results/latest_test_summary.txt  (简要摘要)")
        print("   - test_results/coverage_html/index.html  (覆盖率报告)")
        
        print("="*80)


def main():
    """主函数"""
    # 确保在正确的目录运行
    script_dir = Path(__file__).parent
    os.chdir(script_dir)  # 确保在test目录中运行
    
    # 创建测试运行器并执行
    runner = FlowExcelTestRunner()
    runner.run_all_tests(enable_coverage=True)


if __name__ == "__main__":
    main() 