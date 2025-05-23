import json
from typing import Dict, Any
from .models import Pipeline, ExecutionResults
from .processor import PipelineExecutor

def execute_pipeline(pipeline_json: str) -> Dict[str, Any]:
    """
    Execute a pipeline from a JSON string
    """
    # Parse the pipeline
    
    pipeline_data = json.loads(pipeline_json)
    
    # Execute the pipeline
    executor = PipelineExecutor()
    results = executor.execute(pipeline_data)
    
    # Convert results to dict format for JSON serialization
    return {
        "success": results.success,
        "error": results.error,
        "results": {
            node_id: [
                {
                    "node_id": result.node_id,
                    "index_value": result.index_value,
                    "result_data": result.result_data,
                    "error": result.error
                }
                for result in node_results
            ]
            for node_id, node_results in results.results.items()
        }
    }

def test_pipeline_node(pipeline_json: str, node_id: str) -> Dict[str, Any]:
    """
    Test a single node in a pipeline
    """
    # Parse the pipeline
    pipeline_data = json.loads(pipeline_json)
    
    # Execute the pipeline up to the target node
    executor = PipelineExecutor()
    results = executor.execute(pipeline_data, target_node_id=node_id)
    
    # Convert results to dict format for JSON serialization
    return {
        "success": results.success,
        "error": results.error,
        "results": {
            node_id: [
                {
                    "node_id": result.node_id,
                    "index_value": result.index_value,
                    "result_data": result.result_data,
                    "error": result.error
                }
                for result in node_results
            ]
            for node_id, node_results in results.results.items()
        }
    } 