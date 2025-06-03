"""
Pipeline processing API router.
Handles pipeline execution and node testing operations.
"""

import traceback
import logging

from app.services.pipeline_service import PipelineService
from fastapi import APIRouter
from app.utils import recursively_serialize_dict

from ..models import (
    APIResponse,
    PipelineRequest,
    TestNodeRequest,
)

# 设置日志
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

# 创建PipelineService实例
pipeline_service = PipelineService()


@router.post("/execute", response_model=APIResponse)
async def execute_pipeline_endpoint(request: PipelineRequest):
    """
    执行完整的数据处理pipeline（仅支持OUTPUT节点）
    
    Args:
        request: Pipeline执行请求，包含工作区ID、目标节点ID等参数
        
    Returns:
        APIResponse: 包含执行结果、执行时间、错误信息等
    """
    try:
        logger.info(f"开始执行pipeline: workspace_id={request.workspace_id}, target_node_id={request.target_node_id}, mode={request.execution_mode}")
        
        # 参数验证
        if not request.workspace_id or not request.target_node_id:
            return APIResponse(
                success=False, 
                error="workspace_id和target_node_id不能为空"
            )
        
        # 执行pipeline
        response_data = pipeline_service.execute_pipeline_from_request(
            workspace_id=request.workspace_id,
            target_node_id=request.target_node_id,
            execution_mode=request.execution_mode,
            test_mode_max_rows=request.test_mode_max_rows,
            output_file_path=request.output_file_path
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
        # 参数验证错误
        error_msg = f"参数错误: {str(e)}"
        logger.warning(error_msg)
        return APIResponse(success=False, error=error_msg)
        
    except FileNotFoundError as e:
        # 工作区不存在错误
        error_msg = f"工作区不存在: {str(e)}"
        logger.warning(error_msg)
        return APIResponse(success=False, error=error_msg)
        
    except Exception as e:
        # 其他错误
        error_msg = f"执行pipeline时发生错误: {str(e)}"
        logger.error(error_msg, exc_info=True)
        traceback.print_exc()
        return APIResponse(success=False, error=error_msg)


@router.post("/preview-node", response_model=APIResponse)
async def preview_node_endpoint(request: TestNodeRequest):
    """
    预览单个节点的执行结果（新架构，根据节点类型返回自定义格式）
    
    Args:
        request: 节点预览请求，包含工作区ID、节点ID等参数
        
    Returns:
        APIResponse: 包含节点类型特定的预览结果
    """
    try:
        logger.info(f"开始预览节点: workspace_id={request.workspace_id}, node_id={request.node_id}")
        
        # 参数验证
        if not request.workspace_id or not request.node_id:
            return APIResponse(
                success=False,
                error="workspace_id和node_id不能为空"
            )
        
        # 预览节点
        response_data = pipeline_service.preview_node(
            workspace_id=request.workspace_id,
            node_id=request.node_id,
            test_mode_max_rows=request.test_mode_max_rows
        )
        
        # 处理可能包含NaN或无穷大值的数据
        normalized_data = recursively_serialize_dict(response_data)
        
        # 记录预览结果
        success = normalized_data.get("success", False)
        node_type = normalized_data.get("node_type", "unknown")
        logger.info(f"节点预览完成: success={success}, node_type={node_type}")
        
        return APIResponse(success=True, data=normalized_data)
        
    except ValueError as e:
        # 参数验证错误
        error_msg = f"参数错误: {str(e)}"
        logger.warning(error_msg)
        return APIResponse(success=False, error=error_msg)
        
    except FileNotFoundError as e:
        # 工作区不存在错误
        error_msg = f"工作区不存在: {str(e)}"
        logger.warning(error_msg)
        return APIResponse(success=False, error=error_msg)
        
    except Exception as e:
        # 其他错误
        error_msg = f"预览节点时发生错误: {str(e)}"
        logger.error(error_msg, exc_info=True)
        traceback.print_exc()
        return APIResponse(success=False, error=error_msg)


@router.post("/test-node", response_model=APIResponse)
async def test_pipeline_node_endpoint(request: TestNodeRequest):
    """
    测试pipeline中的单个节点（旧版兼容性接口）
    
    Args:
        request: 节点测试请求，包含工作区ID、节点ID等参数
        
    Returns:
        APIResponse: 包含节点执行结果、格式化输出、错误信息等
    """
    try:
        logger.info(f"开始测试节点（兼容模式）: workspace_id={request.workspace_id}, node_id={request.node_id}")
        
        # 参数验证
        if not request.workspace_id or not request.node_id:
            return APIResponse(
                success=False,
                error="workspace_id和node_id不能为空"
            )
        
        # 使用新的预览方法，但保持兼容性格式
        response_data = pipeline_service.preview_node(
            workspace_id=request.workspace_id,
            node_id=request.node_id,
            test_mode_max_rows=request.test_mode_max_rows
        )
        
        # 转换为旧版本兼容的格式
        if response_data.get("success"):
            # 为了兼容性，添加一些旧版本期望的字段
            response_data["execution_time_ms"] = response_data.get("execution_time_ms", 0.0)
            if "dataframe_previews" in response_data:
                # 如果有DataFrame预览，设置formatted_output
                response_data["formatted_output"] = {
                    "sheets": response_data["dataframe_previews"]
                }
            elif "preview_data" in response_data:
                # 如果有其他类型的预览数据
                response_data["formatted_output"] = response_data["preview_data"]
        
        # 处理可能包含NaN或无穷大值的数据
        normalized_data = recursively_serialize_dict(response_data)
        
        # 记录测试结果
        success = normalized_data.get("success", False)
        node_type = normalized_data.get("node_type", "unknown")
        logger.info(f"节点测试完成（兼容模式）: success={success}, node_type={node_type}")
        
        return APIResponse(success=True, data=normalized_data)
        
    except ValueError as e:
        # 参数验证错误
        error_msg = f"参数错误: {str(e)}"
        logger.warning(error_msg)
        return APIResponse(success=False, error=error_msg)
        
    except FileNotFoundError as e:
        # 工作区不存在错误
        error_msg = f"工作区不存在: {str(e)}"
        logger.warning(error_msg)
        return APIResponse(success=False, error=error_msg)
        
    except Exception as e:
        # 其他错误
        error_msg = f"测试节点时发生错误: {str(e)}"
        logger.error(error_msg, exc_info=True)
        traceback.print_exc()
        return APIResponse(success=False, error=error_msg)


@router.get("/health", response_model=APIResponse)
async def pipeline_health_check():
    """
    Pipeline系统健康检查
    
    Returns:
        APIResponse: 系统状态信息
    """
    try:
        # 简单的健康检查
        from pipeline import __version__
        
        health_data = {
            "status": "healthy",
            "service": "pipeline-service",
            "version": __version__,
            "message": "Pipeline系统运行正常"
        }
        
        logger.info("Pipeline健康检查: 系统正常")
        return APIResponse(success=True, data=health_data)
        
    except Exception as e:
        error_msg = f"Pipeline系统健康检查失败: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return APIResponse(success=False, error=error_msg)
