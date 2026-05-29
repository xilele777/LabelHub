import React, { useMemo } from 'react';
import { List, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { DataItemStatus, type DataItem } from '../../../types';
import { ReviewStatus, type AIReviewResult } from '../../../types/aiReview';

const { Text, Paragraph } = Typography;

interface ReviewListProps {
  items: DataItem[];
  aiReviewResults: AIReviewResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** AI 预审结论 → 标签颜色 & 图标 */
function getAIReviewTag(reviewStatus?: ReviewStatus) {
  switch (reviewStatus) {
    case ReviewStatus.PASS:
      return { color: 'success', icon: <CheckCircleOutlined />, text: '通过' };
    case ReviewStatus.RISK:
      return { color: 'warning', icon: <WarningOutlined />, text: '风险' };
    case ReviewStatus.FAIL:
      return { color: 'error', icon: <CloseCircleOutlined />, text: '不通过' };
    default:
      return { color: 'default', icon: <ExclamationCircleOutlined />, text: '未知' };
  }
}

export default function ReviewList({ items, aiReviewResults, selectedId, onSelect }: ReviewListProps) {
  // 构建 itemId → AI预审结果 的映射
  const aiResultMap = useMemo(() => {
    const map = new Map<string, AIReviewResult>();
    aiReviewResults.forEach((r) => map.set(r.dataItemId, r));
    return map;
  }, [aiReviewResults]);

  // 按任务名分组
  const groupedItems = useMemo(() => {
    const groups = new Map<string, DataItem[]>();
    items.forEach((item) => {
      const key = item.taskId;
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    });
    return groups;
  }, [items]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 数据列表 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {Array.from(groupedItems.entries()).map(([taskId, groupItems]) => (
          <div key={taskId}>
            <div style={{ padding: '8px 16px', background: '#fafafa', fontWeight: 600, fontSize: 13 }}>
              任务: {groupItems[0]?.taskId}
            </div>
            <List
              dataSource={groupItems}
              renderItem={(item) => {
                const aiResult = aiResultMap.get(item.id);
                const aiTag = getAIReviewTag(aiResult?.reviewStatus);
                const isSelected = item.id === selectedId;
                const isPendingReview = item.status === DataItemStatus.PENDING_REVIEW;
                const isSubmitted = item.status === DataItemStatus.SUBMITTED ||
                  item.status === DataItemStatus.AI_REVIEWING ||
                  item.status === DataItemStatus.AI_REVIEWED;

                // 状态标签
                let statusTag: React.ReactNode = null;
                if (isSubmitted) {
                  statusTag = (
                    <Tag color="purple" style={{ fontSize: 11, margin: 0 }}>
                      AI预审中
                    </Tag>
                  );
                } else if (isPendingReview && aiResult) {
                  statusTag = (
                    <Tag color={aiTag.color} icon={aiTag.icon} style={{ fontSize: 11, margin: 0 }}>
                      {aiResult.score}分
                    </Tag>
                  );
                } else if (isPendingReview) {
                  statusTag = (
                    <Tag color="processing" style={{ fontSize: 11, margin: 0 }}>
                      待审核
                    </Tag>
                  );
                } else if (item.status === DataItemStatus.REVIEWED) {
                  statusTag = (
                    <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontSize: 11, margin: 0 }}>
                      已通过
                    </Tag>
                  );
                } else if (item.status === DataItemStatus.REJECTED) {
                  statusTag = (
                    <Tag color="error" icon={<CloseCircleOutlined />} style={{ fontSize: 11, margin: 0 }}>
                      已驳回
                    </Tag>
                  );
                }

                return (
                  <List.Item
                    onClick={() => onSelect(item.id)}
                    style={{
                      padding: '10px 16px',
                      cursor: 'pointer',
                      background: isSelected ? '#e6f7ff' : 'transparent',
                      borderLeft: isSelected ? '3px solid #1890ff' : '3px solid transparent',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.background = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }
                    }}
                  >
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text strong ellipsis style={{ fontSize: 13, flex: 1, marginRight: 8 }}>
                          {String(item.rawData.fileName ?? item.id)}
                        </Text>
                        {statusTag}
                      </div>
                      <Paragraph
                        type="secondary"
                        ellipsis={{ rows: 1 }}
                        style={{ marginBottom: 0, fontSize: 12 }}
                      >
                        {String(item.rawData.description ?? '')}
                      </Paragraph>
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          标注员: {item.annotator ?? '—'} · {item.submittedAt
                            ? new Date(item.submittedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </Text>
                      </div>
                    </div>
                  </List.Item>
                );
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
