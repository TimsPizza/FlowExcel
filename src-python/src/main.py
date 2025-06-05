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
import select
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

def start_heartbeat_monitor():
    """
    Start heartbeat monitoring in a separate thread.
    Python sends HEARTBEAT to Tauri via stdout periodically.
    Waits for HEARTBEAT_ACK from Tauri via stdin.
    If no ACK received within timeout, assumes Tauri is dead and exits.
    """
    def heartbeat_worker():
        print("Starting heartbeat sender (Python -> Tauri)", flush=True)
        
        heartbeat_interval = 5  # Send heartbeat every 5 seconds
        heartbeat_timeout = 15  # Wait max 15 seconds for ACK
        failure_count = 0
        max_failures = 3
        
        # Get parent process ID for monitoring
        parent_pid = os.getppid()
        print(f"Parent process PID: {parent_pid}", flush=True)
        
        while True:
            try:
                # Check if parent process is still alive
                try:
                    os.kill(parent_pid, 0)  # Signal 0 just checks if process exists
                except OSError:
                    print("Parent process no longer exists, exiting...", flush=True)
                    os._exit(1)
                
                # Send heartbeat to Tauri
                print("HEARTBEAT", flush=True)
                heartbeat_sent_time = time.time()
                
                # Wait for ACK from Tauri via stdin
                ack_received = False
                timeout_time = heartbeat_sent_time + heartbeat_timeout
                
                while time.time() < timeout_time:
                    if select.select([sys.stdin], [], [], 1):  # 1 second timeout for select
                        line = sys.stdin.readline().strip()
                        
                        if line == "HEARTBEAT_ACK":
                            print(f"Received HEARTBEAT_ACK from Tauri", flush=True)
                            ack_received = True
                            failure_count = 0  # Reset failure count on success
                            break
                        elif line == "":
                            # EOF reached, parent process closed stdin
                            print("Stdin closed by parent process, exiting...", flush=True)
                            os._exit(1)
                
                if not ack_received:
                    failure_count += 1
                    print(f"No HEARTBEAT_ACK received within {heartbeat_timeout}s (failures: {failure_count}/{max_failures})", flush=True)
                    
                    if failure_count >= max_failures:
                        print(f"Failed to receive heartbeat ACK {max_failures} times. Tauri appears to be dead. Exiting...", flush=True)
                        os._exit(1)
                
                # Wait before next heartbeat
                time.sleep(heartbeat_interval)
                
            except Exception as e:
                print(f"Heartbeat monitor error: {e}", flush=True)
                failure_count += 1
                if failure_count >= max_failures:
                    print(f"Too many heartbeat errors ({failure_count}). Exiting...", flush=True)
                    os._exit(1)
                time.sleep(1)
    
    # Start heartbeat thread as daemon so it doesn't prevent shutdown
    heartbeat_thread = threading.Thread(target=heartbeat_worker, daemon=True)
    heartbeat_thread.start()
    print("Python heartbeat sender thread started", flush=True)

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
    try:
        # Find available port
        port = find_available_port()
        host = "127.0.0.1"
        
        # Send handshake information to parent process
        send_handshake(port, host)
        
        # Start heartbeat monitoring
        start_heartbeat_monitor()
        
        # Start the server
        uvicorn.run(app, host=host, port=port, log_level="info", reload=False)
        
    except Exception as e:
        # Send error information to parent process
        error_data = {
            "type": "error",
            "status": "failed",
            "error": str(e)
        }
        print(f"ERROR:{json.dumps(error_data)}", flush=True)
        sys.exit(1)