import { useState, useCallback } from 'react';
import {
  Card,
  Typography,
  Tag,
  Button,
  Space,
  Input,
  Alert,
  Progress,
  Collapse,
  Modal,
  message,
} from 'antd';
import {
  RobotOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { DataItemStatus, type DataItem } from '../../../types';
import { ReviewStatus, type AIReviewResult, type FieldWarning, type MatchedRule } from '../../../types/aiReview';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ReviewActionPanelProps {
  dataItem: DataItem | null;
  aiReviewResult: AIReviewResult | undefined;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}

/** 严重程度 → 颜色 & 图标 */
function getSeverityStyle(severity: FieldWarning['severity']) {
  switch (severity) {
    case 'error':
      return { color: '#ff4d4f', bg: '#fff2f0', icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> };
    case 'warning':
      return { color: '#faad14', bg: '#fffbe6', icon: <WarningOutlined style={{ color: '#faad14' }} /> };
    case 'info':
      return { color: '#1890ff', bg: '#e6f7ff', icon: <InfoCircleOutlined style={{ color: '#1890ff' }} /> };
    default:
      return { color: '#d9d9d9', bg: '#fafafa', icon: <InfoCircleOutlined /> };
  }
}

/** 规则严重程度 → Tag 颜色 */
function getRuleSeverityColor(severity: MatchedRule['severity']) {
  switch (severity) {
    case 'error': return 'error';
    case 'warning': return 'warning';
    case 'info': return 'processing';
    default: return 'default';
  }
}

/** AI 预审结论 → 整体展示 */
function getReviewStatusDisplay(status: ReviewStatus) {
  switch (status) {
    case ReviewStatus.PASS:
      return { color: 'success', icon: <SafetyCertificateOutlined />, text: 'AI 预审通过', desc: '标注质量符合要求，建议通过审核' };
    case ReviewStatus.RISK:
      return { color: 'warning', icon: <WarningOutlined />, text: 'AI 预审存疑', desc: '标注存在潜在问题，建议仔细核查后决定' };
    case ReviewStatus.FAIL:
      return { color: 'error', icon: <CloseCircleOutlined />, text: 'AI 预审不通过', desc: '标注存在严重问题，建议驳回修正' };
    default:
      return { color: 'default', icon: <InfoCircleOutlined />, text: '未知', desc: '' };
  }
}

export default function ReviewActionPanel({ dataItem, aiReviewResult, onApprove, onReject }: ReviewActionPanelProps) {
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const isPending = dataItem?.status === DataItemStatus.PENDING_REVIEW;
  const isSubmitted = dataItem?.status === DataItemStatus.SUBMITTED ||
    dataItem?.status === DataItemStatus.AI_REVIEWING ||
    dataItem?.status === DataItemStatus.AI_REVIEWED;
  const canReview = isPending || isSubmitted;
  const isReviewed = dataItem?.status === DataItemStatus.REVIEWED;
  const isRejected = dataItem?.status === DataItemStatus.REJECTED;

  const handleApprove = useCallback(async () => {
    if (!dataItem) return;
    setApproving(true);
    try {
      onApprove(dataItem.id);
    } finally {
      setApproving(false);
    }
  }, [dataItem, onApprove]);

  const handleRejectOpen = useCallback(() => {
    setRejectReason('');
    setRejectModalOpen(true);
  }, []);

  const handleRejectConfirm = useCallback(async () => {
    if (!dataItem) return;
    if (!rejectReason.trim()) {
      message.warning('请填写驳回原因');
      return;
    }
    setRejecting(true);
    try {
      onReject(dataItem.id, rejectReason.trim());
      setRejectModalOpen(false);
    } finally {
      setRejecting(false);
    }
  }, [dataItem, rejectReason, onReject]);

  if (!dataItem) {
    return (
      <Card style={{ height: '100%' }} styles={{ body: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' } }}>
        <Text type="secondary">请选择待审核数据</Text>
      </Card>
    );
  }

  const statusDisplay = aiReviewResult ? getReviewStatusDisplay(aiReviewResult.reviewStatus) : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
      {/* AI 预审结论 */}
      {aiReviewResult && statusDisplay && (
        <Card
          title={
            <Space size="small" wrap>
              <RobotOutlined />
              <span>AI预审结果</span>
              <Tag color={statusDisplay.color} icon={statusDisplay.icon}>
                {statusDisplay.text}
              </Tag>
            </Space>
          }
          size="small"
          style={{ marginBottom: 12 }}
        >
          {/* 评分 & 结论 */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <Text strong style={{ fontSize: 28, color: aiReviewResult.score >= 80 ? '#52c41a' : aiReviewResult.score >= 60 ? '#faad14' : '#ff4d4f', marginRight: 8 }}>
                {aiReviewResult.score}
              </Text>
              <Text type="secondary">/ 100 分</Text>
            </div>
            <Progress
              percent={aiReviewResult.score}
              strokeColor={aiReviewResult.score >= 80 ? '#52c41a' : aiReviewResult.score >= 60 ? '#faad14' : '#ff4d4f'}
              showInfo={false}
              size="small"
            />
          </div>

          <Alert
            type={statusDisplay.color === 'success' ? 'success' : statusDisplay.color === 'warning' ? 'warning' : 'error'}
            message={statusDisplay.desc}
            showIcon
            style={{ marginBottom: 12 }}
          />

          <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
            {aiReviewResult.summary}
          </Paragraph>

          {/* 触发的规则 */}
          {aiReviewResult.matchedRules.length > 0 && (
            <Collapse
              size="small"
              items={[{
                key: 'rules',
                label: (
                  <Space>
                    <ThunderboltOutlined />
                    <span>触发规则 ({aiReviewResult.matchedRules.length})</span>
                  </Space>
                ),
                children: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {aiReviewResult.matchedRules.map((rule) => (
                      <div key={rule.ruleId} style={{ padding: '6px 8px', background: '#fafafa', borderRadius: 4 }}>
                        <div style={{ marginBottom: 4 }}>
                          <Tag color={getRuleSeverityColor(rule.severity)} style={{ marginRight: 4 }}>
                            {rule.severity === 'error' ? '严重' : rule.severity === 'warning' ? '警告' : '提示'}
                          </Tag>
                          <Text strong style={{ fontSize: 13 }}>{rule.name}</Text>
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>{rule.description}</Text>
                      </div>
                    ))}
                  </Space>
                ),
              }]}
              style={{ marginBottom: 8 }}
            />
          )}

          {/* 字段警告 */}
          {aiReviewResult.fieldWarnings.length > 0 && (
            <Collapse
              size="small"
              defaultActiveKey={['warnings']}
              items={[{
                key: 'warnings',
                label: (
                  <Space>
                    <WarningOutlined />
                    <span>字段警告 ({aiReviewResult.fieldWarnings.length})</span>
                  </Space>
                ),
                children: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {aiReviewResult.fieldWarnings.map((w, i) => {
                      const style = getSeverityStyle(w.severity);
                      return (
                        <div
                          key={`${w.fieldKey}-${i}`}
                          style={{
                            padding: '8px 10px',
                            background: style.bg,
                            borderRadius: 4,
                            borderLeft: `3px solid ${style.color}`,
                          }}
                        >
                          <div style={{ marginBottom: 4 }}>
                            {style.icon}
                            <Text strong style={{ marginLeft: 6, fontSize: 13 }}>{w.fieldLabel}</Text>
                            <Tag color={w.severity === 'error' ? 'error' : w.severity === 'warning' ? 'warning' : 'processing'} style={{ marginLeft: 6, fontSize: 11 }}>
                              {w.severity === 'error' ? '严重' : w.severity === 'warning' ? '警告' : '提示'}
                            </Tag>
                          </div>
                          <Text style={{ fontSize: 12 }}>{w.message}</Text>
                          {w.value !== undefined && (
                            <div style={{ marginTop: 4 }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>当前值: </Text>
                              <Text code style={{ fontSize: 11 }}>{JSON.stringify(w.value)}</Text>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </Space>
                ),
              }]}
              style={{ marginBottom: 8 }}
            />
          )}

          {/* 修改建议 */}
          {aiReviewResult.suggestions.length > 0 && (
            <Collapse
              size="small"
              items={[{
                key: 'suggestions',
                label: (
                  <Space>
                    <ThunderboltOutlined />
                    <span>修改建议 ({aiReviewResult.suggestions.length})</span>
                  </Space>
                ),
                children: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {aiReviewResult.suggestions.map((s, i) => (
                      <div
                        key={`${s.fieldKey}-${i}`}
                        style={{
                          padding: '8px 10px',
                          background: '#f6ffed',
                          borderRadius: 4,
                          borderLeft: '3px solid #52c41a',
                        }}
                      >
                        <div style={{ marginBottom: 4 }}>
                          <Text strong style={{ fontSize: 13 }}>{s.fieldLabel}</Text>
                          {s.current !== undefined && (
                            <span>
                              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>当前:</Text>
                              <Text code style={{ fontSize: 12 }}>{JSON.stringify(s.current)}</Text>
                            </span>
                          )}
                          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>建议:</Text>
                          <Text code style={{ fontSize: 12, color: '#52c41a' }}>{JSON.stringify(s.suggested)}</Text>
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>{s.reason}</Text>
                      </div>
                    ))}
                  </Space>
                ),
              }]}
            />
          )}

          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              模型版本: {aiReviewResult.modelVersion} · 预审时间: {new Date(aiReviewResult.reviewedAt).toLocaleString('zh-CN')}
            </Text>
          </div>
        </Card>
      )}

      {/* 审核操作面板 */}
      <Card
        title={
          <Space>
            <SafetyCertificateOutlined />
            <span>审核操作</span>
          </Space>
        }
        size="small"
      >
        {canReview && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {isPending ? (
              <Alert
                type="info"
                message="该数据项已通过 AI 预审，等待人工审核"
                showIcon
              />
            ) : isSubmitted ? (
              <Alert
                type="warning"
                message="该数据项已提交但尚未完成 AI 预审"
                description="AI 预审未完成，您可以直接审核，或等待 AI 预审完成后再审核。"
                showIcon
              />
            ) : null}
            <Space style={{ width: '100%', justifyContent: 'center' }}>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                size="large"
                loading={approving}
                onClick={handleApprove}
                style={{ minWidth: 120 }}
              >
                审核通过
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                size="large"
                onClick={handleRejectOpen}
                style={{ minWidth: 120 }}
              >
                驳回
              </Button>
            </Space>
          </Space>
        )}

        {isReviewed && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              type="success"
              message="该数据项已审核通过"
              description={
                <div>
                  <div>审核员: {dataItem.reviewer ?? '—'}</div>
                  {dataItem.reviewedAt && <div>审核时间: {new Date(dataItem.reviewedAt).toLocaleString('zh-CN')}</div>}
                  {dataItem.archived && <div style={{ marginTop: 4, color: '#52c41a' }}>✓ 已自动归档</div>}
                </div>
              }
              showIcon
              icon={<CheckCircleOutlined />}
            />
          </Space>
        )}

        {isRejected && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              type="error"
              message="该数据项已被驳回"
              description={
                <div>
                  <div>审核员: {dataItem.reviewer ?? '—'}</div>
                  {dataItem.reviewedAt && <div>驳回时间: {new Date(dataItem.reviewedAt).toLocaleString('zh-CN')}</div>}
                  {dataItem.rejectReason && (
                    <div style={{ marginTop: 8 }}>
                      <Text strong>驳回原因：</Text>
                      <Paragraph style={{ marginTop: 4, marginBottom: 0, color: '#ff4d4f' }}>
                        {dataItem.rejectReason}
                      </Paragraph>
                    </div>
                  )}
                </div>
              }
              showIcon
              icon={<CloseCircleOutlined />}
            />
          </Space>
        )}
      </Card>

      {/* 驳回原因弹窗 */}
      <Modal
        title="驳回标注"
        open={rejectModalOpen}
        onOk={handleRejectConfirm}
        onCancel={() => setRejectModalOpen(false)}
        confirmLoading={rejecting}
        okText="确认驳回"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        width={520}
      >
        <Alert
          type="warning"
          message="驳回后数据将退回给标注员重新标注，请填写驳回原因以便标注员修正。"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <div style={{ marginBottom: 8 }}>
          <Text strong>驳回原因 <Text type="danger">*</Text></Text>
        </div>
        <TextArea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="请详细说明驳回原因，帮助标注员理解问题并修正..."
          rows={5}
          maxLength={500}
          showCount
          autoFocus
        />
      </Modal>
    </div>
  );
}
