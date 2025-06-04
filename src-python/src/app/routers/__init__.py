"""
API routers package.
Contains modular router definitions for different API endpoints.
"""

from .excel_router import router as excel_router
from .pipeline_router import router as pipeline_router
from .workspace_router import router as workspace_router
from .performance_routes import router as performance_routes

__all__ = ["excel_router", "pipeline_router", "workspace_router", "performance_routes"] 