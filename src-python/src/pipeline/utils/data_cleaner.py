#!/usr/bin/env python3
"""
智能数据清理器 - 重新设计版本
重点：尊重pandas原始类型推断，避免过度转换，确保字符串vs数字的正确区分
"""

import pandas as pd
import numpy as np
import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

@dataclass
class CleaningConfig:
    """数据清洗配置"""
    
    # 基础清理配置
    trim_strings: bool = True
    normalize_whitespace: bool = True
    standardize_nulls: bool = True
    
    # 类型推断配置
    enable_smart_inference: bool = True
    numeric_threshold: float = 0.85  # 数值转换成功率阈值
    datetime_threshold: float = 0.80  # 日期转换成功率阈值
    boolean_threshold: float = 0.90   # 布尔转换成功率阈值
    
    # 空值处理配置
    null_values: List[str] = field(default_factory=lambda: [
        "N/A", "NULL", "null", "Null", "空", "", "无", "None", "NONE",
        "#N/A", "#NULL!", "#DIV/0!", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "nan"
    ])
    
    # 数值处理配置
    currency_symbols: List[str] = field(default_factory=lambda: ["$", "¥", "€", "£", "￥"])
    percentage_handling: bool = True
    thousand_separator: str = ","
    
    # 日期格式配置
    date_formats: List[str] = field(default_factory=lambda: [
        "%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%m/%d/%Y",
        "%Y年%m月%d日", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"
    ])
    
    # 布尔值配置
    true_values: List[str] = field(default_factory=lambda: [
        "True", "true", "TRUE", "是", "对", "Y", "y", "Yes", "yes", "YES", "1"
    ])
    false_values: List[str] = field(default_factory=lambda: [
        "False", "false", "FALSE", "否", "错", "N", "n", "No", "no", "NO", "0"
    ])

@dataclass
class ConversionResult:
    """类型转换结果"""
    success: bool
    series: pd.Series
    success_rate: float
    original_dtype: str
    target_dtype: str
    converted_count: int
    total_count: int
    warnings: List[str] = field(default_factory=list)

class SmartDataCleaner:
    """智能数据清理器 - 尊重pandas原始类型推断"""
    
    def __init__(self, config: Optional[CleaningConfig] = None):
        self.config = config or CleaningConfig()
        self.cleaning_log: Dict[str, Dict[str, Any]] = {}
    
    def clean_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        智能清洗DataFrame
        
        策略：
        1. 保持pandas原始推断的数值类型不变
        2. 只对object类型进行智能类型推断
        3. 采用保守的转换策略，避免过度转换
        """
        logger.info(f"开始智能数据清理: {len(df)} 行 x {len(df.columns)} 列")
        
        cleaned_df = df.copy()
        self.cleaning_log = {}
        
        for column in df.columns:
            try:
                original_series = df[column]
                cleaned_series = self._clean_column(original_series, column)
                cleaned_df[column] = cleaned_series
                
            except Exception as e:
                logger.error(f"清理列 '{column}' 时出错: {str(e)}")
                cleaned_df[column] = df[column]  # 保持原始数据
        
        self._log_cleaning_summary(df, cleaned_df)
        return cleaned_df
    
    def _clean_column(self, series: pd.Series, column_name: str) -> pd.Series:
        """清理单个列"""
        original_dtype = str(series.dtype)
        
        # 记录原始信息
        column_log = {
            'original_dtype': original_dtype,
            'original_count': len(series),
            'original_null_count': series.isna().sum(),
            'steps': []
        }
        
        # 步骤1：基础清理（不改变类型）
        cleaned_series = self._basic_cleaning(series, column_log)
        
        # 步骤2：智能类型推断（仅对object类型）
        if original_dtype == 'object' and self.config.enable_smart_inference:
            inferred_series = self._smart_type_inference(cleaned_series, column_name, column_log)
            final_series = inferred_series
        else:
            # 保持pandas原始类型推断
            final_series = cleaned_series
            column_log['steps'].append({
                'step': 'type_preservation',
                'action': f'保持pandas原始类型: {original_dtype}',
                'reason': 'pandas已正确推断类型' if original_dtype != 'object' else '禁用智能推断'
            })
        
        # 记录最终结果
        column_log['final_dtype'] = str(final_series.dtype)
        column_log['final_null_count'] = final_series.isna().sum()
        column_log['type_changed'] = original_dtype != str(final_series.dtype)
        
        self.cleaning_log[column_name] = column_log
        
        return final_series
    
    def _basic_cleaning(self, series: pd.Series, log: Dict) -> pd.Series:
        """基础清理：去空格、标准化null值，但不改变数据类型"""
        cleaned = series.copy()
        changes = 0
        
        if series.dtype == 'object':
            # 只对object类型进行字符串清理
            if self.config.trim_strings:
                before_trim = cleaned.copy()
                # 安全的字符串处理
                string_mask = cleaned.notna() & (cleaned.astype(str) != 'nan')
                if string_mask.any():
                    cleaned.loc[string_mask] = cleaned.loc[string_mask].astype(str).str.strip()
                    trim_changes = (before_trim != cleaned).sum()
                    changes += trim_changes
                    if trim_changes > 0:
                        log['steps'].append({
                            'step': 'trim_strings',
                            'changes': trim_changes,
                            'action': '去除首尾空格'
                        })
            
            if self.config.normalize_whitespace:
                before_normalize = cleaned.copy()
                string_mask = cleaned.notna() & (cleaned.astype(str) != 'nan')
                if string_mask.any():
                    cleaned.loc[string_mask] = cleaned.loc[string_mask].astype(str).str.replace(r'\s+', ' ', regex=True)
                    normalize_changes = (before_normalize != cleaned).sum()
                    changes += normalize_changes
                    if normalize_changes > 0:
                        log['steps'].append({
                            'step': 'normalize_whitespace',
                            'changes': normalize_changes,
                            'action': '标准化空白字符'
                        })
        
        # 标准化null值（对所有类型）
        if self.config.standardize_nulls:
            null_changes = self._standardize_nulls(cleaned)
            changes += null_changes
            if null_changes > 0:
                log['steps'].append({
                    'step': 'standardize_nulls',
                    'changes': null_changes,
                    'action': '标准化空值表示'
                })
        
        return cleaned
    
    def _standardize_nulls(self, series: pd.Series) -> int:
        """标准化空值表示, 并修改为None"""
        if series.dtype != 'object':
            return 0
        
        changes = 0
        for null_val in self.config.null_values:
            if null_val == '':
                # 处理空字符串
                mask = (series == '') | (series.astype(str).str.strip() == '')
            else:
                mask = (series.astype(str).str.strip() == null_val)
            
            if mask.any():
                count = mask.sum()
                # series.loc[mask] = np.nan
                series.loc[mask] = None
                changes += count
        
        return changes
    
    def _smart_type_inference(self, series: pd.Series, column_name: str, log: Dict) -> pd.Series:
        """智能类型推断 - 仅对object类型"""
        
        # 尝试各种类型转换
        candidates = []
        
        # 1. 尝试数值转换
        numeric_result = self._try_numeric_conversion(series, column_name)
        if numeric_result.success_rate >= self.config.numeric_threshold:
            candidates.append(('numeric', numeric_result))
        
        # 2. 尝试日期转换
        datetime_result = self._try_datetime_conversion(series, column_name)
        if datetime_result.success_rate >= self.config.datetime_threshold:
            candidates.append(('datetime', datetime_result))
        
        # 3. 尝试布尔转换
        boolean_result = self._try_boolean_conversion(series, column_name)
        if boolean_result.success_rate >= self.config.boolean_threshold:
            candidates.append(('boolean', boolean_result))
        
        # 选择最佳候选
        if candidates:
            # 按成功率排序，选择最高的
            best_type, best_result = max(candidates, key=lambda x: x[1].success_rate)
            
            log['steps'].append({
                'step': 'smart_inference',
                'chosen_type': best_type,
                'success_rate': best_result.success_rate,
                'converted_count': best_result.converted_count,
                'total_count': best_result.total_count,
                'action': f'转换为{best_result.target_dtype}',
                'warnings': best_result.warnings
            })
            
            return best_result.series
        else:
            # 没有合适的转换，保持为字符串
            string_series = series.apply(lambda x: str(x) if x is not None else None)
            log['steps'].append({
                'step': 'keep_as_string',
                'action': '保持为字符串类型',
                'reason': '没有找到合适的类型转换'
            })
            return string_series
    
    def _try_numeric_conversion(self, series: pd.Series, column_name: str) -> ConversionResult:
        """尝试数值转换"""
        warnings = []
        
        try:
            # 清理数值字符串
            cleaned_strings = self._clean_numeric_strings(series)
            
            # 处理百分号
            percentage_mask = cleaned_strings.str.contains('%', na=False)
            if percentage_mask.any():
                clean_series = cleaned_strings.str.replace('%', '', regex=False)
                numeric_series = pd.to_numeric(clean_series, errors='coerce')
                # 百分号转换为小数 - 使用安全的方式更新值
                if percentage_mask.sum() > 0:
                    percentage_values = numeric_series.loc[percentage_mask] / 100
                    # 创建新的Series避免dtype冲突
                    result_series = numeric_series.copy()
                    result_series = result_series.astype('float64')  # 确保是float类型
                    result_series.loc[percentage_mask] = percentage_values
                    numeric_series = result_series
            else:
                numeric_series = pd.to_numeric(cleaned_strings, errors='coerce')
            
            # 计算成功率
            total_non_null = series.notna().sum()
            converted_count = numeric_series.notna().sum()
            success_rate = converted_count / total_non_null if total_non_null > 0 else 0
            
            # 尝试转换为整数（如果合适）
            if success_rate >= self.config.numeric_threshold and numeric_series.notna().any():
                is_integer = numeric_series.dropna().apply(lambda x: float(x).is_integer()).all()
                if is_integer and not percentage_mask.any():
                    try:
                        numeric_series = numeric_series.astype('Int64')  # 可空整数
                        target_dtype = 'Int64'
                    except:
                        target_dtype = 'float64'
                else:
                    target_dtype = 'float64'
            else:
                target_dtype = 'float64'
            
            if success_rate < 1.0 and total_non_null > 0:
                failed_count = total_non_null - converted_count
                warnings.append(f"有 {failed_count} 个值无法转换为数值")
            
            return ConversionResult(
                success=success_rate >= self.config.numeric_threshold,
                series=numeric_series,
                success_rate=success_rate,
                original_dtype='object',
                target_dtype=target_dtype,
                converted_count=converted_count,
                total_count=total_non_null,
                warnings=warnings
            )
            
        except Exception as e:
            warnings.append(f"数值转换错误: {str(e)}")
            return ConversionResult(
                success=False,
                series=series,
                success_rate=0.0,
                original_dtype='object',
                target_dtype='object',
                converted_count=0,
                total_count=series.notna().sum(),
                warnings=warnings
            )
    
    def _clean_numeric_strings(self, series: pd.Series) -> pd.Series:
        """清理数值字符串"""
        if series.dtype != 'object':
            return series
        
        cleaned = series.astype(str)
        
        # 移除货币符号
        for symbol in self.config.currency_symbols:
            cleaned = cleaned.str.replace(symbol, '', regex=False)
        
        # 移除千分位分隔符
        if self.config.thousand_separator:
            cleaned = cleaned.str.replace(self.config.thousand_separator, '', regex=False)
        
        # 清理空白字符
        cleaned = cleaned.str.strip()
        
        return cleaned
    
    def _try_datetime_conversion(self, series: pd.Series, column_name: str) -> ConversionResult:
        """尝试日期时间转换"""
        warnings = []
        
        try:
            string_series = series.astype(str)
            
            # 先进行简单的日期格式检测，避免不必要的转换尝试
            sample_size = min(10, len(string_series.dropna()))
            if sample_size == 0:
                return ConversionResult(
                    success=False,
                    series=series,
                    success_rate=0.0,
                    original_dtype='object',
                    target_dtype='object',
                    converted_count=0,
                    total_count=0,
                    warnings=['没有可用的数据进行日期转换']
                )
            
            sample_data = string_series.dropna().head(sample_size)
            
            # 检查是否包含明显的日期模式
            date_patterns = [
                r'\d{4}[-/]\d{1,2}[-/]\d{1,2}',  # 2023-12-25 或 2023/12/25
                r'\d{1,2}[-/]\d{1,2}[-/]\d{4}',  # 25-12-2023 或 25/12/2023
                r'\d{4}年\d{1,2}月\d{1,2}日',    # 2023年12月25日
                r'\d{1,2}/\d{1,2}/\d{2,4}',      # 12/25/23 或 12/25/2023
            ]
            
            has_date_pattern = False
            for pattern in date_patterns:
                if sample_data.str.contains(pattern, na=False).any():
                    has_date_pattern = True
                    break
            
            if not has_date_pattern:
                # 如果没有明显的日期模式，直接返回失败
                return ConversionResult(
                    success=False,
                    series=series,
                    success_rate=0.0,
                    original_dtype='object',
                    target_dtype='object',
                    converted_count=0,
                    total_count=series.notna().sum(),
                    warnings=['数据中未发现日期模式']
                )
            
            # 首先尝试pandas自动推断，但抑制警告
            try:
                import warnings as warn_module
                with warn_module.catch_warnings():
                    warn_module.simplefilter("ignore", UserWarning)
                    datetime_series = pd.to_datetime(string_series, errors='coerce')
                    
                total_non_null = string_series.notna().sum()
                converted_count = datetime_series.notna().sum()
                success_rate = converted_count / total_non_null if total_non_null > 0 else 0
                
                if success_rate >= self.config.datetime_threshold:
                    if success_rate < 1.0:
                        failed_count = total_non_null - converted_count
                        warnings.append(f"有 {failed_count} 个值无法转换为日期")
                    
                    return ConversionResult(
                        success=True,
                        series=datetime_series,
                        success_rate=success_rate,
                        original_dtype='object',
                        target_dtype='datetime64[ns]',
                        converted_count=converted_count,
                        total_count=total_non_null,
                        warnings=warnings
                    )
            except:
                pass
            
            # 尝试指定格式
            for date_format in self.config.date_formats:
                try:
                    datetime_series = pd.to_datetime(string_series, format=date_format, errors='coerce')
                    total_non_null = string_series.notna().sum()
                    converted_count = datetime_series.notna().sum()
                    success_rate = converted_count / total_non_null if total_non_null > 0 else 0
                    
                    if success_rate >= self.config.datetime_threshold:
                        if success_rate < 1.0:
                            failed_count = total_non_null - converted_count
                            warnings.append(f"有 {failed_count} 个值无法转换为日期 (格式: {date_format})")
                        
                        return ConversionResult(
                            success=True,
                            series=datetime_series,
                            success_rate=success_rate,
                            original_dtype='object',
                            target_dtype='datetime64[ns]',
                            converted_count=converted_count,
                            total_count=total_non_null,
                            warnings=warnings
                        )
                except:
                    continue
            
            warnings.append("未找到合适的日期格式")
            return ConversionResult(
                success=False,
                series=series,
                success_rate=0.0,
                original_dtype='object',
                target_dtype='object',
                converted_count=0,
                total_count=series.notna().sum(),
                warnings=warnings
            )
            
        except Exception as e:
            warnings.append(f"日期转换错误: {str(e)}")
            return ConversionResult(
                success=False,
                series=series,
                success_rate=0.0,
                original_dtype='object',
                target_dtype='object',
                converted_count=0,
                total_count=series.notna().sum(),
                warnings=warnings
            )
    
    def _try_boolean_conversion(self, series: pd.Series, column_name: str) -> ConversionResult:
        """尝试布尔转换"""
        warnings = []
        
        try:
            # 检查唯一值数量
            unique_count = series.nunique()
            if unique_count > 10:  # 唯一值太多，不太可能是布尔列
                return ConversionResult(
                    success=False,
                    series=series,
                    success_rate=0.0,
                    original_dtype='object',
                    target_dtype='object',
                    converted_count=0,
                    total_count=series.notna().sum(),
                    warnings=['唯一值过多，不适合布尔转换']
                )
            
            # 创建布尔映射
            bool_mapping = {}
            for val in self.config.true_values:
                bool_mapping[val.lower()] = True
            for val in self.config.false_values:
                bool_mapping[val.lower()] = False
            
            # 转换
            string_series = series.astype(str).str.lower().str.strip()
            boolean_series = string_series.map(bool_mapping)
            
            # 计算成功率
            total_non_null = series.notna().sum()
            converted_count = boolean_series.notna().sum()
            success_rate = converted_count / total_non_null if total_non_null > 0 else 0
            
            if success_rate < 1.0 and total_non_null > 0:
                failed_count = total_non_null - converted_count
                warnings.append(f"有 {failed_count} 个值无法转换为布尔值")
            
            return ConversionResult(
                success=success_rate >= self.config.boolean_threshold,
                series=boolean_series,
                success_rate=success_rate,
                original_dtype='object',
                target_dtype='bool',
                converted_count=converted_count,
                total_count=total_non_null,
                warnings=warnings
            )
            
        except Exception as e:
            warnings.append(f"布尔转换错误: {str(e)}")
            return ConversionResult(
                success=False,
                series=series,
                success_rate=0.0,
                original_dtype='object',
                target_dtype='object',
                converted_count=0,
                total_count=series.notna().sum(),
                warnings=warnings
            )
    
    def _log_cleaning_summary(self, original_df: pd.DataFrame, cleaned_df: pd.DataFrame):
        """记录清理摘要"""
        total_changes = 0
        type_changes = {}
        
        for column in original_df.columns:
            original_dtype = str(original_df[column].dtype)
            cleaned_dtype = str(cleaned_df[column].dtype)
            
            if original_dtype != cleaned_dtype:
                type_changes[column] = f"{original_dtype} -> {cleaned_dtype}"
            
            column_log = self.cleaning_log.get(column, {})
            for step in column_log.get('steps', []):
                total_changes += step.get('changes', 0)
        
        logger.info(f"智能数据清理完成. 总变更: {total_changes}")
        if type_changes:
            logger.info(f"类型变更: {type_changes}")
    
    def get_cleaning_report(self) -> Dict[str, Any]:
        """获取详细的清理报告"""
        return {
            "total_columns": len(self.cleaning_log),
            "columns": self.cleaning_log,
            "summary": self._generate_summary()
        }
    
    def _generate_summary(self) -> Dict[str, Any]:
        """生成清理摘要"""
        summary = {
            "total_columns": len(self.cleaning_log),
            "type_changes": 0,
            "preserved_types": 0,
            "inference_applied": 0
        }
        
        for column, log in self.cleaning_log.items():
            if log.get('type_changed', False):
                summary["type_changes"] += 1
            else:
                summary["preserved_types"] += 1
            
            if any(step.get('step') == 'smart_inference' for step in log.get('steps', [])):
                summary["inference_applied"] += 1
        
        return summary

# 便利函数
def clean_dataframe_with_smart_strategy(df: pd.DataFrame, config: Optional[CleaningConfig] = None) -> pd.DataFrame:
    """
    使用智能策略清洗DataFrame
    
    Args:
        df: 原始DataFrame
        config: 清洗配置
        
    Returns:
        清洗后的DataFrame
    """
    cleaner = SmartDataCleaner(config)
    return cleaner.clean_dataframe(df)

def create_conservative_cleaner(
    numeric_threshold: float = 0.85,
    datetime_threshold: float = 0.80,
    boolean_threshold: float = 0.90
) -> SmartDataCleaner:
    """
    创建保守的数据清理器
    
    Args:
        numeric_threshold: 数值转换成功率阈值
        datetime_threshold: 日期转换成功率阈值  
        boolean_threshold: 布尔转换成功率阈值
        
    Returns:
        配置好的清理器
    """
    config = CleaningConfig(
        numeric_threshold=numeric_threshold,
        datetime_threshold=datetime_threshold,
        boolean_threshold=boolean_threshold
    )
    return SmartDataCleaner(config) 