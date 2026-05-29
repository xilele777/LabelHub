import { useMemo } from 'react';
import {
  Card,
  Tag,
  Progress,
  Descriptions,
  Alert,
  List,
  Typography,
  Collapse,
  Badge,
  Tooltip,
  Space,
  Divider,
  Button,
  Flex,
} from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  BulbOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  RobotOutlined,
  SwapRightOutlined,
  FieldNumberOutlined,
} from '@ant-design/icons';
import { ReviewStatus, type AIReviewResult, type FieldWarning, type ReviewSuggestion, type MatchedRule } from '../../../types/aiReview';

const { Text, Paragraph } = Typography;

// =====================================================================
//  常量映射
// =====================================================================

/** 审核状态 → 标签 / 颜色 / 图标 / Card 边框色 */
const statusMeta: Record<
  ReviewStatus,
  {
    label: string;
    tagColor: string;
    icon: React.ReactNode;
    alertType: 'success' | 'warning' | 'error';
    borderColor: string;
    bgTint: string;
    badgeStatus: 'success' | 'warning' | 'error';
  }
> = {
  [ReviewStatus.PASS]: {
    label: '通过',
    tagColor: 'success',
    icon: <CheckCircleOutlined />,
    alertType: 'success',
    borderColor: '#b7eb8f',
    bgTint: '#f6ffed',
    badgeStatus: 'success',
  },
  [ReviewStatus.RISK]: {
    label: '风险',
    tagColor: 'warning',
    icon: <WarningOutlined />,
    alertType: 'warning',
    borderColor: '#ffe58f',
    bgTint: '#fffbe6',
    badgeStatus: 'warning',
  },
  [ReviewStatus.FAIL]: {
    label: '不通过',
    tagColor: 'error',
    icon: <CloseCircleOutlined />,
    alertType: 'error',
    borderColor: '#ffccc7',
    bgTint: '#fff2f0',
    badgeStatus: 'error',
  },
};

/** 严重程度 → 颜色 / 标签 / 图标 */
const severityMeta = {
  error: { color: 'red', label: 'ERROR', icon: <CloseCircleOutlined /> },
  warning: { color: 'orange', label: 'WARN', icon: <ExclamationCircleOutlined /> },
  info: { color: 'blue', label: 'INFO', icon: <InfoCircleOutlined /> },
} as const;

/** 安全获取严重程度元信息，保证始终有返回值 */
function getSeverityMeta(severity: string) {
  return severityMeta[severity as keyof typeof severityMeta] ?? severityMeta.info;
}

/** 评分 → 颜色 / 等级文案 */
function scoreVisual(score: number) {
  if (score >= 80) return { color: '#52c41a', strokeColor: '#52c41a', grade: '优良' };
  if (score >= 60) return { color: '#faad14', strokeColor: '#faad14', grade: '一般' };
  return { color: '#ff4d4f', strokeColor: '#ff4d4f', grade: '较差' };
}

// =====================================================================
//  子组件：命中规则列表
// =====================================================================

function MatchedRulesSection({ rules }: { rules: MatchedRule[] }) {
  if (rules.length === 0) return null;

  return (
    <Collapse
      size="small"
      defaultActiveKey={['rules']}
      items={[
        {
          key: 'rules',
          label: (
            <Space>
              <FieldNumberOutlined />
              <Text strong>命中规则</Text>
              <Badge count={rules.length} size="small" />
            </Space>
          ),
          children: (
            <Descriptions size="small" column={1} bordered>
              {rules.map((rule) => {
                const sm = getSeverityMeta(rule.severity);
                return (
                  <Descriptions.Item
                    key={rule.ruleId}
                    label={
                      <Space size={4}>
                        <Tag color={sm.color} style={{ margin: 0 }}>
                          {sm.label}
                        </Tag>
                        <Text style={{ fontSize: 12 }} type="secondary">
                          {rule.ruleId}
                        </Text>
                      </Space>
                    }
                  >
                    <Text strong>{rule.name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {rule.description}
                    </Text>
                  </Descriptions.Item>
                );
              })}
            </Descriptions>
          ),
        },
      ]}
    />
  );
}

// =====================================================================
//  子组件：字段级警告
// =====================================================================

interface FieldWarningsProps {
  warnings: FieldWarning[];
  /** 点击字段名时回调，便于跳转到表单对应字段 */
  onFieldClick?: (fieldKey: string) => void;
}

function FieldWarningsSection({ warnings, onFieldClick }: FieldWarningsProps) {
  if (warnings.length === 0) return null;

  // 按 severity 排序：error > warning > info
  const sorted = [...warnings].sort((a, b) => {
    const order: Record<string, number> = { error: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  const errorCount = warnings.filter((w) => w.severity === 'error').length;
  const warningCount = warnings.filter((w) => w.severity === 'warning').length;
  const infoCount = warnings.filter((w) => w.severity === 'info').length;

  return (
    <Collapse
      size="small"
      defaultActiveKey={['warnings']}
      style={{ marginTop: 12 }}
      items={[
        {
          key: 'warnings',
          label: (
            <Space>
              <ExclamationCircleOutlined />
              <Text strong>字段警告</Text>
              {errorCount > 0 && (
                <Tag color="red" style={{ margin: 0 }}>
                  {errorCount} 严重
                </Tag>
              )}
              {warningCount > 0 && (
                <Tag color="orange" style={{ margin: 0 }}>
                  {warningCount} 警告
                </Tag>
              )}
              {infoCount > 0 && (
                <Tag color="blue" style={{ margin: 0 }}>
                  {infoCount} 提示
                </Tag>
              )}
            </Space>
          ),
          children: (
            <List
              size="small"
              dataSource={sorted}
              split
              renderItem={(w) => {
                const sm = getSeverityMeta(w.severity);
                const isClickable = !!onFieldClick;
                return (
                  <List.Item style={{ padding: '8px 12px' }}>
                    <Flex align="flex-start" gap={8} style={{ width: '100%' }}>
                      <Tag color={sm.color} icon={sm.icon} style={{ margin: 0, flexShrink: 0 }}>
                        {sm.label}
                      </Tag>
                      <Flex vertical gap={2} style={{ flex: 1, minWidth: 0 }}>
                        <Space size={4}>
                          <Text
                            strong
                            style={{
                              cursor: isClickable ? 'pointer' : 'default',
                              color: isClickable ? '#1677ff' : undefined,
                              textDecoration: isClickable ? 'underline' : undefined,
                            }}
                            onClick={() => onFieldClick?.(w.fieldKey)}
                          >
                            {w.fieldLabel}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            ({w.fieldKey})
                          </Text>
                        </Space>
                        <Text
                          type={w.severity === 'error' ? 'danger' : undefined}
                          style={{ fontSize: 13 }}
                        >
                          {w.message}
                        </Text>
                        {w.value !== undefined && w.value !== '' && (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            当前值：{String(w.value)}
                          </Text>
                        )}
                      </Flex>
                    </Flex>
                  </List.Item>
                );
              }}
            />
          ),
        },
      ]}
    />
  );
}

// =====================================================================
//  子组件：优化建议
// =====================================================================

interface SuggestionsProps {
  suggestions: ReviewSuggestion[];
  /** 点击"采纳"时回调 */
  onApplySuggestion?: (suggestion: ReviewSuggestion) => void;
}

function SuggestionsSection({ suggestions, onApplySuggestion }: SuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <Collapse
      size="small"
      defaultActiveKey={['suggestions']}
      style={{ marginTop: 12 }}
      items={[
        {
          key: 'suggestions',
          label: (
            <Space>
              <BulbOutlined style={{ color: '#faad14' }} />
              <Text strong>优化建议</Text>
              <Badge count={suggestions.length} size="small" color="#faad14" />
            </Space>
          ),
          children: (
            <List
              size="small"
              dataSource={suggestions}
              split
              renderItem={(s) => (
                <List.Item
                  style={{ padding: '8px 12px' }}
                  actions={
                    onApplySuggestion
                      ? [
                          <Button
                            key="apply"
                            type="link"
                            size="small"
                            icon={<SwapRightOutlined />}
                            onClick={() => onApplySuggestion(s)}
                          >
                            采纳
                          </Button>,
                        ]
                      : undefined
                  }
                >
                  <Flex vertical gap={4} style={{ flex: 1, minWidth: 0 }}>
                    <Space size={4}>
                      <Text strong>{s.fieldLabel}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        ({s.fieldKey})
                      </Text>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {s.reason}
                    </Text>
                    <Space size={4} wrap>
                      {s.current !== undefined && (
                        <Tag color="default">当前：{String(s.current)}</Tag>
                      )}
                      {s.suggested !== undefined && (
                        <Tag color="green">
                          <SwapRightOutlined style={{ marginRight: 2 }} />
                          建议：{String(s.suggested)}
                        </Tag>
                      )}
                    </Space>
                  </Flex>
                </List.Item>
              )}
            />
          ),
        },
      ]}
    />
  );
}

// =====================================================================
//  主组件
// =====================================================================

export interface AIReviewPanelProps {
  /** AI 预审结果 */
  result: AIReviewResult;
  /** 点击字段警告时回调，便于跳转到表单对应字段 */
  onFieldClick?: (fieldKey: string) => void;
  /** 点击"采纳建议"时回调 */
  onApplySuggestion?: (suggestion: ReviewSuggestion) => void;
  /** 是否紧凑模式（审核工作台右侧面板等窄空间） */
  compact?: boolean;
  /** 自定义 Card style */
  style?: React.CSSProperties;
  /** 自定义 Card className */
  className?: string;
}

export default function AIReviewPanel({
  result,
  onFieldClick,
  onApplySuggestion,
  compact = false,
  style,
  className,
}: AIReviewPanelProps) {
  const meta = statusMeta[result.reviewStatus];
  const sv = scoreVisual(result.score);

  // 统计
  const stats = useMemo(() => {
    const e = result.fieldWarnings.filter((w) => w.severity === 'error').length;
    const w = result.fieldWarnings.filter((w) => w.severity === 'warning').length;
    const i = result.fieldWarnings.filter((w) => w.severity === 'info').length;
    return { error: e, warning: w, info: i, total: e + w + i };
  }, [result.fieldWarnings]);

  const hasIssues = stats.total > 0;

  return (
    <Card
      title={
        <Space>
          <RobotOutlined />
          <span>AI 预审结果</span>
        </Space>
      }
      size="small"
      className={className}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderLeft: `4px solid ${meta.borderColor}`,
        background: meta.bgTint,
        ...style,
      }}
      styles={{
        body: {
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
          padding: compact ? 12 : 16,
        },
      }}
      extra={
        <Tag
          color={meta.tagColor}
          icon={meta.icon}
          style={{ fontSize: 14, padding: '2px 12px', fontWeight: 600 }}
        >
          {meta.label}
        </Tag>
      }
    >
      {/* ── 1. 评分区 ── */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <Progress
          type="dashboard"
          percent={result.score}
          strokeColor={sv.strokeColor}
          format={(percent) => (
            <span style={{ fontSize: compact ? 18 : 22, fontWeight: 700, color: sv.color }}>
              {percent}
            </span>
          )}
          size={compact ? 80 : 100}
        />
        <div style={{ marginTop: 2 }}>
          <Text
            style={{ fontSize: 13, fontWeight: 600, color: sv.color }}
          >
            质量评分 · {sv.grade}
          </Text>
        </div>
      </div>

      {/* ── 2. 预审摘要 ── */}
      <Alert
        message="预审摘要"
        description={<Paragraph style={{ margin: 0, fontSize: 13 }}>{result.summary}</Paragraph>}
        type={meta.alertType}
        showIcon
        icon={meta.icon}
        style={{ marginBottom: 12 }}
      />

      {/* ── 快速统计 ── */}
      {hasIssues && (
        <div style={{ marginBottom: 12 }}>
          <Space size={12} wrap>
            {stats.error > 0 && (
              <Badge status="error" text={<Text type="danger">严重 {stats.error}</Text>} />
            )}
            {stats.warning > 0 && (
              <Badge status="warning" text={<Text style={{ color: '#d46b08' }}>警告 {stats.warning}</Text>} />
            )}
            {stats.info > 0 && (
              <Badge status="processing" text={<Text type="secondary">提示 {stats.info}</Text>} />
            )}
          </Space>
        </div>
      )}

      {/* 无问题提示 */}
      {!hasIssues && (
        <Alert
          message="未发现标注问题，标注质量良好"
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: 12 }}
        />
      )}

      <Divider style={{ margin: '8px 0' }} />

      {/* ── 3. 命中规则 ── */}
      <MatchedRulesSection rules={result.matchedRules} />

      {/* ── 4. 字段级警告 ── */}
      <FieldWarningsSection warnings={result.fieldWarnings} onFieldClick={onFieldClick} />

      {/* ── 5. 优化建议 ── */}
      <SuggestionsSection suggestions={result.suggestions} onApplySuggestion={onApplySuggestion} />

      {/* ── 6. 元信息 ── */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 8,
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Tooltip title={`模型版本：${result.modelVersion}`}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            <RobotOutlined style={{ marginRight: 4 }} />
            {result.modelVersion}
          </Text>
        </Tooltip>
        <Tooltip title={new Date(result.reviewedAt).toLocaleString()}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            预审时间：{new Date(result.reviewedAt).toLocaleString()}
          </Text>
        </Tooltip>
      </div>
    </Card>
  );
}
