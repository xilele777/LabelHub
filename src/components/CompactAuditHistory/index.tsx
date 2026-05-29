import { Empty, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';

import { AuditActionType, type AuditHistoryRecord } from '../../types';

const { Text } = Typography;

const actionMeta: Record<string, { label: string; color: string }> = {
  [AuditActionType.CLAIM_ASSIGNMENT]: { label: '领取标注', color: 'blue' },
  [AuditActionType.SAVE_DRAFT]: { label: '保存草稿', color: 'gold' },
  [AuditActionType.SUBMIT]: { label: '提交标注', color: 'processing' },
  [AuditActionType.AI_REVIEW_START]: { label: 'AI预审开始', color: 'purple' },
  [AuditActionType.AI_REVIEW_COMPLETE]: { label: 'AI预审完成', color: 'cyan' },
  [AuditActionType.ASSIGN_REVIEWER]: { label: '进入审核', color: 'orange' },
  [AuditActionType.CLAIM_REVIEW]: { label: '领取审核', color: 'blue' },
  [AuditActionType.APPROVE]: { label: '审核通过', color: 'success' },
  [AuditActionType.REJECT]: { label: '审核驳回', color: 'error' },
  [AuditActionType.RESUBMIT]: { label: '重新提交', color: 'processing' },
  [AuditActionType.ARCHIVE]: { label: '归档', color: 'success' },
  [AuditActionType.UNARCHIVE]: { label: '取消归档', color: 'warning' },
  [AuditActionType.RELEASE_ANNOTATION_DUE_OVERDUE]: { label: '标注逾期释放', color: 'warning' },
  [AuditActionType.RELEASE_REVIEW_DUE_OVERDUE]: { label: '审核逾期释放', color: 'warning' },
};

interface CompactAuditHistoryProps {
  history: AuditHistoryRecord[];
  maxItems?: number;
}

export default function CompactAuditHistory({ history, maxItems }: CompactAuditHistoryProps) {
  if (!history || history.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无流转记录" />;
  }

  const records = maxItems ? history.slice(-maxItems) : history;

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {records.map((record, index) => {
        const meta = actionMeta[record.actionType] ?? { label: record.actionType, color: 'default' };
        return (
          <div
            key={record.id || `${record.actionType}-${record.timestamp}-${index}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '104px 96px 76px minmax(0, 1fr)',
              gap: 8,
              alignItems: 'center',
              padding: '6px 8px',
              borderBottom: index === records.length - 1 ? 'none' : '1px solid #f0f0f0',
              fontSize: 12,
            }}
          >
            <Text type="secondary">{dayjs(record.timestamp).format('MM-DD HH:mm')}</Text>
            <Tag color={meta.color} style={{ margin: 0 }}>
              {meta.label}
            </Tag>
            <Text>{record.operator || '-'}</Text>
            <Text type="secondary" ellipsis={{ tooltip: record.reason || undefined }}>
              {record.reason || '-'}
            </Text>
          </div>
        );
      })}
    </Space>
  );
}
