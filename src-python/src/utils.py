from dataclasses import asdict
import json
import pandas as pd
import datetime
import numpy as np


def serialize_value(obj):
    """Serializes a single value, handling special types."""
    if isinstance(obj, (datetime.datetime, pd.Timestamp)):
        return obj.isoformat()
    if isinstance(obj, (float, np.floating)):
        if np.isnan(obj) or np.isinf(obj):
            return None  # Convert NaN and Infinity to null
        return float(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj


def recursively_serialize_dict(data):
    """Recursively traverses a dict/list structure and applies serialize_value."""
    if isinstance(data, dict):
        return {k: recursively_serialize_dict(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [recursively_serialize_dict(item) for item in data]
    else:
        return serialize_value(data)


def normalize_response(data) -> str:
    # This might need adjustment if 'data' is not already a dict
    # Assuming 'data' is a Pydantic model or dataclass
    if hasattr(data, "dict"):  # Pydantic V1
        data_dict = data.dict()
    elif hasattr(data, "model_dump"):  # Pydantic V2
        data_dict = data.model_dump()
    elif hasattr(data, "__dict__"):  # Basic object
        data_dict = data.__dict__
    elif isinstance(data, dict):
        data_dict = data
    else:
        # Cannot convert to dict easily, try direct serialization
        # This path might fail if data contains unserializable types
        try:
            return json.dumps(
                data, ensure_ascii=False, indent=2, default=serialize_value
            )
        except TypeError:
            raise TypeError(
                f"Cannot automatically serialize type {type(data)}. Convert to dict first."
            )

    serialized_dict = recursively_serialize_dict(data_dict)
    return json.dumps(serialized_dict, ensure_ascii=False, indent=2, allow_nan=False)
