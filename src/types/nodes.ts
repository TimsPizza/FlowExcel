import { SimpleDataframe } from "@/types";
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
  testResult?: SimpleDataframe;
  error?: string;
}

export interface IndexSourceNodeDataContext extends CustomNodeBaseData {
  sourceFileID?: string; // file id in workspace
  sheetName?: string;
  columnNames?: string[];
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
}

export interface OutputNodeDataContext extends CustomNodeBaseData {
  outputFormat?: "table" | "csv" | "excel";
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
