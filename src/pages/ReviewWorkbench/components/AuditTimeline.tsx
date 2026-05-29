import { Timeline, Tag, Typography, Empty, Space, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SendOutlined,
  SaveOutlined,
  RobotOutlined,
  AuditOutlined,
  FileTextOutlined,
  EditOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { DataItemStatus, AuditActionType, STATUS_DISPLAY_CONFIG, type AuditHistoryRecord } from '../../../types';

const { Text, Paragraph } = Typography;

/** 操作类型 → 显示文本 & 颜色 */
const ACTION_DISPLAY: Record<AuditActionType, { label: string; color: string; tagColor: string }> = {
  [AuditActionType.SUBMIT]: { label: '提交标注', color: '#1890ff', tagColor: 'processing' },
  [AuditActionType.SAVE_DRAFT]: { label: '保存草稿', color: '#faad14', tagColor: 'warning' },
  [AuditActionType.CLAIM_ASSIGNMENT]: { label: '领取标注', color: '#2f54eb', tagColor: 'blue' },
  [AuditActionType.AI_REVIEW_START]: { label: 'AI预审开始', color: '#722ed1', tagColor: 'purple' },
  [AuditActionType.AI_REVIEW_COMPLETE]: { label: 'AI预审完成', color: '#13c2c2', tagColor: 'cyan' },
  [AuditActionType.ASSIGN_REVIEWER]: { label: '分配审核员', color: '#fa8c16', tagColor: 'orange' },
  [AuditActionType.CLAIM_REVIEW]: { label: '领取审核', color: '#1677ff', tagColor: 'processing' },
  [AuditActionType.APPROVE]: { label: '审核通过', color: '#52c41a', tagColor: 'success' },
  [AuditActionType.REJECT]: { label: '审核驳回', color: '#ff4d4f', tagColor: 'error' },
  [AuditActionType.RESUBMIT]: { label: '重新提交', color: '#1890ff', tagColor: 'processing' },
  [AuditActionType.RELEASE_ANNOTATION_DUE_OVERDUE]: { label: '标注逾期释放', color: '#fa8c16', tagColor: 'warning' },
  [AuditActionType.RELEASE_REVIEW_DUE_OVERDUE]: { label: '审核逾期释放', color: '#fa8c16', tagColor: 'warning' },
  [AuditActionType.ARCHIVE]: { label: '归档', color: '#52c41a', tagColor: 'success' },
  [AuditActionType.UNARCHIVE]: { label: '取消归档', color: '#faad14', tagColor: 'warning' },
};

/** 操作类型 → Timeline dot 图标 */
function getActionIcon(actionType: AuditActionType) {
  switch (actionType) {
    case AuditActionType.SUBMIT:
    case AuditActionType.RESUBMIT:
      return <SendOutlined style={{ fontSize: 12 }} />;
    case AuditActionType.SAVE_DRAFT:
      return <SaveOutlined style={{ fontSize: 12 }} />;
    case AuditActionType.AI_REVIEW_START:
      return <RobotOutlined style={{ fontSize: 12 }} />;
    case AuditActionType.AI_REVIEW_COMPLETE:
      return <RobotOutlined style={{ fontSize: 12 }} />;
    case AuditActionType.ASSIGN_REVIEWER:
      return <AuditOutlined style={{ fontSize: 12 }} />;
    case AuditActionType.APPROVE:
      return <CheckCircleOutlined style={{ fontSize: 12 }} />;
    case AuditActionType.REJECT:
      return <CloseCircleOutlined style={{ fontSize: 12 }} />;
    default:
      return <ClockCircleOutlined style={{ fontSize: 12 }} />;
  }
}

/** 格式化时间显示 */
function formatTimestamp(isoStr: string): { date: string; time: string } {
  const d = new Date(isoStr);
  const date = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return { date, time };
}

/** 状态标签 */
function StatusTag({ status }: { status: DataItemStatus }) {
  const config = STATUS_DISPLAY_CONFIG[status];
  if (!config) return <Tag>{status}</Tag>;
  return <Tag color={config.color}>{config.label}</Tag>;
}

interface AuditTimelineProps {
  history: AuditHistoryRecord[];
  /** 是否为紧凑模式（用于侧边栏等空间有限的场景） */
  compact?: boolean;
}

export default function AuditTimeline({ history, compact = false }: AuditTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无审核记录"
        style={{ padding: '20px 0' }}
      />
    );
  }

  return (
    <Timeline
      mode={compact ? 'left' : 'alternate'}
      items={history.map((record, index) => {
        const actionInfo = ACTION_DISPLAY[record.actionType as AuditActionType] ?? {
          label: record.actionType,
          color: '#8c8c8c',
          tagColor: 'default',
        };
        const icon = getActionIcon(record.actionType as AuditActionType);
        const { date, time } = formatTimestamp(record.timestamp);
        const isLast = index === history.length - 1;

        return {
          color: actionInfo.color,
          dot: (
            <Tooltip title={actionInfo.label}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: isLast ? actionInfo.color : 'transparent',
                  color: isLast ? '#fff' : actionInfo.color,
                  border: isLast ? 'none' : `1.5px solid ${actionInfo.color}`,
                  fontSize: 12,
                  transition: 'all 0.3s',
                }}
              >
                {icon}
              </span>
            </Tooltip>
          ),
          children: (
            <div style={{ paddingBottom: compact ? 4 : 8 }}>
              {/* 操作标题行 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                <Tag color={actionInfo.tagColor} style={{ margin: 0, fontSize: 12 }}>
                  {actionInfo.label}
                </Tag>
                <StatusTag status={record.fromStatus} />
                <Text type="secondary" style={{ fontSize: 11 }}>→</Text>
                <StatusTag status={record.toStatus} />
              </div>

              {/* 操作人 & 时间 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: record.reason ? 4 : 0 }}>
                <Space size={4} style={{ fontSize: 12 }}>
                  <UserOutlined style={{ color: '#8c8c8c' }} />
                  <Text style={{ fontSize: 12, color: '#595959' }}>{record.operator}</Text>
                </Space>
                <Tooltip title={new Date(record.timestamp).toLocaleString('zh-CN')}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    <ClockCircleOutlined style={{ marginRight: 3 }} />
                    {date} {time}
                  </Text>
                </Tooltip>
              </div>

              {/* 原因/备注（驳回时显示） */}
              {record.reason && (
                <Paragraph
                  type="secondary"
                  style={{
                    fontSize: 12,
                    marginBottom: 0,
                    marginTop: 4,
                    padding: '4px 8px',
                    background: record.actionType === AuditActionType.REJECT ? '#fff2f0' : '#f6f6f6',
                    borderRadius: 4,
                    borderLeft: record.actionType === AuditActionType.REJECT
                      ? '3px solid #ff4d4f'
                      : '3px solid #d9d9d9',
                  }}
                >
                  {record.actionType === AuditActionType.REJECT ? '❌ ' : '💬 '}
                  {record.reason}
                </Paragraph>
              )}
            </div>
          ),
        };
      })}
    />
  );
}

/** 状态流转步骤条组件（用于展示当前数据项在整体流程中的位置） */
export function StatusFlowSteps({ currentStatus }: { currentStatus: DataItemStatus }) {
  const statusOrder = [
    DataItemStatus.PENDING,
    DataItemStatus.DRAFT,
    DataItemStatus.SUBMITTED,
    DataItemStatus.AI_REVIEWING,
    DataItemStatus.AI_REVIEWED,
    DataItemStatus.PENDING_REVIEW,
    DataItemStatus.REVIEWED,
  ];

  const currentStepIndex = statusOrder.indexOf(currentStatus);

  const iconMap: Record<string, React.ReactNode> = {
    [DataItemStatus.PENDING]: <FileTextOutlined />,
    [DataItemStatus.DRAFT]: <EditOutlined />,
    [DataItemStatus.SUBMITTED]: <SendOutlined />,
    [DataItemStatus.AI_REVIEWING]: <RobotOutlined />,
    [DataItemStatus.AI_REVIEWED]: <RobotOutlined />,
    [DataItemStatus.PENDING_REVIEW]: <AuditOutlined />,
    [DataItemStatus.REVIEWED]: <CheckCircleOutlined />,
  };

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 0, flexWrap: 'wrap', overflow: 'hidden' }}>
        {statusOrder.map((status, idx) => {
          const config = STATUS_DISPLAY_CONFIG[status];
          const isCurrent = status === currentStatus;
          const isPast = idx < currentStepIndex;
          const isRejected = currentStatus === DataItemStatus.REJECTED && status === DataItemStatus.PENDING_REVIEW;

          // 驳回状态：PENDING_REVIEW 步骤标红
          let stepColor = '#d9d9d9';
          let stepBg = '#fafafa';
          if (isPast) {
            stepColor = '#52c41a';
            stepBg = '#f6ffed';
          }
          if (isCurrent) {
            stepColor = '#1890ff';
            stepBg = '#e6f7ff';
          }
          if (isRejected) {
            stepColor = '#ff4d4f';
            stepBg = '#fff2f0';
          }

          return (
            <div key={status} style={{ display: 'flex', alignItems: 'center' }}>
              <Tooltip title={config?.label ?? status}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '3px 6px',
                    borderRadius: 4,
                    background: stepBg,
                    border: `1.5px solid ${isCurrent ? stepColor : isPast ? '#b7eb8f' : '#f0f0f0'}`,
                    transition: 'all 0.3s',
                  }}
                >
                  <span style={{ color: stepColor, fontSize: 14, marginBottom: 1 }}>
                    {iconMap[status] ?? <ClockCircleOutlined />}
                  </span>
                  <span style={{ fontSize: 10, color: stepColor, fontWeight: isCurrent ? 600 : 400, whiteSpace: 'nowrap' }}>
                    {config?.label ?? status}
                  </span>
                </div>
              </Tooltip>
              {idx < statusOrder.length - 1 && (
                <div
                  style={{
                    width: 8,
                    height: 2,
                    background: idx < currentStepIndex ? '#b7eb8f' : '#f0f0f0',
                    margin: '0 1px',
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* 驳回状态额外提示 */}
      {currentStatus === DataItemStatus.REJECTED && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Tag icon={<CloseCircleOutlined />} color="error" style={{ fontSize: 12 }}>
            已驳回 — 可重新标注提交
          </Tag>
        </div>
      )}
    </div>
  );
}
