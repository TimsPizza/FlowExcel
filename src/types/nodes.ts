import { SimpleDataframe, SheetInfo } from "@/types";
import { NodeProps } from "reactflow";

export enum NodeType {
  INDEX_SOURCE = "indexSource",
  SHEET_SELECTOR = "sheetSelector",
  ROW_FILTER = "rowFilter",
  ROW_LOOKUP = "rowLookup",
  AGGREGATOR = "aggregator",
  OUTPUT = "output",
}

// Base for the content of the 'data' property of a ReactFlow node
export interface CustomNodeBaseData {
  id: string;
  label: string;
  nodeType: NodeType;
  testResult?: SheetInfo[]; // temporary for ui only, will not be saved to json
  error?: string;
}

export interface IndexSourceNodeDataContext extends CustomNodeBaseData {
  sourceFileID?: string; // file id in workspace
  // by sheet names
  bySheetName?: boolean;
  sheetName?: string;
  // by column names in a specific sheet
  byColumn?: boolean;
  columnName: string;
}

export interface SheetSelectorNodeDataContext extends CustomNodeBaseData {
  targetFileID?: string;
  mode: "auto_by_index" | "manual";
  manualSheetName?: string;
}

export interface RowFilterNodeDataContext extends CustomNodeBaseData {
  conditions: {
    column: string;
    operator: string;
    value: string | number;
    logic?: "AND" | "OR";
  }[];
}

export interface RowLookupNodeDataContext extends CustomNodeBaseData {
  matchColumn?: string;
}

export interface AggregatorNodeDataContext extends CustomNodeBaseData {
  statColumn?: string;
  method: "sum" | "avg" | "count" | "min" | "max";
  outputAs?: string; // output column name
}

export interface OutputNodeDataContext extends CustomNodeBaseData {
  outputFormat?: "table" | "csv" | "excel";
  outputPath?: string; // 输出文件保存路径
}

// FlowNodeData is the type for the 'data' property of a ReactFlow Node
export type FlowNodeData =
  | IndexSourceNodeDataContext
  | SheetSelectorNodeDataContext
  | RowFilterNodeDataContext
  | RowLookupNodeDataContext
  | AggregatorNodeDataContext
  | OutputNodeDataContext;

export type FlowNodeProps = NodeProps<FlowNodeData>;
