import datetime
from typing import List
import pandas as pd
from app.models import (
    FilePreviewResponse,
    IndexValues,
    PreviewResponse,
    PythonResponse,
    SheetInfo,
    TryReadHeaderRowResponse,
    TryReadSheetNamesResponse,
)
from app.utils import serialize_value as serialize
from pipeline.performance.analyzer import get_performance_analyzer


# 自定义 Pydantic 模型 JSON 编码器，以便使用我们的 serialize 函数
def pydantic_encoder(obj):
    if isinstance(obj, (datetime.datetime, pd.Timestamp)):
        return serialize(obj)
    if isinstance(obj, float) and pd.isna(obj):
        return serialize(obj)
    # 对于Pydantic模型，让它自己处理
    if hasattr(obj, "dict") and callable(obj.dict):
        return obj.dict()
    raise TypeError(
        f"Object of type {type(obj).__name__} is not JSON serializable for pydantic_encoder"
    )


def get_excel_sheet_names(file_path: str) -> List[str]:
    """
    Get the sheet names from an Excel file.
    """
    return pd.ExcelFile(file_path).sheet_names


def get_df_by_sheet_name(file_path: str, sheet_name: str) -> pd.DataFrame:
    """
    Get a DataFrame from an Excel file by sheet name.
    """
    try:
        analyzer = get_performance_analyzer()
        read_id = analyzer.onExcelReadStart(file_path, sheet_name)
    except ImportError:
        analyzer = None
        read_id = None

    try:
        df = pd.read_excel(file_path, sheet_name=sheet_name)

        if analyzer and read_id:
            # 获取文件大小（可选）
            try:
                import os

                file_size = os.path.getsize(file_path)
            except:
                file_size = None

            analyzer.onExcelReadFinish(read_id, len(df), file_size)

        return df
    except Exception as e:
        if analyzer and read_id:
            analyzer.onExcelReadFinish(read_id, 0, None)
        raise e


def get_excel_preview(file_path: str) -> FilePreviewResponse:
    """
    Get a preview of an Excel file.
    """
    sheets = get_excel_sheet_names(file_path)
    sheet_infos = []
    for sheet in sheets:
        df = get_df_by_sheet_name(file_path, sheet)
        columns = df.columns.tolist()
        preview_data = (
            df.head(10).values.tolist()
            # .astype(object)
            # .where(pd.notnull(df), None)
            # .values.tolist()
        )
        sheet_infos.append(
            SheetInfo(sheet_name=sheet, columns=columns, preview_data=preview_data)
        )
    resp = PreviewResponse(sheets=sheet_infos)

    return PythonResponse(
        status="success",
        data=resp,
        message="",
    )


def try_read_header_row(file_path: str, sheet_name: str, header_row: int) -> int:
    """
    Try to read the header row from an Excel file.
    """
    try:
        df = pd.read_excel(file_path, sheet_name=sheet_name, header=header_row)
        return df.columns.tolist()
    except Exception as e:
        raise e


def try_read_sheet_names(file_path: str) -> List[str]:
    """
    Try to read the sheet names from an Excel file.
    """
    return pd.ExcelFile(file_path).sheet_names


def get_index_values(file_path, sheet_name, header_row, column_name) -> IndexValues:
    """获取指定列的所有唯一值作为索引"""
    try:
        # 读取指定sheet的数据
        df = pd.read_excel(file_path, sheet_name=sheet_name, header=header_row)

        # 检查列是否存在
        if column_name not in df.columns:
            raise ValueError(f"列 '{column_name}' 在工作表 '{sheet_name}' 中不存在")

        # 根据选择的列组合构建索引值
        unique_values = df[column_name].dropna().astype(str).unique().tolist()
        return IndexValues(
            column=column_name,
            data=unique_values,
        )

    except Exception as e:
        raise e
