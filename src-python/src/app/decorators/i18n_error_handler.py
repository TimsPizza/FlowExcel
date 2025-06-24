"""
国际化错误处理装饰器
使用中间件已经提取好的语言信息，避免重复处理
"""

from functools import wraps
from typing import Callable
from fastapi import Request
import json

from app.middleware.i18n_middleware import LocalizedAPIResponse
from app.exceptions.i18n_exceptions import I18nException


def i18n_error_handler(func: Callable) -> Callable:
    """
    国际化错误处理装饰器
    
    使用中间件已经提取好的语言信息，自动处理各种异常类型
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # 尝试从参数中获取Request对象
        request = None
        for arg in args:
            if isinstance(arg, Request):
                request = arg
                break
        
        # 如果没有找到Request对象，检查kwargs
        if not request:
            request = kwargs.get('request')
        
        # 从中间件已处理的request.state中获取语言（避免重复解析）
        if request and hasattr(request.state, 'language'):
            language = request.state.language
        else:
            language = "zh"  # 默认语言（fallback）
        
        try:
            return await func(*args, **kwargs)
        except I18nException as e:
            # I18n异常已经包含本地化消息
            return LocalizedAPIResponse.error(
                e.message_key, language=language, **e.params
            )
        except ValueError as e:
            # 值错误
            return LocalizedAPIResponse.error(
                "error.invalid_value", language=language, error=str(e)
            )
        except FileNotFoundError as e:
            # 文件未找到
            return LocalizedAPIResponse.error(
                "error.file_not_found", language=language, file_path=str(e)
            )
        except PermissionError as e:
            # 权限错误
            return LocalizedAPIResponse.error(
                "error.permission_denied", language=language, file_path=str(e)
            )
        except json.JSONDecodeError as e:
            # JSON解析错误
            return LocalizedAPIResponse.error(
                "error.invalid_json", language=language, error=str(e)
            )
        except KeyError as e:
            # 键不存在错误
            return LocalizedAPIResponse.error(
                "error.key_not_found", language=language, key=str(e)
            )
        except TypeError as e:
            # 类型错误
            return LocalizedAPIResponse.error(
                "error.type_error", language=language, error=str(e)
            )
        except Exception as e:
            # 其他所有异常
            return LocalizedAPIResponse.error(
                "error.internal_server_error", language=language, error=str(e)
            )
    
    return wrapper


def api_route_i18n(func: Callable) -> Callable:
    """
    API路由国际化装饰器
    
    专门用于FastAPI路由函数的国际化错误处理
    使用中间件已经提取好的语言信息
    """
    @wraps(func)
    async def wrapper(request: Request, *args, **kwargs):
        # 从中间件已处理的request.state中获取语言
        language = getattr(request.state, 'language', 'zh')
        
        try:
            return await func(request, *args, **kwargs)
        except I18nException as e:
            return LocalizedAPIResponse.error(
                e.message_key, language=language, **e.params
            )
        except Exception as e:
            # 通用错误处理
            return LocalizedAPIResponse.error(
                "error.internal_server_error", language=language, error=str(e)
            )
    
    return wrapper
