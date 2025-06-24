"""
FastAPI i18n中间件
自动处理请求的语言头，并在响应中包含本地化的消息
"""

import logging
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable, Any
import json

from ..services.i18n_service import get_language_from_headers, get_localized_message


class I18nMiddleware(BaseHTTPMiddleware):
    """国际化中间件"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # 从请求头中提取语言
        language = get_language_from_headers(dict(request.headers))

        # 将语言信息添加到request state中，供后续处理使用
        request.state.language = language

        # 执行请求处理
        response = await call_next(request)

        # 如果是JSON响应，处理错误消息的本地化
        if isinstance(response, JSONResponse):
            response = await self._localize_json_response(response, language)

        return response

    async def _localize_json_response(
        self, response: JSONResponse, language: str
    ) -> JSONResponse:
        """本地化JSON响应中的消息"""
        try:
            # 获取响应内容
            response_body = b""
            async for chunk in response.body_iterator:
                response_body += chunk

            # 解析JSON
            response_data = json.loads(response_body.decode())

            # 本地化错误消息
            if not response_data.get("success", True) and "error" in response_data:
                error_msg = response_data["error"]
                # 如果错误消息是翻译键格式，则进行翻译
                if self._is_translation_key(error_msg):
                    response_data["error"] = get_localized_message(error_msg, language)

            # 创建新的响应
            return JSONResponse(
                content=response_data,
                status_code=response.status_code,
                headers=dict(response.headers),
            )

        except Exception as e:
            # 如果处理失败，返回原响应
            logging.error(f"I18n middleware error: {e}")
            return response

    def _is_translation_key(self, text: str) -> bool:
        """判断文本是否为翻译键"""
        # 简单判断：包含点号且不包含空格的字符串可能是翻译键
        return isinstance(text, str) and "." in text and " " not in text


class LocalizedAPIResponse:
    """本地化API响应工具类"""

    @staticmethod
    def success(
        data: Any = None,
        message_key: str = None,
        language: str = "zh",
        **message_params,
    ):
        """创建成功响应"""
        response_data = {"success": True, "data": data}

        if message_key:
            response_data["message"] = get_localized_message(
                message_key, language, **message_params
            )

        return JSONResponse(content=response_data)

    @staticmethod
    def error(
        error_key: str, language: str = "zh", status_code: int = 400, **error_params
    ):
        """创建错误响应"""
        error_message = get_localized_message(error_key, language, **error_params)

        response_data = {"success": False, "error": error_message}

        return JSONResponse(content=response_data, status_code=status_code)
