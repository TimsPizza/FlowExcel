# Python Pipeline执行引擎

这是一个支持索引驱动的多实例执行的数据处理pipeline引擎，专门为Excel ETL操作设计。

## 核心特性

1. **索引驱动执行**: 每个索引值启动一次完整的pipeline执行
2. **多种节点类型**: 支持索引源、Sheet定位、行过滤、行查找、聚合、输出等节点
3. **测试运行**: 支持从任意节点向上回溯执行，便于调试
4. **Excel输出**: 支持将多个索引的结果输出到不同的Excel sheet

## 架构概述

### 核心组件

- `models.py`: 定义数据模型和类型
- `processor.py`: 包含所有节点处理器和主执行器
- `__init__.py`: 对外API接口

### 节点类型

1. **IndexSource (索引源)**: 从Excel文件的指定列提取唯一值作为索引
2. **SheetSelector (Sheet定位)**: 根据索引值选择对应的sheet
3. **RowFilter (行过滤)**: 根据条件过滤数据行
4. **RowLookup (行查找)**: 根据索引值匹配特定行
5. **Aggregator (聚合器)**: 对数据进行聚合统计
6. **Output (输出)**: 格式化输出结果

## 使用方法

### 基本API

```python
from pipeline import execute_pipeline, test_pipeline_node

# 执行完整pipeline
result = execute_pipeline(pipeline_json)

# 测试单个节点
node_result = test_pipeline_node(pipeline_json, node_id)
```

### JSON数据格式

Pipeline数据应包含以下结构：

```json
{
  "files": [
    {
      "id": "file_id",
      "name": "filename.xlsx",
      "path": "/path/to/file.xlsx",
      "sheet_metas": [
        {
          "sheet_name": "Sheet1",
          "header_row": 0
        }
      ]
    }
  ],
  "flow_nodes": [
    {
      "id": "node_id",
      "type": "indexSource",
      "data": {
        "nodeType": "indexSource",
        "sourceFileID": "file_id",
        "sheetName": "Sheet1",
        "columnName": "CategoryColumn",
        "byColumn": true
      }
    }
  ],
  "flow_edges": [
    {
      "source": "source_node_id",
      "target": "target_node_id"
    }
  ]
}
```

### 执行模型

1. **索引提取**: 从索引源节点提取索引值列表
2. **多实例执行**: 为每个索引值创建一个执行实例
3. **数据传递**: 索引值在pipeline中传播，影响节点行为
4. **结果聚合**: 收集所有索引的执行结果

## 测试

运行测试脚本：

```bash
# 基础测试
python test_pipeline.py

# 使用真实数据测试
python test_real_data.py
```

## 节点配置

### IndexSource节点

```json
{
  "nodeType": "indexSource",
  "sourceFileID": "file_id",
  "sheetName": "sheet_name",
  "columnName": "column_name",
  "byColumn": true
}
```

### SheetSelector节点

```json
{
  "nodeType": "sheetSelector", 
  "targetFileID": "file_id",
  "mode": "auto_by_index",  // 或 "manual"
  "manualSheetName": "sheet_name"  // 仅在manual模式下需要
}
```

### RowFilter节点

```json
{
  "nodeType": "rowFilter",
  "conditions": [
    {
      "column": "column_name",
      "operator": ">",  // ==, !=, >, >=, <, <=, contains, etc.
      "value": 100,
      "logic": "AND"  // AND, OR
    }
  ]
}
```

### RowLookup节点

```json
{
  "nodeType": "rowLookup",
  "matchColumn": "column_name"  // 用于匹配当前索引值的列
}
```

### Aggregator节点

```json
{
  "nodeType": "aggregator",
  "statColumn": "column_name",
  "method": "sum"  // sum, avg, count, min, max
}
```

### Output节点

```json
{
  "nodeType": "output",
  "outputFormat": "excel"  // table, csv, excel
}
```

## 错误处理

执行器会捕获并报告各种错误：

- 文件不存在或无法读取
- Sheet不存在
- 列不存在  
- 聚合操作失败
- 数据类型错误

所有错误信息都会包含在返回结果中，便于前端显示。

### 鲁棒性处理

为了提高ETL处理的鲁棒性，引擎会优雅地处理以下常见情况：

1. **Sheet不匹配**: 当索引值对应的sheet在目标文件中不存在时，系统会打印警告信息并跳过该索引值，继续处理其他有效索引值。

2. **行匹配失败**: 当在指定列中找不到匹配当前索引值的行时，系统会返回空结果并继续处理，而不是中断整个pipeline。

3. **列不存在**: 当统计列或匹配列在数据中不存在时，系统会跳过该索引值的处理。

4. **聚合失败**: 当聚合操作产生NaN结果或遇到数据类型问题时，系统会记录警告并跳过。

这种设计确保了即使部分数据有问题，整个ETL流程仍能继续执行并处理有效的数据部分。

## 性能考虑

- Excel文件会被缓存在内存中，避免重复读取
- 支持处理大量索引值的并发执行
- 结果数据会被限制大小以避免内存溢出 