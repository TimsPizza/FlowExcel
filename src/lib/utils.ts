import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { FileMeta } from "@/types";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import type {
  PreviewNodeResult,
  IndexSourcePreviewResult,
  DataFramePreviewResult,
  AggregationPreviewResult,
  SheetInfo,
} from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to get a file by ID from the current workspace
export const getFileById = (fileId: string): FileMeta | undefined => {
  const state = useWorkspaceStore.getState();
  return state.currentWorkspace?.files.find((f) => f.id === fileId);
};

// Preview result utilities

/**
 * Type guards for preview results
 */
export const isIndexSourcePreview = (
  result: PreviewNodeResult,
): result is IndexSourcePreviewResult => {
  return "index_values" in result && "preview_data" in result;
};

export const isDataFramePreview = (
  result: PreviewNodeResult,
): result is DataFramePreviewResult => {
  return "dataframe_previews" in result;
};

export const isAggregationPreview = (
  result: PreviewNodeResult,
): result is AggregationPreviewResult => {
  return "aggregation_results" in result && "preview_data" in result;
};

/**
 * Convert preview results to SheetInfo array for consistent UI rendering
 */
export const convertPreviewToSheets = (
  result: PreviewNodeResult,
): SheetInfo[] => {
  if (!result.success) {
    return [];
  }

  if (isIndexSourcePreview(result)) {
    return [
      {
        sheet_name: result.preview_data.sheet_name,
        columns: result.preview_data.columns,
        data: result.preview_data.data,
      },
    ];
  }

  if (isDataFramePreview(result)) {
    return result.dataframe_previews.map((preview) => ({
      sheet_name: preview.sheet_name,
      columns: preview.columns,
      data: preview.data,
    }));
  }

  if (isAggregationPreview(result)) {
    return [
      {
        sheet_name: result.preview_data.sheet_name,
        columns: result.preview_data.columns,
        data: result.preview_data.data,
      },
    ];
  }

  return [];
};

/**
 * Get preview result metadata
 */
export const getPreviewMetadata = (
  result: PreviewNodeResult,
): Record<string, any> => {
  if (!result.success) {
    return { error: result.error };
  }

  const metadata: Record<string, any> = {
    node_id: result.node_id,
    node_type: result.node_type,
    execution_time_ms: result.execution_time_ms || 0,
  };

  if (isIndexSourcePreview(result)) {
    metadata.total_index_values = result.index_values.length;
    metadata.source_column = result.source_column;
  }

  if (isDataFramePreview(result)) {
    metadata.preview_count = result.dataframe_previews.length;
    metadata.total_rows = result.dataframe_previews.reduce(
      (sum, preview) => sum + (preview.metadata.total_rows || 0),
      0,
    );
  }

  if (isAggregationPreview(result)) {
    metadata.aggregation_count = result.aggregation_results.length;
  }

  return metadata;
};
