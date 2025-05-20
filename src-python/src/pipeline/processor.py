import pandas as pd
from typing import Dict, Any, List, Optional
import networkx as nx
from .models import Pipeline, NodeType

class NodeProcessor:
    """Base class for node processors"""
    
    def process(self, inputs: Dict[str, pd.DataFrame], node_data: Dict[str, Any]) -> pd.DataFrame:
        """Process the node with given inputs and return output DataFrame"""
        raise NotImplementedError("Subclasses must implement process()")
    
class IndexSourceProcessor(NodeProcessor):
    def process(self, inputs: Dict[str, pd.DataFrame], node_data: Dict[str, Any]) -> pd.DataFrame:
        """
        Process index source node - extracts unique values from a column
        """
        # TODO: Implement using excel_ops utility functions
        return pd.DataFrame()  # Placeholder

class SheetSelectorProcessor(NodeProcessor):
    def process(self, inputs: Dict[str, pd.DataFrame], node_data: Dict[str, Any]) -> pd.DataFrame:
        """
        Process sheet selector node - maps each index to a sheet
        """
        # TODO: Implement using excel_ops utility functions
        return pd.DataFrame()  # Placeholder

class RowFilterProcessor(NodeProcessor):
    def process(self, inputs: Dict[str, pd.DataFrame], node_data: Dict[str, Any]) -> pd.DataFrame:
        """
        Process row filter node - filters rows based on conditions
        """
        # TODO: Implement filtering logic
        return pd.DataFrame()  # Placeholder

class RowLookupProcessor(NodeProcessor):
    def process(self, inputs: Dict[str, pd.DataFrame], node_data: Dict[str, Any]) -> pd.DataFrame:
        """
        Process row lookup node - filters rows that match the index value
        """
        # TODO: Implement row lookup logic
        return pd.DataFrame()  # Placeholder

class AggregatorProcessor(NodeProcessor):
    def process(self, inputs: Dict[str, pd.DataFrame], node_data: Dict[str, Any]) -> pd.DataFrame:
        """
        Process aggregator node - aggregates data based on index
        """
        # TODO: Implement aggregation logic
        return pd.DataFrame()  # Placeholder

class OutputProcessor(NodeProcessor):
    def process(self, inputs: Dict[str, pd.DataFrame], node_data: Dict[str, Any]) -> pd.DataFrame:
        """
        Process output node - formats the final output
        """
        # TODO: Implement output formatting
        return pd.DataFrame()  # Placeholder

class PipelineExecutor:
    """Executes a data processing pipeline using a directed graph model"""
    
    def __init__(self):
        self.processors = {
            NodeType.INDEX_SOURCE: IndexSourceProcessor(),
            NodeType.SHEET_SELECTOR: SheetSelectorProcessor(),
            NodeType.ROW_FILTER: RowFilterProcessor(),
            NodeType.ROW_LOOKUP: RowLookupProcessor(),
            NodeType.AGGREGATOR: AggregatorProcessor(),
            NodeType.OUTPUT: OutputProcessor(),
        }
        
    def execute(self, pipeline: Pipeline) -> Dict[str, Any]:
        """
        Execute the entire pipeline and return results for each node
        """
        # Create a directed graph
        graph = nx.DiGraph()
        
        # Add all nodes
        for node in pipeline.nodes:
            graph.add_node(node.id, type=node.type, data=node.data)
            
        # Add all edges
        for edge in pipeline.edges:
            graph.add_edge(edge.source, edge.target)
            
        # Topological sort to determine execution order
        try:
            execution_order = list(nx.topological_sort(graph))
        except nx.NetworkXUnfeasible:
            raise ValueError("Pipeline contains cycles, which are not allowed")
            
        # Execute nodes in order
        results = {}
        node_outputs = {}
        
        for node_id in execution_order:
            node_type = graph.nodes[node_id]['type']
            node_data = graph.nodes[node_id]['data']
            
            # Get inputs from parent nodes
            inputs = {}
            for parent in graph.predecessors(node_id):
                inputs[parent] = node_outputs.get(parent)
                
            try:
                # Get the appropriate processor
                processor = self.processors.get(node_type)
                if not processor:
                    raise ValueError(f"Unknown node type: {node_type}")
                    
                # Process the node
                output_df = processor.process(inputs, node_data)
                
                # Store output
                node_outputs[node_id] = output_df
                
                # Store result for reporting
                results[node_id] = {
                    "result": output_df.head(10).to_dict(orient="records") if not output_df.empty else [],
                    "error": None
                }
            except Exception as e:
                # Store error
                results[node_id] = {
                    "result": None,
                    "error": str(e)
                }
                
        return results
