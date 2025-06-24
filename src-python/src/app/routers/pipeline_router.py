"""
Pipeline processing API router.
Handles pipeline execution and node testing operations.
"""

import traceback
import logging

from app.services.pipeline_service import PipelineService
from fastapi import APIRouter, Header, Request
from app.utils import recursively_serialize_dict

from ..models import (
    APIResponse,
    PipelineRequest,
    TestNodeRequest,
)
from app.middleware.i18n_middleware import LocalizedAPIResponse
from app.decorators.i18n_error_handler import i18n_error_handler

# 设置日志
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

# 创建PipelineService实例
pipeline_service = PipelineService()


@router.post("/execute", response_model=APIResponse)
@i18n_error_handler
async def execute_pipeline_endpoint(request: PipelineRequest, headers: dict = Header(...)):
    """
    执行完整的数据处理pipeline（仅支持OUTPUT节点）

    Args:
        request: Pipeline执行请求，包含工作区ID、目标节点ID等参数

    Returns:
        APIResponse: 包含执行结果、执行时间、错误信息等
    """
    try:
        # 参数验证
        if not request.workspace_id and not request.workspace_config_json:
            # 直接使用翻译键，无需映射
            language = "zh"  # 默认语言，装饰器会处理实际语言检测
            return LocalizedAPIResponse.error(
                "validation.workspace_config_required", language=language
            )

        # 执行pipeline
        response_data = pipeline_service.execute_pipeline_from_request(
            workspace_id=request.workspace_id or None,
            workspace_config_json=request.workspace_config_json or None,
            execution_mode="production",  # api端点对应的是生产模式
        )

        # 转换为字典格式
        if hasattr(response_data, "dict"):
            data_dict = response_data.dict()
        elif hasattr(response_data, "model_dump"):
            data_dict = response_data.model_dump()
        else:
            data_dict = response_data

        # 处理可能包含NaN或无穷大值的数据
        normalized_data = recursively_serialize_dict(data_dict)

        # 记录执行结果
        success = normalized_data.get("result", {}).get("success", False)
        execution_time = normalized_data.get("execution_time", 0)
        logger.info(f"Pipeline执行完成: success={success}, time={execution_time}s")

        return APIResponse(success=True, data=normalized_data)

    except ValueError as e:
        # 参数验证错误 - 装饰器会自动处理
        raise
    except FileNotFoundError as e:
        # 工作区不存在错误 - 装饰器会自动处理
        raise
    except Exception as e:
        # 其他错误 - 装饰器会自动处理
        logger.error(f"执行pipeline时发生错误: {str(e)}", exc_info=True)
        traceback.print_exc()
        raise
    finally:
        pipeline_service.context_manager.cleanup_branch_contexts()


@router.post("/preview-node", response_model=APIResponse)
@i18n_error_handler
async def preview_node_endpoint(req: TestNodeRequest, request: Request):
    """
    预览单个节点的执行结果（新架构，根据节点类型返回自定义格式）

    Args:
        request: 节点预览请求，包含工作区ID、节点ID等参数

    Returns:
        APIResponse: 包含节点类型特定的预览结果
    """
    try:
        logger.info(
            f"开始预览节点: workspace_id={req.workspace_id}, node_id={req.node_id}, has_config_json={bool(req.workspace_config_json)}"
        )

        # 参数验证 - 直接使用翻译键
        if not req.node_id:
            language = "zh"  # 默认语言，装饰器会处理实际语言检测
            return LocalizedAPIResponse.error(
                "validation.node_id_required", language=language
            )

        if not req.workspace_config_json and not req.workspace_id:
            language = "zh"
            return LocalizedAPIResponse.error(
                "validation.workspace_config_required", language=language
            )

        # 预览节点
        response_data = pipeline_service.preview_node(
            node_id=req.node_id,
            test_mode_max_rows=req.test_mode_max_rows,
            workspace_id=req.workspace_id,
            workspace_config_json=req.workspace_config_json,
        )

        # 处理可能包含NaN或无穷大值的数据
        normalized_data = recursively_serialize_dict(response_data)

        # 记录预览结果
        success = normalized_data.get("success", False)
        node_type = normalized_data.get("node_type", "unknown")
        logger.info(f"节点预览完成: success={success}, node_type={node_type}")

        return APIResponse(success=True, data=normalized_data)

    except ValueError as e:
        # 参数验证错误 - 装饰器会自动处理
        raise
    except FileNotFoundError as e:
        # 工作区不存在错误 - 装饰器会自动处理
        raise
    except Exception as e:
        # 其他错误 - 装饰器会自动处理
        logger.error(f"预览节点时发生错误: {str(e)}", exc_info=True)
        traceback.print_exc()
        raise
    finally:
        pipeline_service.context_manager.cleanup_branch_contexts()


@router.get("/health", response_model=APIResponse)
@i18n_error_handler
async def pipeline_health_check(request: Request):
    """
    Pipeline系统健康检查

    Returns:
        APIResponse: 系统状态信息
    """
    try:
        # 简单的健康检查
        from pipeline import __version__

        # 使用翻译键创建响应
        language = "zh"  # 默认语言
        health_data = {
            "status": "healthy",
            "service": "pipeline-service",
            "version": __version__,
            "message": "Pipeline系统运行正常",  # 这个可以保留中文，因为是系统内部消息
        }

        logger.info("Pipeline健康检查: 系统正常")
        return APIResponse(success=True, data=health_data)

    except Exception as e:
        # 装饰器会自动处理异常和本地化
        logger.error(f"Pipeline系统健康检查失败: {str(e)}", exc_info=True)
        raise


# ==================== DataFrame转换性能监控API ====================


@router.get("/dataframe-conversion-stats", response_model=APIResponse)
@i18n_error_handler
async def get_dataframe_conversion_stats(request: Request):
    """
    获取DataFrame转换性能统计

    Returns:
        APIResponse: DataFrame转换统计数据
    """
    try:
        stats = pipeline_service.get_dataframe_conversion_stats()
        return APIResponse(success=True, data=stats)
    except Exception as e:
        logger.error(f"获取DataFrame转换统计失败: {str(e)}", exc_info=True)
        raise


@router.post("/dataframe-conversion-stats/reset", response_model=APIResponse)
@i18n_error_handler
async def reset_dataframe_conversion_stats(request: Request):
    """
    重置DataFrame转换性能统计

    Returns:
        APIResponse: 重置结果
    """
    try:
        result = pipeline_service.reset_dataframe_conversion_stats()
        return APIResponse(success=True, data=result)
    except Exception as e:
        logger.error(f"重置DataFrame转换统计失败: {str(e)}", exc_info=True)
        raise


@router.post("/dataframe-conversion-stats/print", response_model=APIResponse)
@i18n_error_handler
async def print_dataframe_conversion_stats(request: Request):
    """
    打印DataFrame转换性能统计到服务器控制台

    Returns:
        APIResponse: 操作结果
    """
    try:
        pipeline_service.print_dataframe_conversion_stats()
        # 使用翻译键返回成功消息
        language = "zh"
        return LocalizedAPIResponse.success(
            data={"message": "统计已打印"},
            message_key="system.performance.stats_printed",
            language=language,
        )
    except Exception as e:
        logger.error(f"打印DataFrame转换统计失败: {str(e)}", exc_info=True)
        raise
