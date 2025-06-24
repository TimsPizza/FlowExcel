from fastapi import APIRouter, HTTPException, Request
from app.services.pipeline_service import PipelineService
from ..decorators.i18n_error_handler import i18n_error_handler

router = APIRouter(prefix="/performance", tags=["performance"])

@router.get("/report")
@i18n_error_handler
async def get_performance_report(request: Request):
    """获取性能监控报告"""
    try:
        service = PipelineService()
        report = service.get_performance_report()
        return {
            "success": True,
            "report": report
        }
    except Exception as e:
        # 装饰器会自动处理异常和本地化
        raise


@router.post("/print")
@i18n_error_handler
async def print_performance_report(request: Request):
    """打印性能监控报告到服务器控制台"""
    try:
        service = PipelineService()
        service.print_performance_report()
        return {
            "success": True,
            "message": "性能报告已打印到控制台"
        }
    except Exception as e:
        # 装饰器会自动处理异常和本地化
        raise


@router.post("/clear")
@i18n_error_handler
async def clear_performance_statistics(request: Request):
    """清空性能统计数据"""
    try:
        service = PipelineService()
        result = service.clear_performance_statistics()
        return result
    except Exception as e:
        # 装饰器会自动处理异常和本地化
        raise


@router.post("/enable")
@i18n_error_handler
async def enable_performance_monitoring(request: Request):
    """启用性能监控"""
    try:
        service = PipelineService()
        result = service.enable_performance_monitoring()
        return result
    except Exception as e:
        # 装饰器会自动处理异常和本地化
        raise


@router.post("/disable")
@i18n_error_handler
async def disable_performance_monitoring(request: Request):
    """禁用性能监控"""
    try:
        service = PipelineService()
        result = service.disable_performance_monitoring()
        return result
    except Exception as e:
        # 装饰器会自动处理异常和本地化
        raise 