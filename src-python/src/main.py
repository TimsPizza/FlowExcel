import argparse
from excel_ops import (
    get_excel_preview,
    try_read_header_row,
    get_index_values,
    try_read_sheet_names,
)
from utils import normalize_response
import json
from typing import Dict, Any
import pandas as pd
from pipeline.models import Pipeline
from pipeline.processor import PipelineExecutor
from pipeline import execute_pipeline, test_pipeline_node


def main():
    parser = argparse.ArgumentParser(description="Excel Processing CLI")

    # Subparsers for different commands
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Command: get-details
    parser_details = subparsers.add_parser(
        "get-details", help="Get details (sheets, columns, preview) for an Excel file."
    )

    parser_details.add_argument(
        "--file-path", required=True, type=str, help="Path to the Excel file."
    )
    parser_details.add_argument(
        "--header-row", required=True, type=int, help="1-based index of the header row."
    )
    parser_details.add_argument(
        "--sheet-name", type=str, default=None, help="Optional sheet name."
    )

    # Command: get-index-values
    parser_index_values = subparsers.add_parser(
        "get-index-values", help="Get unique values from specified columns as index."
    )
    parser_index_values.add_argument(
        "--file-path", required=True, type=str, help="Path to the Excel file."
    )
    parser_index_values.add_argument(
        "--sheet-name",
        required=True,
        type=str,
        help="Sheet name containing the columns.",
    )
    parser_index_values.add_argument(
        "--column-names",
        required=True,
        type=str,
        help="Comma-separated list of column names to extract values from.",
    )
    parser_index_values.add_argument(
        "--header-row", required=True, type=int, help="1-based index of the header row."
    )

    # Command: preview-data
    parser_preview = subparsers.add_parser("preview-data", help="Preview Excel data.")
    parser_preview.add_argument(
        "--file-path", required=True, type=str, help="Path to the Excel file."
    )
    parser_preview.add_argument("--sheet", type=str, help="Sheet name for preview.")
    parser_preview.add_argument(
        "--header-row", type=int, default=0, help="Header row for preview."
    )
    parser_preview.add_argument(
        "--preview-rows", type=int, default=10, help="Number of rows to preview."
    )

    # Command: process-data
    parser_process = subparsers.add_parser(
        "process-data", help="Process data based on config."
    )
    parser_process.add_argument(
        "--config-path",
        required=True,
        type=str,
        help="Path to the configuration JSON file.",
    )
    parser_process.add_argument(
        "--preview",
        action="store_true",
        help="Preview the processing results without saving.",
    )

    # Command: try-read-header-row
    parser_try_read_header_row = subparsers.add_parser(
        "try-read-header-row", help="Try to read the header row from an Excel file."
    )
    parser_try_read_header_row.add_argument(
        "--file-path", required=True, type=str, help="Path to the Excel file."
    )
    parser_try_read_header_row.add_argument(
        "--sheet-name", required=True, type=str, help="Sheet name to read."
    )
    parser_try_read_header_row.add_argument(
        "--header-row", required=True, type=int, help="1-based index of the header row."
    )

    # Command: try-read-sheet-names
    parser_try_read_sheet_names = subparsers.add_parser(
        "try-read-sheet-names", help="Try to read the sheet names from an Excel file."
    )
    parser_try_read_sheet_names.add_argument(
        "--file-path", required=True, type=str, help="Path to the Excel file."
    )

    # Command: execute-pipeline
    parser_execute_pipeline = subparsers.add_parser(
        "execute-pipeline", help="Execute a data processing pipeline."
    )
    parser_execute_pipeline.add_argument(
        "--pipeline-json",
        required=True,
        type=str,
        help="JSON string defining the pipeline.",
    )

    # Command: test-pipeline-node
    parser_test_node = subparsers.add_parser(
        "test-pipeline-node", help="Test a single node in a data pipeline."
    )
    parser_test_node.add_argument(
        "--pipeline-json",
        required=True,
        type=str,
        help="JSON string defining the pipeline.",
    )
    parser_test_node.add_argument(
        "--node-id", required=True, type=str, help="ID of the node to test."
    )

    args = parser.parse_args()

    match args.command:
        case "get-index-values":
            column_name = args.column_names  # should be a single column name here
            result = get_index_values(
                file_path=args.file_path,
                sheet_name=args.sheet_name,
                header_row=args.header_row,
                column_name=column_name,
            )
            print(normalize_response(result))
            return
        case "preview-data":
            result = get_excel_preview(
                file_path=args.file_path,
            )
            print(normalize_response(result))
            return
        case "try-read-header-row":
            result = try_read_header_row(
                file_path=args.file_path,
                sheet_name=args.sheet_name,
                header_row=args.header_row,
            )
            print(normalize_response(result))
            return
        case "try-read-sheet-names":
            result = try_read_sheet_names(
                file_path=args.file_path,
            )
            print(normalize_response(result))
            return
        case "execute-pipeline":
            result = execute_pipeline(args.pipeline_json)
            print(json.dumps(result, ensure_ascii=False))
            return
        case "test-pipeline-node":
            result = test_pipeline_node(args.pipeline_json, args.node_id)
            print(json.dumps(result, ensure_ascii=False))
            return
        case _:
            parser.print_help()
            return


if __name__ == "__main__":
    main()
