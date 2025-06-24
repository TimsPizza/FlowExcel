"""
国际化异常类
支持翻译键和语言参数，用于创建本地化的异常消息
"""

from typing import Optional, Dict, Any
from ..services.i18n_service import get_localized_message


class I18nException(Exception):
    """国际化异常基类"""
    
    def __init__(self, message_key: str, language: Optional[str] = None, **params):
        """
        初始化国际化异常
        
        Args:
            message_key: 翻译键
            language: 目标语言，如果为None则使用默认语言
            **params: 消息格式化参数
        """
        self.message_key = message_key
        self.language = language
        self.params = params
        
        # 获取本地化消息
        localized_message = get_localized_message(
            message_key, language, **params
        )
        
        super().__init__(localized_message)
    
    def get_localized_message(self, language: Optional[str] = None) -> str:
        """
        获取指定语言的本地化消息
        
        Args:
            language: 目标语言
            
        Returns:
            本地化消息
        """
        target_language = language or self.language
        return get_localized_message(
            self.message_key, target_language, **self.params
        )


class I18nValidationError(I18nException):
    """国际化验证错误"""
    pass


class I18nFileError(I18nException):
    """国际化文件错误"""
    pass


class I18nNodeProcessorError(I18nException):
    """国际化节点处理器错误"""
    pass


class I18nPipelineError(I18nException):
    """国际化流程错误"""
    pass


class I18nWorkspaceError(I18nException):
    """国际化工作区错误"""
    pass


class I18nSystemError(I18nException):
    """国际化系统错误"""
    pass


# 便捷函数用于创建常见的国际化异常
def create_validation_error(field_name: str, language: Optional[str] = None) -> I18nValidationError:
    """创建字段验证错误"""
    return I18nValidationError(
        "validation.required_field",
        language=language,
        field=field_name
    )


def create_file_not_found_error(file_path: str, language: Optional[str] = None) -> I18nFileError:
    """创建文件未找到错误"""
    return I18nFileError(
        "error.file_not_found",
        language=language,
        file_path=file_path
    )


def create_node_processor_error(node_type: str, error_key: str, language: Optional[str] = None, **params) -> I18nNodeProcessorError:
    """创建节点处理器错误"""
    return I18nNodeProcessorError(
        f"node_processor.{node_type}.{error_key}",
        language=language,
        **params
    )


def create_system_error(error_key: str, language: Optional[str] = None, **params) -> I18nSystemError:
    """创建系统错误"""
    return I18nSystemError(
        f"system.{error_key}",
        language=language,
        **params
    ) 