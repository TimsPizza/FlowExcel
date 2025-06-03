import React from 'react';
import { Container, Box, Heading, Separator, Text, Card, Flex, Badge } from '@radix-ui/themes';
import { NODE_CONNECTION_RULES, NODE_TYPE_DESCRIPTIONS, NODE_IO_CONFIG } from '@/lib/flowValidation';
import { NodeType } from '@/types/nodes';

/**
 * 限制流程构建模式演示页面
 */
export const RestrictedFlowDemoPage: React.FC = () => {
  return (
    <Container size="4" style={{ padding: '2rem' }}>
      <Box>
        <Heading size="6" mb="4">
          限制流程构建模式演示
        </Heading>
        
        <Text size="3" mb="4" color="gray">
          新的流程构建模式限制了节点之间的连接，确保数据流的逻辑性和一致性。
        </Text>

        <Heading size="4" mb="3">
          节点类型与连接规则
        </Heading>
        
        <Flex direction="column" gap="3" mb="6">
          {Object.entries(NODE_CONNECTION_RULES).map(([sourceType, targetTypes]) => (
            <Card key={sourceType} variant="surface">
              <Flex direction="column" gap="2">
                <Flex justify="between" align="center">
                  <Text size="3" weight="bold">
                    {NODE_TYPE_DESCRIPTIONS[sourceType as NodeType]}
                  </Text>
                  <Badge 
                    color={targetTypes.length === 0 ? "red" : "blue"}
                    variant="soft"
                  >
                    {targetTypes.length === 0 ? "终端节点" : `${targetTypes.length} 种后续`}
                  </Badge>
                </Flex>
                
                {targetTypes.length > 0 ? (
                  <Box>
                    <Text size="2" color="gray" mb="1">可连接到:</Text>
                    <Flex gap="1" wrap="wrap">
                      {targetTypes.map((targetType) => (
                        <Badge key={targetType} color="green" size="1">
                          {NODE_TYPE_DESCRIPTIONS[targetType]}
                        </Badge>
                      ))}
                    </Flex>
                  </Box>
                ) : (
                  <Text size="2" color="red">
                    此节点无后续连接（终端节点）
                  </Text>
                )}
              </Flex>
            </Card>
          ))}
        </Flex>

        <Separator my="6" size="4" />

        <Heading size="4" mb="3">
          节点输入输出限制
        </Heading>
        
        <Flex direction="column" gap="3" mb="6">
          {Object.entries(NODE_IO_CONFIG).map(([nodeType, config]) => (
            <Card key={nodeType} variant="surface">
              <Flex direction="column" gap="2">
                <Text size="3" weight="bold">
                  {NODE_TYPE_DESCRIPTIONS[nodeType as NodeType]}
                </Text>
                
                <Flex gap="4">
                  <Flex direction="column" gap="1">
                    <Text size="2" weight="medium">输入限制:</Text>
                    <Badge 
                      color={config.maxInputs === 0 ? "red" : config.maxInputs === 1 ? "blue" : "green"}
                      size="1"
                    >
                      {config.maxInputs === -1 ? "无限制" : 
                       config.maxInputs === 0 ? "无输入" : 
                       `最多 ${config.maxInputs} 个`}
                    </Badge>
                  </Flex>
                  
                  <Flex direction="column" gap="1">
                    <Text size="2" weight="medium">输出限制:</Text>
                    <Badge 
                      color={config.maxOutputs === 0 ? "red" : config.maxOutputs === 1 ? "blue" : "green"}
                      size="1"
                    >
                      {config.maxOutputs === -1 ? "无限制" : 
                       config.maxOutputs === 0 ? "无输出" : 
                       `最多 ${config.maxOutputs} 个`}
                    </Badge>
                  </Flex>
                  
                  <Flex direction="column" gap="1">
                    <Text size="2" weight="medium">要求:</Text>
                    <Flex gap="1">
                      {config.requiresInput && (
                        <Badge color="orange" size="1">必须有输入</Badge>
                      )}
                      {config.requiresOutput && (
                        <Badge color="purple" size="1">必须有输出</Badge>
                      )}
                    </Flex>
                  </Flex>
                </Flex>
              </Flex>
            </Card>
          ))}
        </Flex>

        <Separator my="6" size="4" />

        <Heading size="4" mb="3">
          新功能特点
        </Heading>
        
        <Flex direction="column" gap="3" mb="6">
          <Card variant="surface">
            <Flex direction="column" gap="2">
              <Text size="3" weight="bold" color="green">
                ✅ 从输出端点创建节点
              </Text>
              <Text size="2" color="gray">
                每个节点的输出端点都有"添加后续节点"按钮，只显示允许连接的节点类型。
              </Text>
            </Flex>
          </Card>

          <Card variant="surface">
            <Flex direction="column" gap="2">
              <Text size="3" weight="bold" color="green">
                ✅ 实时连接验证
              </Text>
              <Text size="2" color="gray">
                尝试创建不符合规则的连接时，系统会立即显示错误提示。
              </Text>
            </Flex>
          </Card>

          <Card variant="surface">
            <Flex direction="column" gap="2">
              <Text size="3" weight="bold" color="green">
                ✅ 流程完整性检查
              </Text>
              <Text size="2" color="gray">
                执行前会验证整个流程的完整性，检查孤立节点和必要的连接。
              </Text>
            </Flex>
          </Card>

          <Card variant="surface">
            <Flex direction="column" gap="2">
              <Text size="3" weight="bold" color="green">
                ✅ 实时验证面板
              </Text>
              <Text size="2" color="gray">
                右上角显示当前流程的验证状态，包括错误和警告信息。
              </Text>
            </Flex>
          </Card>
        </Flex>

        <Separator my="6" size="4" />

        <Heading size="4" mb="3">
          典型流程示例
        </Heading>
        
        <Card variant="surface">
          <Flex direction="column" gap="3">
            <Text size="3" weight="bold">推荐的数据处理流程:</Text>
            
            <Flex align="center" gap="2" wrap="wrap">
              <Badge color="blue" size="2">索引源</Badge>
              <Text>→</Text>
              <Badge color="green" size="2">Sheet定位</Badge>
              <Text>→</Text>
              <Badge color="orange" size="2">行过滤</Badge>
              <Text>→</Text>
              <Badge color="purple" size="2">统计</Badge>
              <Text>→</Text>
              <Badge color="red" size="2">输出</Badge>
            </Flex>
            
            <Text size="2" color="gray" mt="2">
              此流程展示了从数据源到最终输出的完整数据处理链路。每个步骤都有明确的功能定位，
              确保数据流的逻辑性和可维护性。
            </Text>
          </Flex>
        </Card>

        <Box mt="6" p="4" style={{ 
          background: 'var(--color-panel-solid)', 
          borderRadius: '8px',
          border: '1px solid var(--gray-6)'
        }}>
          <Text size="2" weight="bold" mb="2">使用说明:</Text>
          <Text size="2" color="gray">
            1. 从索引源节点开始构建流程<br/>
            2. 使用节点右侧的"添加后续节点"按钮创建连接<br/>
            3. 观察右上角的验证面板确保流程正确<br/>
            4. 配置好所有节点后执行完整流程
          </Text>
        </Box>
      </Box>
    </Container>
  );
}; 