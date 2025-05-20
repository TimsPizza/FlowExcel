import json
from typing import Dict, Any
from .models import Pipeline
from .processor import PipelineExecutor

def execute_pipeline(pipeline_json: str) -> Dict[str, Any]:
    """
    Execute a pipeline from a JSON string
    """
    # Parse the pipeline
    pipeline_dict = json.loads(pipeline_json)
    pipeline = Pipeline(**pipeline_dict)
    
    # Execute the pipeline
    executor = PipelineExecutor()
    return executor.execute(pipeline)

def test_pipeline_node(pipeline_json: str, node_id: str) -> Dict[str, Any]:
    """
    Test a single node in a pipeline
    """
    # Parse the pipeline
    pipeline_dict = json.loads(pipeline_json)
    pipeline = Pipeline(**pipeline_dict)
    
    # Create a subgraph with only the node and its ancestors
    sub_pipeline = Pipeline(
        nodes=[node for node in pipeline.nodes if node.id == node_id or any(edge.target == node_id for edge in pipeline.edges)],
        edges=[edge for edge in pipeline.edges if edge.target == node_id]
    )
    
    # Execute the sub-pipeline
    executor = PipelineExecutor()
    results = executor.execute(sub_pipeline)
    
    return results.get(node_id, {"result": None, "error": "Node not found"}) 
  