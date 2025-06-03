import React from 'react';
import { Card, Flex, Text, Badge, Table, ScrollArea } from '@radix-ui/themes';
import type { 
  PreviewNodeResult, 
  IndexSourcePreviewResult, 
  DataFramePreviewResult, 
  AggregationPreviewResult 
} from '@/types';
import { 
  isIndexSourcePreview, 
  isDataFramePreview, 
  isAggregationPreview,
  getPreviewMetadata 
} from '@/lib/utils';

interface NodePreviewProps {
  result: PreviewNodeResult;
  className?: string;
}

export const NodePreview: React.FC<NodePreviewProps> = ({ result, className }) => {
  if (!result.success) {
    return (
      <Card className={className}>
        <Flex direction="column" gap="2">
          <Flex align="center" gap="2">
            <Badge color="red">预览失败</Badge>
            <Text size="2" weight="bold">{result.node_type}</Text>
          </Flex>
          <Text size="1" color="red">{result.error}</Text>
        </Flex>
      </Card>
    );
  }

  const metadata = getPreviewMetadata(result);

  return (
    <Card className={className}>
      <Flex direction="column" gap="3">
        {/* Header */}
        <Flex align="center" justify="between">
          <Flex align="center" gap="2">
            <Badge color="green">预览成功</Badge>
            <Text size="2" weight="bold">{result.node_type}</Text>
            <Text size="1" color="gray">ID: {result.node_id}</Text>
          </Flex>
          <Text size="1" color="gray">
            {metadata.execution_time_ms}ms
          </Text>
        </Flex>

        {/* Content based on node type */}
        {isIndexSourcePreview(result) && (
          <IndexSourcePreview result={result} />
        )}
        
        {isDataFramePreview(result) && (
          <DataFramePreview result={result} />
        )}
        
        {isAggregationPreview(result) && (
          <AggregationPreview result={result} />
        )}
      </Flex>
    </Card>
  );
};

const IndexSourcePreview: React.FC<{ result: IndexSourcePreviewResult }> = ({ result }) => {
  return (
    <Flex direction="column" gap="2">
      <Flex align="center" gap="4">
        <Text size="1">
          <strong>索引列:</strong> {result.source_column || '未指定'}
        </Text>
        <Text size="1">
          <strong>索引值数量:</strong> {result.index_values.length}
        </Text>
      </Flex>
      
      <ScrollArea style={{ height: '200px' }}>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>索引值</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {result.preview_data.data.map((row, index) => (
              <Table.Row key={index}>
                <Table.Cell>{row[0]}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </ScrollArea>
    </Flex>
  );
};

const DataFramePreview: React.FC<{ result: DataFramePreviewResult }> = ({ result }) => {
  return (
    <Flex direction="column" gap="3">
      <Text size="1">
        <strong>数据表数量:</strong> {result.dataframe_previews.length}
      </Text>
      
      {result.dataframe_previews.map((preview, index) => (
        <Card key={index} variant="surface">
          <Flex direction="column" gap="2">
            <Flex align="center" justify="between">
              <Text size="2" weight="bold">{preview.sheet_name}</Text>
              <Text size="1" color="gray">
                {preview.metadata.preview_rows} / {preview.metadata.total_rows} 行
              </Text>
            </Flex>
            
            <ScrollArea style={{ height: '200px' }}>
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    {preview.columns.map((column, colIndex) => (
                      <Table.ColumnHeaderCell key={colIndex}>
                        {column}
                      </Table.ColumnHeaderCell>
                    ))}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {preview.data.slice(0, 10).map((row, rowIndex) => (
                    <Table.Row key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <Table.Cell key={cellIndex}>
                          {cell?.toString() || ''}
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </ScrollArea>
          </Flex>
        </Card>
      ))}
    </Flex>
  );
};

const AggregationPreview: React.FC<{ result: AggregationPreviewResult }> = ({ result }) => {
  return (
    <Flex direction="column" gap="2">
      <Text size="1">
        <strong>聚合结果数量:</strong> {result.aggregation_results.length}
      </Text>
      
      <ScrollArea style={{ height: '200px' }}>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>索引值</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>列名</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>操作</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>结果值</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {result.aggregation_results.map((agg, index) => (
              <Table.Row key={index}>
                <Table.Cell>{agg.index_value}</Table.Cell>
                <Table.Cell>{agg.column_name}</Table.Cell>
                <Table.Cell>{agg.operation}</Table.Cell>
                <Table.Cell>{agg.result_value?.toString() || ''}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </ScrollArea>
    </Flex>
  );
}; 