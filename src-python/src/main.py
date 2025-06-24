#!/usr/bin/env python3
"""
FastAPI REST API server for Tauri Excel application.
Simplified and robust process management using a watchdog pattern.
"""

import os
import sys
import time
import platform
import logging
import threading
import uvicorn
import socket
import json
import argparse
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models import APIResponse, HealthResponse
from app.routers import (
    excel_router,
    pipeline_router,
    workspace_router,
    performance_routes,
)
from app.utils import resource_path  # Import our new utility
from app.middleware.i18n_middleware import I18nMiddleware


def find_available_port(start_port=11017, max_attempts=100) -> int:
    """Finds an available TCP port on 127.0.0.1."""
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                logging.debug(f"Port {port} is in use, trying next.")
                continue
    raise RuntimeError(
        f"Could not find an available port in range {start_port}-{start_port + max_attempts}"
    )


def send_handshake(port: int):
    """Sends a handshake message to stdout for Tauri to capture."""
    host = "127.0.0.1"
    api_base = f"http://{host}:{port}"
    handshake_data = {
        "host": host,
        "port": port,
        "api_base": api_base,
        "endpoints": {
            "health": f"{api_base}/health",
            "shutdown": f"{api_base}/shutdown",
        },
    }
    print(f"HANDSHAKE:{json.dumps(handshake_data)}", flush=True)


# --- Watchdog for Parent Process Monitoring ---


class Watchdog:
    """
    Monitors a heartbeat timestamp. If the timestamp is not updated
    within the timeout period, it triggers a shutdown of the application.
    This replaces the unreliable PPID checking.
    """

    def __init__(self, timeout_seconds=15):
        self.last_ping_time = time.time()
        self.timeout = timeout_seconds
        self._stop_event = threading.Event()
        self.monitor_thread = threading.Thread(target=self._monitor, daemon=True)

    def start(self):
        logging.info("Starting parent process watchdog.")
        self.monitor_thread.start()

    def stop(self):
        logging.info("Stopping parent process watchdog.")
        self._stop_event.set()
        # Optional: wait for the thread to finish
        self.monitor_thread.join(timeout=2)

    def record_ping(self):
        """Called by the /ping endpoint to update the last contact time."""
        self.last_ping_time = time.time()
        logging.debug("Ping received. Resetting watchdog timer.")

    def _monitor(self):
        while not self._stop_event.is_set():
            if time.time() - self.last_ping_time > self.timeout:
                logging.warning(
                    f"No ping from parent process in over {self.timeout} seconds. "
                    "Parent is likely dead. Shutting down."
                )
                # Use os._exit for an immediate and forceful exit,
                # suitable for when the parent has crashed.
                os._exit(1)

            # Sleep for a short interval before checking again
            self._stop_event.wait(2)


# Global instance of our watchdog
watchdog = Watchdog()

# Global flag to track if ping/watchdog is enabled
PING_ENABLED = False


# --- FastAPI Application Setup ---


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles application startup and shutdown events.
    """
    # Startup
    logging.info("Application starting up...")
    if PING_ENABLED:
        logging.info("Ping mechanism enabled, starting watchdog...")
        watchdog.start()
    else:
        logging.info("Ping mechanism disabled, watchdog not started")
    yield
    # Shutdown
    logging.info("Application shutting down...")
    if PING_ENABLED:
        logging.info("Stopping watchdog...")
        watchdog.stop()


app = FastAPI(
    title="Excel Processing API",
    version="1.0.0",
    description="REST API for Excel file processing and data pipeline operations.",
    lifespan=lifespan,
)

# Add CORS middleware to allow requests from the Tauri frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can restrict this to tauri's origin in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add i18n middleware for internationalization support
app.add_middleware(I18nMiddleware)

# --- API Endpoints ---


@app.get("/ping")
async def ping_from_parent():
    """
    Heartbeat endpoint for the Tauri frontend to call periodically.
    This tells the backend that the main application is still alive.
    """
    watchdog.record_ping()
    return {"status": "alive"}


@app.get("/health", response_model=APIResponse)
async def health_check():
    """Basic health check endpoint."""
    health_data = HealthResponse(status="healthy", service="excel-processing-api")
    return APIResponse(success=True, data=health_data.dict())


# Include other API routers
app.include_router(excel_router)
app.include_router(pipeline_router)
app.include_router(workspace_router)
app.include_router(performance_routes)


# --- Main Execution ---


def main():
    """
    Main entry point to start the FastAPI server.
    Finds an available port, sends a handshake to stdout, and then starts the server.
    """
    global PING_ENABLED

    # Parse command line arguments to check for --enable-ping flag
    parser = argparse.ArgumentParser(
        description="FastAPI backend for Tauri Excel application"
    )
    parser.add_argument(
        "--enable-ping",
        action="store_true",
        help="Enable keep-alive ping mechanism for production environments",
    )
    args = parser.parse_args()

    # Set global ping flag based on command line argument
    PING_ENABLED = args.enable_ping

    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
        stream=sys.stdout,  # Ensure logs go to stdout to be captured by Tauri
    )

    logging.info(
        f"Starting backend with ping mechanism {'enabled' if PING_ENABLED else 'disabled'}"
    )
    if PING_ENABLED:
        logging.info("Production mode: Keep-alive watchdog will be started")
    else:
        logging.info("Development mode: Keep-alive watchdog disabled")

    # On Windows, ensure UTF-8 encoding is used for stdout
    if platform.system() == "Windows":
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8")

    try:
        port = find_available_port()

        # Start the Uvicorn server in the main thread
        # The handshake is sent right before running the server
        send_handshake(port)

        uvicorn.run(
            app,
            host="127.0.0.1",
            port=port,
            log_config=None,  # We use our own basicConfig
        )
    except Exception as e:
        logging.error(f"Failed to start server: {e}")
        # Optionally, send an error handshake
        error_handshake = {"status": "error", "message": str(e)}
        print(f"HANDSHAKE:{json.dumps(error_handshake)}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
