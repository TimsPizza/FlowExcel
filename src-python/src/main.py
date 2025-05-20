import argparse
import json
import pandas as pd
from numpy import nan
from utils import *
from dtos import *
import sys
from excel_ops import (
    get_excel_preview,
    try_read_header_row,
)  # Use relative import if main.py is a module
from models import IndexValues, PreviewData


def get_excel_info(file_path) -> PythonResponse[ExcelInfo]:
    """获取Excel文件的基本信息（sheet列表等）"""
    try:
        xl = pd.ExcelFile(file_path)
        sheets = xl.sheet_names
        sheet_info = {}
        for sheet in sheets:
            # 读取每个sheet的前1行以获取列名
            df = pd.read_excel(file_path, sheet_name=sheet, nrows=1)
            sheet_info[sheet] = {"columns": df.columns.tolist()}
        return PythonResponse(
            status="success", data=ExcelInfo(sheets=sheets, sheet_info=sheet_info)
        )
    except Exception as e:
        return PythonResponse(status="error", message=str(e), data=None)


def get_index_values(file_path, sheet_name, column_name):
    """获取指定列的所有唯一值作为索引"""
    try:
        # 读取指定sheet的数据
        df = pd.read_excel(file_path, sheet_name=sheet_name)

        # 检查列是否存在
        if column_name not in df.columns:
            return PythonResponse(
                status="error",
                message=f"列 '{column_name}' 在工作表 '{sheet_name}' 中不存在",
                data=None,
            )

        # 根据选择的列组合构建索引值
        unique_values = df[column_name].dropna().astype(str).unique().tolist()
        result = IndexValues(
            column=column_name,
            data=unique_values,
        )

        return PythonResponse(status="success", data=result)
    except Exception as e:
        return PythonResponse(
            status="error", message=f"获取索引值时发生错误: {str(e)}", data=None
        )


def read_excel_file(file_cfg):
    return pd.read_excel(
        file_cfg["path"],
        sheet_name=file_cfg.get("sheet", 0),
        header=file_cfg.get("header_row", 0),
        usecols=file_cfg.get("columns"),
    )


def apply_special_mapping(index, mapping):
    if mapping and index in mapping:
        return mapping[index]
    return index


def run_task(task, files_dict):
    # 读取索引来源
    idx_file_cfg = files_dict[task["index_source"]["file"]]
    idx_col = task["index_source"]["column"]
    idx_df = read_excel_file(idx_file_cfg)
    indices = idx_df[idx_col].dropna().astype(str).tolist()

    # 读取数据来源
    data_file_cfg = files_dict[task["data_source"]["file"]]
    data_idx_col = task["data_source"]["index_column"]
    value_col = task["data_source"]["value_column"]
    data_df = read_excel_file(data_file_cfg)

    # 特殊映射
    mapping = task.get("special_mapping", {})

    # 结果
    result = {}
    for idx in indices:
        mapped_idx = apply_special_mapping(idx, mapping)
        rows = data_df[data_df[data_idx_col].astype(str) == mapped_idx]
        if task.get("aggregation", "sum") == "sum":
            value = rows[value_col].sum()
        else:
            value = rows[value_col].sum()  # 预留扩展
        result[idx] = value
    return result


def preview_index_mapping(task, files_dict):
    """预览索引映射关系"""
    try:
        # 读取索引来源
        idx_file_cfg = files_dict[task["index_source"]["file"]]
        idx_col = task["index_source"]["column"]
        idx_df = read_excel_file(idx_file_cfg)
        indices = idx_df[idx_col].dropna().astype(str).tolist()

        # 读取数据来源
        data_file_cfg = files_dict[task["data_source"]["file"]]
        data_idx_col = task["data_source"]["index_column"]
        value_col = task["data_source"]["value_column"]
        data_df = read_excel_file(data_file_cfg)

        # 特殊映射
        mapping = task.get("special_mapping", {})

        # 构建映射预览
        preview = []
        for idx in indices:
            mapped_idx = apply_special_mapping(idx, mapping)
            rows = data_df[data_df[data_idx_col].astype(str) == mapped_idx]
            preview.append(
                {
                    "original_index": idx,
                    "mapped_index": mapped_idx,
                    "matched_rows": rows.shape[0],
                    "matched_data": rows.to_dict("records"),
                }
            )

        return {"status": "success", "preview": preview}
    except Exception as e:
        return {"status": "error", "message": str(e)}


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
    args = parser.parse_args()

    if args.command == "get-index-values":
        column_name = args.column_names  # should be a single column name here
        result = get_index_values(
            file_path=args.file_path,
            sheet_name=args.sheet_name,
            column_name=column_name,
        )
        print(normalize_response(result))
        return

    elif args.command == "preview-data":
        result = get_excel_preview(
            file_path=args.file_path,
        )
        print(normalize_response(result))
        return
    elif args.command == "try-read-header-row":
        result = try_read_header_row(
            file_path=args.file_path,
            sheet_name=args.sheet_name,
            header_row=args.header_row,
        )
        print(normalize_response(result))
        return
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
