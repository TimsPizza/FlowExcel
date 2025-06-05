#!/usr/bin/env python3
"""
Python backend main entry point for Excel processing application.
This will be packaged into a binary using PyInstaller in the future.
"""

import time
import logging
import signal
import sys
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ExcelBackend:
    """Main backend service for Excel processing"""
    
    def __init__(self):
        self.running = False
        
    def start(self):
        """Start the backend service"""
        self.running = True
        logger.info("Excel backend service started")
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
        
        try:
            # Main service loop
            while self.running:
                # Simulate backend work
                time.sleep(1)
                
                # Optional: Add heartbeat logging (can be removed in production)
                if int(time.time()) % 30 == 0:  # Log every 30 seconds
                    logger.info("Backend service is running...")
                    
        except Exception as e:
            logger.error(f"Backend service error: {e}")
            sys.exit(1)
        finally:
            logger.info("Backend service stopped")
    
    def stop(self):
        """Stop the backend service"""
        logger.info("Stopping backend service...")
        self.running = False
        
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, shutting down...")
        self.stop()

def main():
    """Main entry point"""
    logger.info("Starting Excel backend application")
    
    # Create and start the backend service
    backend = ExcelBackend()
    
    try:
        backend.start()
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)
    finally:
        backend.stop()

if __name__ == "__main__":
    main() 