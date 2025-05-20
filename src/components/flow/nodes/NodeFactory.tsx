import { NodeType } from "@/types/nodes";
import { IndexSourceNode } from "./IndexSourceNode";
import { SheetSelectorNode } from "./SheetSelectorNode";
import { RowFilterNode } from "./RowFilterNode";
import { RowLookupNode } from "./RowLookupNode";
import { AggregatorNode } from "./AggregatorNode";
import { OutputNode } from "./OutputNode";

// 节点类型和组件的映射关系
const nodeTypes = {
  [NodeType.INDEX_SOURCE]: IndexSourceNode,
  [NodeType.SHEET_SELECTOR]: SheetSelectorNode,
  [NodeType.ROW_FILTER]: RowFilterNode,
  [NodeType.ROW_LOOKUP]: RowLookupNode,
  [NodeType.AGGREGATOR]: AggregatorNode,
  [NodeType.OUTPUT]: OutputNode,
};

export default nodeTypes; 