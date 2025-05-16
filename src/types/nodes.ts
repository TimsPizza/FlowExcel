import { NodeProps } from 'reactflow';

export enum NodeType {
  INDEX_SOURCE = 'indexSource',
  SHEET_SELECTOR = 'sheetSelector',
  ROW_FILTER = 'rowFilter',
  ROW_LOOKUP = 'rowLookup',
  AGGREGATOR = 'aggregator',
  OUTPUT = 'output'
}

export interface BaseNodeData {
  id: string;
  label: string;
  testResult?: any;
  error?: string;
}

export interface IndexSourceNodeData extends BaseNodeData {
  sourceFile?: string;
  sheetName?: string;
  columnName?: string;
}

export interface SheetSelectorNodeData extends BaseNodeData {
  targetFile?: string;
  mode: 'auto_by_index' | 'manual';
  manualSheetName?: string;
}

export interface RowFilterNodeData extends BaseNodeData {
  conditions: {
    column: string;
    operator: string;
    value: string | number;
    logic?: 'AND' | 'OR';
  }[];
}

export interface RowLookupNodeData extends BaseNodeData {
  matchColumn?: string;
}

export interface AggregatorNodeData extends BaseNodeData {
  statColumn?: string;
  method: 'sum' | 'avg' | 'count' | 'min' | 'max';
}

export interface OutputNodeData extends BaseNodeData {
  outputFormat?: 'table' | 'csv' | 'excel';
}

export type FlowNodeData =
  | IndexSourceNodeData
  | SheetSelectorNodeData
  | RowFilterNodeData
  | RowLookupNodeData
  | AggregatorNodeData
  | OutputNodeData;

export type FlowNodeProps = NodeProps<FlowNodeData>; 