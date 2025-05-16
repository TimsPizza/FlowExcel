import pandas as pd
from typing import List, Optional, Union
import json
import datetime  # 确保导入

from models import (
    FileDetailsResponse,
    ErrorResponse,
    FilePreviewResponse,
    SheetInfo,
)  # 假设 models.py 在同级或可按路径导入
from utils import (
    serialize,
    recursively_serialize_dict,
)  # 假设 utils.py 在同级或可按路径导入


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
    return pd.read_excel(file_path, sheet_name=sheet_name)


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

    return FilePreviewResponse(sheets=sheet_infos)


def get_file_details(
    file_path: str, header_row: int, sheet_name: Optional[str] = None
) -> str:
    """
    Reads an Excel file, extracts column names and a data preview.
    Returns a JSON string of FileDetailsResponse or ErrorResponse.
    """
    try:
        # header_row 是 1-based，pandas 是 0-based
        actual_header = header_row - 1
        if actual_header < 0:
            raise ValueError("Header row must be 1 or greater.")

        # Default to first sheet (index 0) if sheet_name is None or empty string
        sheet_to_read = sheet_name if sheet_name else 0
        df = pd.read_excel(file_path, sheet_name=sheet_to_read, header=actual_header)

        columns = df.columns.tolist()

        preview_df = df.head(5)
        # 使用 to_dict(orient='records') 得到 List[Dict]
        preview_records = preview_df.to_dict(orient="records")

        response_data = FileDetailsResponse(
            columns=columns, preview_data=preview_records
        )
        # 使用 Pydantic 模型的 .json() 方法，并尝试配置自定义 encoder (Pydantic V1 可能不直接支持在 .json() 中传 default)
        # 因此，我们手动用 json.dumps 配合 pydantic_encoder 或者一个更通用的 default
        # Pydantic V1 的 .json() 方法内部使用 json.dumps, 我们可以尝试提供一个 custom_encoder
        # config = type('Config', (), {'json_encoders': {pd.Timestamp: serialize, datetime.datetime: serialize, float: serialize}})()
        # return response_data.json(config=config) # Pydantic V1 可能不支持此方式

        # 更稳妥的方式是直接使用 json.dumps 和我们自定义的 default handler
        # Pydantic 模型的 .dict() 方法会转换为Python原生类型（尽可能）
        # return json.dumps(response_data.dict(), default=serialize, allow_nan=False) # OLD WAY

        # NEW WAY: Manually serialize after .dict()
        response_dict = response_data.dict()
        serialized_dict = recursively_serialize_dict(response_dict)
        # Dump the already serialized dict, no default needed, keep allow_nan=False
        return json.dumps(serialized_dict, allow_nan=False)

    except FileNotFoundError:
        error_data = ErrorResponse(
            error_type="FileNotFound", message=f"File not found: {file_path}"
        )
        return error_data.json()
    except ValueError as ve:
        # 例如无效的 header_row, 或者 pandas 内部的其他 ValueError
        error_data = ErrorResponse(error_type="InvalidInput", message=str(ve))
        return error_data.json()
    except Exception as e:
        # 捕获其他潜在错误，如 xlrd.XLRDError, openpyxl.utils.exceptions.InvalidFileException 等
        error_data = ErrorResponse(
            error_type="ExcelReadError", message=f"Error reading Excel file: {str(e)}"
        )
        return error_data.json()
