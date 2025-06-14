"""
后端国际化服务
负责根据请求语言返回对应的错误消息和状态信息
"""

import json
import os
from typing import Dict, Optional
from functools import lru_cache
from pathlib import Path


class I18nService:
    """国际化服务"""
    
    def __init__(self):
        self.default_language = "zh"
        self.fallback_language = "en"
        self.locales_dir = Path(__file__).parent.parent / "locales"
        self._translations: Dict[str, Dict] = {}
    
    def load_translations(self):
        """加载翻译文件"""
        if not self.locales_dir.exists():
            return
        
        for locale_file in self.locales_dir.glob("*.json"):
            language = locale_file.stem
            try:
                with open(locale_file, 'r', encoding='utf-8') as f:
                    self._translations[language] = json.load(f)
            except Exception as e:
                print(f"Failed to load translation file {locale_file}: {e}")
    
    @lru_cache(maxsize=128)
    def get_message(self, key: str, language: Optional[str] = None, **kwargs) -> str:
        """
        获取翻译消息
        
        Args:
            key: 翻译键，支持嵌套格式如 'error.file_not_found'
            language: 目标语言，如果为None则使用默认语言
            **kwargs: 用于字符串格式化的参数
            
        Returns:
            翻译后的消息
        """
        if not self._translations:
            self.load_translations()
        
        # 确定使用的语言
        target_lang = language or self.default_language
        
        # 尝试获取翻译
        translation = self._get_nested_value(
            self._translations.get(target_lang, {}), key
        )
        
        # 如果没找到，尝试回退语言
        if translation is None and target_lang != self.fallback_language:
            translation = self._get_nested_value(
                self._translations.get(self.fallback_language, {}), key
            )
        
        # 如果仍然没找到，返回原键
        if translation is None:
            return key
        
        # 格式化字符串
        try:
            return translation.format(**kwargs) if kwargs else translation
        except (KeyError, ValueError):
            return translation
    
    def _get_nested_value(self, data: Dict, key: str):
        """获取嵌套字典中的值"""
        keys = key.split('.')
        current = data
        
        for k in keys:
            if isinstance(current, dict) and k in current:
                current = current[k]
            else:
                return None
        
        return current
    
    def extract_language_from_request(self, accept_language: Optional[str]) -> str:
        """
        从Accept-Language头中提取语言
        
        Args:
            accept_language: Accept-Language头的值
            
        Returns:
            提取的语言代码
        """
        if not accept_language:
            return self.default_language
        
        # 简单解析Accept-Language头
        # 格式: "zh-CN,zh;q=0.9,en;q=0.8"
        languages = []
        for lang_item in accept_language.split(','):
            lang_item = lang_item.strip()
            if ';' in lang_item:
                lang, q = lang_item.split(';', 1)
                try:
                    q_value = float(q.split('=')[1])
                except (ValueError, IndexError):
                    q_value = 1.0
            else:
                lang = lang_item
                q_value = 1.0
            
            # 规范化语言代码
            lang = lang.strip().lower()
            if lang.startswith('zh'):
                lang = 'zh'
            elif lang.startswith('en'):
                lang = 'en'
            
            languages.append((lang, q_value))
        
        # 按优先级排序
        languages.sort(key=lambda x: x[1], reverse=True)
        
        # 返回支持的第一个语言
        supported_languages = set(self._translations.keys())
        for lang, _ in languages:
            if lang in supported_languages:
                return lang
        
        return self.default_language


# 全局i18n服务实例
i18n_service = I18nService()


def get_localized_message(key: str, language: Optional[str] = None, **kwargs) -> str:
    """获取本地化消息的便捷函数"""
    return i18n_service.get_message(key, language, **kwargs)


def get_language_from_headers(headers: dict) -> str:
    """从请求头中获取语言"""
    accept_language = headers.get('accept-language') or headers.get('Accept-Language')
    return i18n_service.extract_language_from_request(accept_language) 