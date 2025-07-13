#!/usr/bin/env python3
"""
FlowExcel 测试环境设置脚本
自动检查和安装测试所需的依赖，创建必要的目录结构
"""

import os
import sys
import subprocess
import json
from pathlib import Path


def check_python_version():
    """检查Python版本"""
    print("🐍 检查Python版本...")
    if sys.version_info < (3, 8):
        print("❌ Python版本过低，需要Python 3.8+")
        return False
    print(f"✅ Python版本: {sys.version}")
    return True


def check_dependencies():
    """检查并安装依赖"""
    print("\n📦 检查测试依赖...")
    
    # 检查是否有uv命令
    try:
        subprocess.run(["uv", "--version"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ 未找到uv命令，请先安装uv: pip install uv")
        return False
    
    try:
        # 使用uv同步测试依赖
        result = subprocess.run([
            "uv", "sync", "--group", "test"
        ], capture_output=True, text=True, check=True)
        
        print("✅ 测试依赖安装成功")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ 依赖安装失败: {e}")
        print(f"错误输出: {e.stderr}")
        print("💡 提示: 请确保在项目根目录运行，或先执行 'uv sync' 安装基础依赖")
        return False


def check_test_data():
    """检查测试数据文件"""
    print("\n📊 检查测试数据...")
    
    # 检查Excel测试文件
    excel_file = Path("test_data/excel_files/test_case.xlsx")
    if not excel_file.exists():
        print(f"❌ 测试Excel文件不存在: {excel_file}")
        return False
    print(f"✅ 测试Excel文件: {excel_file}")
    
    # 检查JSON规范文件
    specs_dir = Path("test_data/test_specs")
    if not specs_dir.exists():
        print(f"❌ 测试规范目录不存在: {specs_dir}")
        return False
    
    required_specs = [
        "index_source.json",
        "sheet_selector.json", 
        "row_filter.json",
        "row_lookup.json",
        "aggregator.json",
        "output.json",
        "integration.json"
    ]
    
    missing_specs = []
    for spec_file in required_specs:
        spec_path = specs_dir / spec_file
        if not spec_path.exists():
            missing_specs.append(spec_file)
        else:
            print(f"✅ 测试规范: {spec_file}")
    
    if missing_specs:
        print(f"❌ 缺少测试规范文件: {missing_specs}")
        return False
    
    return True


def create_directories():
    """创建必要的目录结构"""
    print("\n📁 创建目录结构...")
    
    directories = [
        "test_results",
        "test_results/coverage_html", 
        "__pycache__"
    ]
    
    for directory in directories:
        dir_path = Path(directory)
        if not dir_path.exists():
            dir_path.mkdir(parents=True, exist_ok=True)
            print(f"✅ 创建目录: {directory}")
        else:
            print(f"✅ 目录已存在: {directory}")
    
    return True


def validate_test_specs():
    """验证测试规范文件格式"""
    print("\n🔍 验证测试规范格式...")
    
    specs_dir = Path("test_data/test_specs")
    json_files = list(specs_dir.glob("*.json"))
    
    valid_files = 0
    total_test_cases = 0
    
    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 检查基本结构
            if "test_cases" in data and isinstance(data["test_cases"], list):
                test_cases_count = len(data["test_cases"])
                total_test_cases += test_cases_count
                print(f"✅ {json_file.name}: {test_cases_count} 个测试用例")
                valid_files += 1
            else:
                print(f"⚠️  {json_file.name}: 格式可能有问题")
                
        except json.JSONDecodeError as e:
            print(f"❌ {json_file.name}: JSON格式错误 - {e}")
        except Exception as e:
            print(f"❌ {json_file.name}: 读取错误 - {e}")
    
    print(f"\n📊 验证结果:")
    print(f"   有效规范文件: {valid_files}/{len(json_files)}")
    print(f"   总测试用例数: {total_test_cases}")
    
    return valid_files == len(json_files)


def run_sample_test():
    """运行一个简单的示例测试"""
    print("\n🧪 运行示例测试...")
    
    try:
        # 添加src到Python路径
        src_path = Path("..")
        if src_path.exists():
            sys.path.insert(0, str(src_path.absolute()))
        
        # 尝试导入测试模块
        from test_cases.test_base import BaseTestFramework
        
        # 创建简单的测试实例
        test_framework = BaseTestFramework()
        
        # 尝试设置全局上下文
        global_context = test_framework.setup_global_context()
        
        print("✅ 测试框架初始化成功")
        print(f"   文件数量: {len(global_context.files)}")
        print(f"   执行模式: {global_context.execution_mode}")
        
        return True
        
    except Exception as e:
        print(f"❌ 示例测试失败: {e}")
        return False


def main():
    """主函数"""
    print("🚀 FlowExcel 测试环境设置")
    print("="*50)
    
    # 检查步骤
    checks = [
        ("Python版本", check_python_version),
        ("安装依赖", check_dependencies), 
        ("测试数据", check_test_data),
        ("目录结构", create_directories),
        ("规范验证", validate_test_specs),
        ("示例测试", run_sample_test)
    ]
    
    failed_checks = []
    
    for check_name, check_func in checks:
        if not check_func():
            failed_checks.append(check_name)
    
    # 显示总结
    print("\n" + "="*50)
    print("🎯 环境设置总结")
    print("="*50)
    
    if not failed_checks:
        print("✅ 所有检查通过！测试环境已就绪")
        print("\n💡 现在可以运行测试:")
        print("   python run_all_tests.py")
        print("   python test_index_source.py")
        print("   pytest test_*.py")
    else:
        print(f"❌ {len(failed_checks)} 个检查失败:")
        for failed_check in failed_checks:
            print(f"   - {failed_check}")
        print("\n💡 请修复上述问题后重新运行此脚本")
    
    print("="*50)


if __name__ == "__main__":
    main() 