#!/usr/bin/env python3
"""
FastAPI REST API server for Tauri Excel application.
Modular architecture with separated routers and services.
"""

import os
import sys
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Add the current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models import APIResponse, HealthResponse
from app.routers import excel_router, pipeline_router, workspace_router, performance_routes

# Create FastAPI application
app = FastAPI(
    title="Excel Processing API",
    version="1.0.0",
    description="REST API for Excel file processing and data pipeline operations"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(excel_router)
app.include_router(pipeline_router)
app.include_router(workspace_router)
app.include_router(performance_routes)

@app.get("/health", response_model=APIResponse)
async def health_check():
    """Health check endpoint."""
    health_data = HealthResponse(status="healthy", service="excel-processing-api")
    return APIResponse(success=True, data=health_data.dict())


@app.post("/shutdown", response_model=APIResponse)
async def shutdown():
    """Shutdown the API server."""
    def stop_server():
        # This will be called after the response is sent
        os._exit(0)
    
    # Schedule the shutdown after a short delay
    asyncio.get_event_loop().call_later(0.1, stop_server)
    
    return APIResponse(success=True, data={"message": "Server shutting down"})

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=11017, log_level="info", reload=True)