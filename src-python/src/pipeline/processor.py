import pandas as pd
import networkx as nx
from typing import Dict, Any, List, Optional, Set, Tuple
import os
from .models import (
    Pipeline, NodeType, ExecutionContext, PipelineResult, 
    ExecutionResults, FileInfo, BaseNode
)

class NodeProcessor:
    """节点处理器基类"""
    
    def process(self, context: ExecutionContext, node: BaseNode) -> pd.DataFrame:
        """处理节点并返回输出DataFrame"""
        raise NotImplementedError("Subclasses must implement process()")

class IndexSourceProcessor(NodeProcessor):
    """索引源节点处理器 - 从指定文件和列提取索引值列表"""
    
    def process(self, context: ExecutionContext, node: BaseNode) -> pd.DataFrame:
        data = node.data
        source_file_id = data.get("sourceFileID")
        sheet_name = data.get("sheetName")
        column_name = data.get("columnName")
        by_column = data.get("byColumn", True)
        
        if not source_file_id or source_file_id not in context.files:
            raise ValueError(f"Source file {source_file_id} not found")
            
        file_info = context.files[source_file_id]
        
        # 加载数据
        df_key = f"{source_file_id}_{sheet_name}"
        if df_key not in context.loaded_dataframes:
            # 获取header_row
            header_row = 0
            for sheet_meta in file_info.sheet_metas:
                if sheet_meta["sheet_name"] == sheet_name:
                    header_row = sheet_meta["header_row"]
                    break
                    
            df = pd.read_excel(file_info.path, sheet_name=sheet_name, header=header_row)
            context.loaded_dataframes[df_key] = df
        
        df = context.loaded_dataframes[df_key]
        
        if by_column and column_name:
            # 提取指定列的唯一值作为索引
            if column_name not in df.columns:
                raise ValueError(f"Column {column_name} not found in sheet {sheet_name}")
            
            unique_values = df[column_name].dropna().unique().tolist()
            # 返回索引列表作为DataFrame
            return pd.DataFrame({column_name: unique_values})
        else:
            # 如果按sheet名，返回sheet名列表
            return pd.DataFrame({"sheet_names": [sheet_name]})

class SheetSelectorProcessor(NodeProcessor):
    """Sheet定位节点处理器"""
    
    def process(self, context: ExecutionContext, node: BaseNode) -> pd.DataFrame:
        data = node.data
        target_file_id = data.get("targetFileID")
        mode = data.get("mode", "auto_by_index")
        manual_sheet_name = data.get("manualSheetName")
        
        if not target_file_id or target_file_id not in context.files:
            raise ValueError(f"Target file {target_file_id} not found")
            
        file_info = context.files[target_file_id]
        
        if mode == "manual" and manual_sheet_name:
            # 手动指定sheet
            sheet_name = manual_sheet_name
        elif mode == "auto_by_index" and context.current_index:
            # 根据索引自动匹配sheet名
            sheet_name = context.current_index
        else:
            raise ValueError(f"Invalid sheet selector configuration: mode={mode}, index={context.current_index}")
        
        # 验证sheet是否存在
        available_sheets = [meta["sheet_name"] for meta in file_info.sheet_metas]
        if sheet_name not in available_sheets:
            # 不抛出错误，返回空DataFrame，让pipeline继续执行其他索引值
            # print(f"Warning: Sheet {sheet_name} not found in file {file_info.name}. Available sheets: {available_sheets}. Skipping this index.")
            return pd.DataFrame()  # 返回空DataFrame
        
        # 加载对应的sheet数据
        df_key = f"{target_file_id}_{sheet_name}"
        if df_key not in context.loaded_dataframes:
            # 获取header_row
            header_row = 0
            for sheet_meta in file_info.sheet_metas:
                if sheet_meta["sheet_name"] == sheet_name:
                    header_row = sheet_meta["header_row"]
                    break
                    
            df = pd.read_excel(file_info.path, sheet_name=sheet_name, header=header_row)
            context.loaded_dataframes[df_key] = df
        
        return context.loaded_dataframes[df_key].copy()

class RowFilterProcessor(NodeProcessor):
    """行过滤节点处理器"""
    
    def process(self, context: ExecutionContext, node: BaseNode, input_df: pd.DataFrame) -> pd.DataFrame:
        data = node.data
        conditions = data.get("conditions", [])
        
        if not conditions:
            return input_df
            
        # 开始构建过滤条件
        mask = pd.Series([True] * len(input_df), index=input_df.index)
        
        for i, condition in enumerate(conditions):
            column = condition.get("column")
            operator = condition.get("operator")
            value = condition.get("value")
            logic = condition.get("logic", "AND")
            
            if not column or not operator:
                continue
                
            if column not in input_df.columns:
                raise ValueError(f"Filter column {column} not found in data")
            
            # 构建单个条件的mask
            column_data = input_df[column]
            
            if operator == "==":
                condition_mask = column_data == value
            elif operator == "!=":
                condition_mask = column_data != value
            elif operator == ">":
                condition_mask = column_data > value
            elif operator == ">=":
                condition_mask = column_data >= value
            elif operator == "<":
                condition_mask = column_data < value
            elif operator == "<=":
                condition_mask = column_data <= value
            elif operator == "contains":
                condition_mask = column_data.astype(str).str.contains(str(value), na=False)
            elif operator == "not_contains":
                condition_mask = ~column_data.astype(str).str.contains(str(value), na=False)
            elif operator == "is_null":
                condition_mask = column_data.isnull()
            elif operator == "is_not_null":
                condition_mask = column_data.notnull()
            else:
                raise ValueError(f"Unknown filter operator: {operator}")
            
            # 合并条件
            if i == 0:
                mask = condition_mask
            else:
                if logic == "AND":
                    mask = mask & condition_mask
                elif logic == "OR":
                    mask = mask | condition_mask
                else:
                    raise ValueError(f"Unknown logic operator: {logic}")
        
        # 应用过滤
        return input_df[mask].copy()

class RowLookupProcessor(NodeProcessor):
    """行查找/列匹配节点处理器"""
    
    def process(self, context: ExecutionContext, node: BaseNode, input_df: pd.DataFrame) -> pd.DataFrame:
        data = node.data
        match_column = data.get("matchColumn")
        
        if not match_column or not context.current_index:
            return input_df
            
        if match_column not in input_df.columns:
            # 如果匹配列不存在，打印警告并返回空DataFrame
            # print(f"Warning: Match column {match_column} not found in data. Available columns: {list(input_df.columns)}. Skipping this index.")
            return pd.DataFrame()
        
        # 查找匹配当前索引值的行
        filtered_df = input_df[input_df[match_column] == context.current_index].copy()
        
        # 如果没有匹配的行，不抛错误，而是返回空DataFrame
        # if filtered_df.empty:
        #     # print(f"Warning: No rows found matching index value '{context.current_index}' in column '{match_column}'. Skipping this index.")
        
        return filtered_df

class AggregatorProcessor(NodeProcessor):
    """聚合节点处理器"""
    
    def process(self, context: ExecutionContext, node: BaseNode, input_df: pd.DataFrame) -> pd.DataFrame:
        data = node.data
        stat_column = data.get("statColumn")
        method = data.get("method", "sum")
        output_as = data.get("outputAs", "")  # 用户指定的输出列名
        
        # 如果输入数据为空，返回空结果
        if input_df.empty:
            return pd.DataFrame()
        
        if not stat_column:
            return pd.DataFrame()
            
        if stat_column not in input_df.columns:
            return pd.DataFrame()
        
        try:
            # 执行聚合操作
            if method == "sum":
                result_value = input_df[stat_column].sum()
            elif method == "avg":
                result_value = input_df[stat_column].mean()
            elif method == "count":
                result_value = input_df[stat_column].count()
            elif method == "min":
                result_value = input_df[stat_column].min()
            elif method == "max":
                result_value = input_df[stat_column].max()
            else:
                return pd.DataFrame()
            
            # 检查结果是否有效（不是NaN）
            if pd.isna(result_value):
                return pd.DataFrame()
            
            # 创建输出列名
            if output_as:
                output_column_name = output_as
            else:
                output_column_name = f"{method}_{stat_column}"
            
            # 返回聚合结果，包含索引和统计值
            result_df = pd.DataFrame({
                "index_value": [context.current_index] if context.current_index else [""],
                "column": [stat_column],
                "method": [method],
                "result": [result_value],
                "output_column_name": [output_column_name]
            })
            
            return result_df
            
        except Exception as e:
            return pd.DataFrame()

class OutputProcessor(NodeProcessor):
    """输出节点处理器"""
    
    def process(self, context: ExecutionContext, node: BaseNode, input_df: pd.DataFrame) -> pd.DataFrame:
        # 输出节点主要是格式化数据，实际的文件写入由executor处理
        return input_df
    
    def write_excel_output(self, results: Dict[str, List[PipelineResult]], output_path: str):
        """
        将多个pipeline的结果写入Excel文件，每个索引值生成一个sheet
        
        Args:
            results: 执行结果字典
            output_path: 输出文件路径
        """
        try:
            with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
                # 收集所有输出节点的结果
                output_data = {}
                
                for node_id, node_results in results.items():
                    for result in node_results:
                        if result.result_data and result.index_value:
                            sheet_name = result.index_value
                            if sheet_name not in output_data:
                                output_data[sheet_name] = []
                            
                            # 转换结果数据为DataFrame
                            if result.result_data.get("data"):
                                df = pd.DataFrame(result.result_data["data"])
                                output_data[sheet_name].append(df)
                
                # 写入每个sheet
                for sheet_name, dataframes in output_data.items():
                    if dataframes:
                        # 如果有多个DataFrame，可以选择合并或分别处理
                        # 这里选择合并
                        combined_df = pd.concat(dataframes, ignore_index=True)
                        # 限制sheet名长度（Excel限制为31字符）
                        safe_sheet_name = str(sheet_name)[:31]
                        combined_df.to_excel(writer, sheet_name=safe_sheet_name, index=False)
                        
        except Exception as e:
            raise ValueError(f"Failed to write Excel output: {str(e)}")

class PipelineExecutor:
    """Pipeline执行器 - 支持索引驱动的多实例执行"""
    
    def __init__(self):
        self.processors = {
            NodeType.INDEX_SOURCE: IndexSourceProcessor(),
            NodeType.SHEET_SELECTOR: SheetSelectorProcessor(), 
            NodeType.ROW_FILTER: RowFilterProcessor(),
            NodeType.ROW_LOOKUP: RowLookupProcessor(),
            NodeType.AGGREGATOR: AggregatorProcessor(),
            NodeType.OUTPUT: OutputProcessor(),
        }
        self.file_cache = {}  # 文件缓存
    
    def execute(self, pipeline_data: Dict[str, Any], target_node_id: Optional[str] = None) -> ExecutionResults:
        """
        执行pipeline
        
        Args:
            pipeline_data: 包含nodes, edges, files的完整pipeline数据
            target_node_id: 目标节点ID，如果指定则只执行到该节点（用于测试运行）
        
        Returns:
            ExecutionResults: 执行结果
        """
        try:
            # 解析输入数据
            files = {f["id"]: FileInfo(**f) for f in pipeline_data.get("files", [])}
            nodes = [BaseNode(**n) for n in pipeline_data.get("flow_nodes", [])]
            edges = pipeline_data.get("flow_edges", [])
            
            # 构建图
            graph = nx.DiGraph()
            node_map = {node.id: node for node in nodes}
            
            for node in nodes:
                graph.add_node(node.id, node=node)
            
            for edge in edges:
                graph.add_edge(edge["source"], edge["target"])
            print(graph.nodes)
            print(graph.edges)
            
            # 如果指定了目标节点，构建子图
            if target_node_id:
                subgraph_nodes = self._get_subgraph_nodes(graph, target_node_id)
                graph = graph.subgraph(subgraph_nodes)
                node_map = {nid: node_map[nid] for nid in subgraph_nodes if nid in node_map}
            
            # 找到所有索引源节点
            index_sources = [node for node in node_map.values() if node.type == NodeType.INDEX_SOURCE]
            
            if not index_sources:
                raise ValueError("No index source nodes found")
            
            results = ExecutionResults()
            
            # 如果目标节点就是索引源节点之一，只执行该节点
            if target_node_id and any(source.id == target_node_id for source in index_sources):
                target_source = next(source for source in index_sources if source.id == target_node_id)
                index_results = self._execute_from_index_source(
                    graph, node_map, files, target_source, target_node_id
                )
                
                # 合并结果
                for node_id, node_results in index_results.items():
                    if node_id not in results.results:
                        results.results[node_id] = []
                    results.results[node_id].extend(node_results)
                
                return results
            
            # 对每个索引源执行
            for index_source in index_sources:
                index_results = self._execute_from_index_source(
                    graph, node_map, files, index_source, target_node_id
                )
                
                # 合并结果
                for node_id, node_results in index_results.items():
                    if node_id not in results.results:
                        results.results[node_id] = []
                    results.results[node_id].extend(node_results)
            
            return results
            
        except Exception as e:
            return ExecutionResults(success=False, error=str(e))
    
    def _get_subgraph_nodes(self, graph: nx.DiGraph, target_node_id: str) -> Set[str]:
        """获取从所有索引源到目标节点的子图节点"""
        # 找到所有索引源
        index_sources = []
        for node_id in graph.nodes():
            node = graph.nodes[node_id]["node"]
            if node.type == NodeType.INDEX_SOURCE:
                print(f"index_source: {node_id}")
                index_sources.append(node_id)
        
        # 收集所有从索引源到目标节点的路径上的节点
        subgraph_nodes = set()
        
        for index_source in index_sources:
            try:
                # 使用networkx找到从索引源到目标节点的所有简单路径
                paths = list(nx.all_simple_paths(graph, index_source, target_node_id))
                for path in paths:
                    subgraph_nodes.update(path)
            except nx.NetworkXNoPath:
                # 如果没有路径，跳过这个索引源
                continue
        
        return subgraph_nodes
    
    def _execute_from_index_source(
        self, 
        graph: nx.DiGraph, 
        node_map: Dict[str, BaseNode], 
        files: Dict[str, FileInfo],
        index_source: BaseNode,
        target_node_id: Optional[str]
    ) -> Dict[str, List[PipelineResult]]:
        """从指定索引源执行pipeline"""
        
        # 创建执行上下文
        context = ExecutionContext(
            index_source_id=index_source.id,
            files=files
        )
        
        # 执行索引源节点获取索引列表
        try:
            index_processor = self.processors[NodeType.INDEX_SOURCE]
            index_df = index_processor.process(context, index_source)
            
            # 提取索引值列表
            index_values = []
            if not index_df.empty:
                # 假设第一列包含索引值
                index_values = index_df.iloc[:, 0].dropna().unique().tolist()
            
        except Exception as e:
            return {
                index_source.id: [PipelineResult(
                    node_id=index_source.id,
                    error=f"Index source execution failed: {str(e)}"
                )]
            }
        
        results = {}
        
        # 如果是测试单个节点，且目标节点就是索引源节点，则只返回索引源节点的结果
        if target_node_id and target_node_id == index_source.id:
            # 创建一个包含所有索引值的结果
            result_data = {
                "columns": index_df.columns.tolist(),
                "data": index_df.head(100).to_dict(orient="records"),
                "total_rows": len(index_df)
            }
            
            return {
                index_source.id: [PipelineResult(
                    node_id=index_source.id,
                    result_data=result_data
                )]
            }
        
        # 为每个索引值执行pipeline
        for index_value in index_values:
            context.current_index = str(index_value)
            
            # 执行从索引源开始的路径
            single_result = self._execute_single_pipeline(
                graph, node_map, context, index_source.id, target_node_id
            )
            
            # 合并结果
            for node_id, result in single_result.items():
                if node_id not in results:
                    results[node_id] = []
                results[node_id].append(result)
        
        return results
    
    def _execute_single_pipeline(
        self,
        graph: nx.DiGraph,
        node_map: Dict[str, BaseNode],
        context: ExecutionContext,
        start_node_id: str,
        target_node_id: Optional[str]
    ) -> Dict[str, PipelineResult]:
        """执行单个索引值的pipeline"""
        
        results = {}
        node_outputs = {}  # 存储每个节点的输出
        
        # 如果有目标节点，只执行到目标节点
        if target_node_id:
            try:
                execution_order = list(nx.shortest_path(graph, start_node_id, target_node_id))
            except nx.NetworkXNoPath:
                return {target_node_id: PipelineResult(
                    node_id=target_node_id,
                    index_value=context.current_index,
                    error=f"No path from {start_node_id} to {target_node_id}"
                )}
        else:
            # 执行从起始节点可达的所有节点
            reachable_nodes = nx.descendants(graph, start_node_id)
            reachable_nodes.add(start_node_id)
            subgraph = graph.subgraph(reachable_nodes)
            execution_order = list(nx.topological_sort(subgraph))
        
        # 找到最近的非统计节点输出的helper函数
        def find_nearest_dataframe_source(node_id: str) -> Optional[pd.DataFrame]:
            """找到最近的输出DataFrame的节点"""
            # 使用BFS从当前节点向前搜索
            visited = set()
            queue = [node_id]
            
            while queue:
                current_id = queue.pop(0)
                if current_id in visited:
                    continue
                visited.add(current_id)
                
                # 检查前驱节点
                predecessors = list(graph.predecessors(current_id))
                for pred_id in predecessors:
                    if pred_id in node_outputs:
                        pred_node = node_map.get(pred_id)
                        # 如果前驱节点不是统计节点，使用它的输出
                        if pred_node and pred_node.type != NodeType.AGGREGATOR:
                            return node_outputs[pred_id]
                    
                    # 继续向前搜索
                    queue.append(pred_id)
            
            return None
        
        # 按顺序执行节点
        for node_id in execution_order:
            if node_id not in node_map:
                continue
                
            node = node_map[node_id]
            
            try:
                processor = self.processors[node.type]
                
                # 获取输入数据（来自前驱节点）
                input_data = None
                predecessors = list(graph.predecessors(node_id))
                
                if predecessors:
                    if node.type == NodeType.AGGREGATOR:
                        # 对于统计节点，找到最近的非统计节点的输出
                        input_data = find_nearest_dataframe_source(node_id)
                    else:
                        # 对于其他节点，使用第一个前驱节点的输出
                        pred_id = predecessors[0]
                        if pred_id in node_outputs:
                            input_data = node_outputs[pred_id]
                
                # 执行节点
                if node.type == NodeType.INDEX_SOURCE:
                    # 索引源节点不需要输入
                    output = processor.process(context, node)
                    # 对于索引源节点，当测试单个节点时，我们只需要返回当前处理的索引值
                    if node_id == start_node_id and context.current_index:
                        # 如果是起始节点且有当前索引值，只保留当前索引值的行
                        column_name = output.columns[0]  # 假设第一列是索引列
                        output = pd.DataFrame({column_name: [context.current_index]})
                elif node.type == NodeType.SHEET_SELECTOR:
                    # Sheet选择器不需要前驱输入
                    output = processor.process(context, node)
                elif node.type in [NodeType.ROW_FILTER, NodeType.ROW_LOOKUP, NodeType.AGGREGATOR, NodeType.OUTPUT]:
                    # 这些节点需要输入数据
                    if input_data is None:
                        raise ValueError(f"Node {node_id} requires input data")
                    output = processor.process(context, node, input_data)
                else:
                    # 其他节点类型
                    output = processor.process(context, node)
                
                # 存储输出
                node_outputs[node_id] = output
                
                # 创建结果
                result_data = None
                if not output.empty:
                    # 限制返回的数据量用于预览
                    preview_df = output.head(100)  # 最多返回100行
                    result_data = {
                        "columns": preview_df.columns.tolist(),
                        "data": preview_df.to_dict(orient="records"),
                        "total_rows": len(output)
                    }
                    
                    results[node_id] = PipelineResult(
                        node_id=node_id,
                        index_value=context.current_index,
                        result_data=result_data
                    )
                # 如果输出为空，不添加结果，让pipeline继续执行
                
            except Exception as e:
                results[node_id] = PipelineResult(
                    node_id=node_id,
                    index_value=context.current_index,
                    error=str(e)
                )
                # 如果节点执行失败，停止后续执行
                break
        
        return results
