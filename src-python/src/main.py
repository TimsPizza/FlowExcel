#!/usr/bin/env python3
"""
FastAPI REST API server for Tauri Excel application.
Modular architecture with separated routers and services.
"""

import os
import sys
import json
import socket
import asyncio
import threading
import time
import platform
import logging
import threading
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Add the current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models import APIResponse, HealthResponse
from app.routers import excel_router, pipeline_router, workspace_router, performance_routes

def find_available_port(start_port=11017, max_attempts=100):
    """
    Find an available port starting from start_port.
    Returns the first available port found.
    """
    for port in range(start_port, start_port + max_attempts):
        try:
            # Try to bind to the port
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            # Port is in use, try next one
            print(f"Port {port} is in use, trying next one", flush=True)
            continue
    
    raise RuntimeError(f"Could not find available port in range {start_port}-{start_port + max_attempts}")

def send_handshake(port, host="127.0.0.1"):
    """
    Send handshake information to stdout for the parent process to read.
    This establishes communication channel between backend and Tauri watchdog.
    """
    handshake_data = {
        "type": "handshake",
        "status": "ready",
        "host": host,
        "port": port,
        "api_base": f"http://{host}:{port}",
        "endpoints": {
            "health": f"http://{host}:{port}/health",
            "shutdown": f"http://{host}:{port}/shutdown"
        }
    }
    
    # Send handshake as JSON line to stdout
    print(f"HANDSHAKE:{json.dumps(handshake_data)}", flush=True)

# --- Heartbeat Mechanism ---

class HeartbeatManager:
    def __init__(self, timeout=30):
        self.last_heartbeat = time.time()
        self.timeout = timeout
        self._lock = threading.Lock()

    def record_heartbeat(self):
        with self._lock:
            self.last_heartbeat = time.time()

    def check_heartbeat(self):
        while True:
            time.sleep(self.timeout / 2)
            with self._lock:
                if time.time() - self.last_heartbeat > self.timeout:
                    logging.info(f"No heartbeat received in {self.timeout} seconds. Shutting down.")
                    os._exit(1)

heartbeat_manager = HeartbeatManager()

# --- FastAPI Application ---

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

@app.post("/heartbeat")
async def heartbeat():
    """Endpoint for the parent process to send heartbeats."""
    heartbeat_manager.record_heartbeat()
    return {"status": "ok"}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logging.info("Application startup...")
    monitor_thread = threading.Thread(target=heartbeat_manager.check_heartbeat, daemon=True)
    monitor_thread.start()
    yield
    # Shutdown
    logging.info("Application shutdown...")

app.router.lifespan_context = lifespan

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
    try:
        # Find available port
        port = find_available_port()
        host = "127.0.0.1"
        
        # Send handshake information to parent process
        send_handshake(port, host)
        
        # Start the server
        uvicorn.run(app, host=host, port=port, log_level="info", reload=False, access_log=False)
        
    except Exception as e:
        # Send error information to parent process
        error_data = {
            "type": "error",
            "status": "failed",
            "error": str(e)
        }
        print(f"ERROR:{json.dumps(error_data)}", flush=True)
        sys.exit(1)









