from fastapi import APIRouter, HTTPException
from app.services.pipeline_service import PipelineService

router = APIRouter(prefix="/performance", tags=["performance"])

@router.get("/report")
async def get_performance_report():
    """获取性能监控报告"""
    try:
        service = PipelineService()
        report = service.get_performance_report()
        return {
            "success": True,
            "report": report
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/print")
async def print_performance_report():
    """打印性能监控报告到服务器控制台"""
    try:
        service = PipelineService()
        service.print_performance_report()
        return {
            "success": True,
            "message": "性能报告已打印到控制台"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear")
async def clear_performance_statistics():
    """清空性能统计数据"""
    try:
        service = PipelineService()
        result = service.clear_performance_statistics()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/enable")
async def enable_performance_monitoring():
    """启用性能监控"""
    try:
        service = PipelineService()
        result = service.enable_performance_monitoring()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/disable")
async def disable_performance_monitoring():
    """禁用性能监控"""
    try:
        service = PipelineService()
        result = service.disable_performance_monitoring()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 