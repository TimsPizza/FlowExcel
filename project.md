# Tauri Excel ETL Tool Project Documentation

## Project Overview
This project is a custom ETL (Extract, Transform, Load) tool built using Tauri, React, and Python for processing Excel files. The application provides a visual flow-based interface where users can create data processing pipelines by connecting different types of nodes, allowing "smart but non-professional" users to build data transformation workflows without coding.

## Architecture

### Technology Stack
- **Frontend**: React with TypeScript
- **Backend**: Tauri (Rust) + Python
- **Data Processing**: Python (pandas, openpyxl)
- **Packaging**: Tauri bundler

### Key Components
1. **Tauri Shell**: Provides the desktop application wrapper and handles communication between the React frontend and Python backend
2. **React UI**: Visual flow editor for creating and configuring data processing pipelines
3. **Python Processing Engine**: Handles the actual data processing logic and Excel file operations

## Functional Design

### User Workflow
1. Create a workspace and add data files (Excel)
2. Build data flows by adding and connecting nodes
3. Configure each node's parameters
4. Test nodes individually or run the complete flow
5. Save flows as templates for reuse

### Node Types
1. **Index Source**: Entry point that defines the iteration indices
2. **Sheet Selector**: Selects a specific sheet from an Excel file
3. **Row Filter**: Filters rows based on conditions
4. **Row Lookup**: Performs lookups between datasets
5. **Aggregator**: Performs aggregation operations on data
6. **Output**: Defines where and how to output the processed data

## Technical Implementation

### Frontend Structure
- `/src`: React application source code
  - `/components`: UI components
    - `/nodes`: Individual node type components
    - `/flow`: Flow editor and connection components
  - `/hooks`: Custom React hooks
  - `/stores`: State management
  - `/types`: TypeScript type definitions
  - `/utils`: Utility functions

### Backend Structure
- `/src-tauri`: Tauri configuration and Rust code
  - `/src`: Rust source code
  - `/python`: Python processing engine
    - `/__init__.py`: API endpoints and command handlers
    - `/models.py`: Data structures for pipeline execution
    - `/processor.py`: Node processors and execution engine

### Data Flow Model
The application uses an index-driven execution model:
1. The Index Source node generates a series of index values
2. For each index value, the entire pipeline is executed
3. Nodes process data and pass results to connected nodes
4. Results are aggregated at the Output node

## Python Processing Engine

### Core Components

#### `models.py`
Defines the data structures used in the pipeline:
- `NodeType`: Enum of available node types
- `NodeConfig`: Configuration for each node
- `NodeConnection`: Represents connections between nodes
- `Pipeline`: Complete pipeline definition
- `PipelineResult`: Results from pipeline execution

#### `processor.py`
Implements the processing logic:
- `NodeProcessor`: Base class for all node processors
- Specific node processor implementations (IndexSourceProcessor, SheetSelectorProcessor, etc.)
- `PipelineExecutor`: Orchestrates the execution of the pipeline

#### `__init__.py`
Exposes API endpoints:
- `execute_pipeline`: Executes a complete pipeline
- `test_pipeline_node`: Tests a specific node in the pipeline

### Execution Model
1. The pipeline is represented as a directed graph of nodes
2. Execution starts from the Index Source node
3. For each index value, the pipeline traverses the graph
4. Each node processes its inputs and produces outputs
5. Results are collected at the Output node

## Integration Points

### Tauri Commands
- `execute_pipeline`: Executes a complete pipeline
- `test_pipeline_node`: Tests execution from a specific node back to source nodes

### Data Exchange Format
Data is exchanged between React and Python using JSON:
- Pipeline configuration is passed from React to Python
- Processing results are returned from Python to React

## Recent Changes

### Python Backend Implementation
1. Created the core processing engine with support for:
   - Index-driven execution model
   - Multiple node types with specific processing logic
   - Test runs that trace back from any node to source nodes
   - Result aggregation for output

2. Implemented error handling:
   - Graceful handling of missing sheets or columns
   - Robust error reporting without crashing the pipeline
   - Warnings for non-critical issues

### Integration Work
1. Added Tauri command registration in `main.rs`
2. Updated React components to use the Python backend
3. Fixed type issues in the frontend code
4. Ensured proper data exchange between React and Python

### UI Enhancements
1. Added "Test Flow" button to node components
2. Implemented result visualization for node testing
3. Updated node configuration UI to match the Python backend requirements

## Future Work
1. Implement additional node types (data transformation, joins, etc.)
2. Add support for saving and loading pipeline templates
3. Enhance error reporting and visualization
4. Add support for additional file formats beyond Excel
5. Implement data preview functionality in the UI

## Development Guidelines
1. Follow the existing architecture pattern when adding new features
2. Maintain the decoupled design between UI and processing logic
3. Handle errors gracefully at all levels
4. Use type definitions consistently across the codebase
5. Test new node types thoroughly with various data scenarios 