#!/usr/bin/env python3
"""
Python daemon service for Tauri Excel application.
Runs as a subprocess and communicates via stdin/stdout using JSON messages.
"""

import sys
import json
import traceback
import os
from typing import Dict, Any, Optional
from excel_ops import (
    get_excel_preview,
    try_read_header_row,
    get_index_values,
    try_read_sheet_names,
)
from utils import normalize_response
from pipeline import execute_pipeline
import debugpy


class ExcelDaemon:
    """Excel processing daemon that handles commands via JSON messages."""
    
    def __init__(self):
        self.running = True
        
    def handle_command(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Handle a single command and return the result."""
        try:
            cmd_type = command.get("type")
            params = command.get("params", {})
            
            if cmd_type == "preview_excel_data":
                result = get_excel_preview(file_path=params["file_path"])
                return {"success": True, "data": result}
                
            elif cmd_type == "get_index_values":
                result = get_index_values(
                    file_path=params["file_path"],
                    sheet_name=params["sheet_name"],
                    header_row=params["header_row"],
                    column_name=params["column_name"]
                )
                return {"success": True, "data": result}
                
            elif cmd_type == "try_read_header_row":
                result = try_read_header_row(
                    file_path=params["file_path"],
                    sheet_name=params["sheet_name"],
                    header_row=params["header_row"]
                )
                return {"success": True, "data": result}
                
            elif cmd_type == "try_read_sheet_names":
                result = try_read_sheet_names(file_path=params["file_path"])
                return {"success": True, "data": result}
                
            elif cmd_type == "execute_pipeline":
                # TODO: 实现新的pipeline执行逻辑
                # 需要将JSON转换为ExecutePipelineRequest
                return {"success": False, "error": "Pipeline execution not yet implemented with new system"}
                
            elif cmd_type == "test_pipeline_node":
                # TODO: 实现新的节点测试逻辑
                return {"success": False, "error": "Node testing not yet implemented with new system"}
                
            elif cmd_type == "shutdown":
                self.running = False
                return {"success": True, "data": "Daemon shutting down"}
                
            else:
                return {"success": False, "error": f"Unknown command type: {cmd_type}"}
                
        except Exception as e:
            error_msg = f"Error executing command {cmd_type}: {str(e)}"
            traceback.print_exc(file=sys.stderr)
            return {"success": False, "error": error_msg}
    
    def run(self):
        """Main daemon loop - read commands from stdin and write responses to stdout."""
        # Send ready signal
        ready_msg = {"success": True, "data": "Python daemon ready"}
        print(json.dumps(ready_msg), flush=True)
        
        # Log daemon start
        import sys
        print(f"Python daemon started with PID: {os.getpid()}", file=sys.stderr, flush=True)
        
        while self.running:
            try:
                # Read command from stdin
                line = sys.stdin.readline()
                if not line:
                    # EOF reached, exit gracefully
                    break
                    
                line = line.strip()
                if not line:
                    continue
                    
                # Parse JSON command
                try:
                    command = json.loads(line)
                except json.JSONDecodeError as e:
                    error_response = {"success": False, "error": f"Invalid JSON: {str(e)}"}
                    print(normalize_response(error_response), flush=True)
                    continue
                
                # Handle command
                response = self.handle_command(command)
                
                # Send response
                print(normalize_response(response), flush=True)
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                error_response = {"success": False, "error": f"Daemon error: {str(e)}"}
                print(normalize_response(error_response), flush=True)


if __name__ == "__main__":
    daemon = ExcelDaemon()
    daemon.run() 