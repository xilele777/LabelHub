import { useMemo, useEffect, type ReactNode } from 'react';
import { Row, Col, Card, Typography, Spin, Empty, Tag, Progress, Statistic, Space, Divider } from 'antd';
import {
  AlertOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  FieldTimeOutlined,
  RobotOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { DataItemStatus, TaskStatus, Role } from '../../types';
import { useTaskStore } from '../../store/useTaskStore';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import { useAuthStore } from '../../store/useAuthStore';

const { Title, Text, Paragraph } = Typography;

const statusColorMap: Record<DataItemStatus, string> = {
  [DataItemStatus.PENDING]: 'default',
  [DataItemStatus.DRAFT]: 'warning',
  [DataItemStatus.SUBMITTED]: 'processing',
  [DataItemStatus.AI_REVIEWING]: 'blue',
  [DataItemStatus.AI_REVIEWED]: 'cyan',
  [DataItemStatus.PENDING_REVIEW]: 'orange',
  [DataItemStatus.REVIEWED]: 'green',
  [DataItemStatus.REJECTED]: 'red',
};

const statusProgressColorMap: Record<DataItemStatus, string> = {
  [DataItemStatus.PENDING]: '#8c8c8c',
  [DataItemStatus.DRAFT]: '#faad14',
  [DataItemStatus.SUBMITTED]: '#1677ff',
  [DataItemStatus.AI_REVIEWING]: '#597ef7',
  [DataItemStatus.AI_REVIEWED]: '#13c2c2',
  [DataItemStatus.PENDING_REVIEW]: '#fa8c16',
  [DataItemStatus.REVIEWED]: '#52c41a',
  [DataItemStatus.REJECTED]: '#ff4d4f',
};

const statusLabelMap: Record<DataItemStatus, string> = {
  [DataItemStatus.PENDING]: '待标注',
  [DataItemStatus.DRAFT]: '草稿',
  [DataItemStatus.SUBMITTED]: '已提交',
  [DataItemStatus.AI_REVIEWING]: 'AI预审中',
  [DataItemStatus.AI_REVIEWED]: 'AI已预审',
  [DataItemStatus.PENDING_REVIEW]: '待审核',
  [DataItemStatus.REVIEWED]: '已通过',
  [DataItemStatus.REJECTED]: '已驳回',
};

const taskStatusLabelMap: Record<TaskStatus, { label: string; color: string }> = {
  [TaskStatus.DRAFT]: { label: '草稿', color: 'default' },
  [TaskStatus.PENDING]: { label: '待发布', color: 'warning' },
  [TaskStatus.IN_PROGRESS]: { label: '进行中', color: 'processing' },
  [TaskStatus.COMPLETED]: { label: '已完成', color: 'success' },
  [TaskStatus.ENDED]: { label: '已结束', color: 'default' },
};

interface MetricCardProps {
  title: string;
  value: number;
  color: string;
  icon: ReactNode;
  suffix?: string;
  hint?: ReactNode;
}

function MetricCard({ title, value, color, icon, suffix, hint }: MetricCardProps) {
  return (
    <Card
      hoverable
      styles={{ body: { padding: 18 } }}
      style={{
        height: '100%',
        borderTop: `3px solid ${color}`,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
      }}
    >
      <Space align="start" size={14} style={{ width: '100%' }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 8,
            background: `${color}14`,
            border: `1px solid ${color}24`,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 21,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text type="secondary" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
            {title}
          </Text>
          <div style={{ color: '#111827', fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
            {value}
            {suffix && <span style={{ marginLeft: 2, color, fontSize: 15, fontWeight: 600 }}>{suffix}</span>}
          </div>
          {hint && (
            <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
              {hint}
            </Text>
          )}
        </div>
      </Space>
    </Card>
  );
}

function PanelCard({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <Card
      title={<span style={{ fontSize: 15 }}>{title}</span>}
      extra={extra}
      styles={{ body: { padding: 18 } }}
      style={{ height: '100%', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)' }}
    >
      {children}
    </Card>
  );
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const tasks = useTaskStore((s) => s.tasks);
  const taskLoading = useTaskStore((s) => s.loading);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const dataItems = useAnnotationStore((s) => s.dataItems);
  const archivedItems = useAnnotationStore((s) => s.archivedItems);
  const aiReviewResults = useAnnotationStore((s) => s.aiReviewResults);
  const annotationLoading = useAnnotationStore((s) => s.loading);
  const fetchDataItems = useAnnotationStore((s) => s.fetchDataItems);
  const fetchArchivedItems = useAnnotationStore((s) => s.fetchArchivedItems);
  const fetchAIReviews = useAnnotationStore((s) => s.fetchAIReviews);

  useEffect(() => {
    fetchTasks();
    fetchDataItems();
    fetchArchivedItems();
    fetchAIReviews();
  }, [fetchTasks, fetchDataItems, fetchArchivedItems, fetchAIReviews]);

  const loading = taskLoading || annotationLoading;

  const allDataItems = useMemo(() => {
    const itemMap = new Map(dataItems.map((item) => [item.id, item]));
    archivedItems.forEach((item) => itemMap.set(item.id, item));
    return Array.from(itemMap.values());
  }, [dataItems, archivedItems]);

  const stats = useMemo(() => {
    const scopedItems = user?.role === Role.ANNOTATOR
      ? allDataItems.filter((item) => item.annotator === user.username)
      : user?.role === Role.REVIEWER
        ? allDataItems.filter((item) =>
            item.status === DataItemStatus.PENDING_REVIEW ||
            item.status === DataItemStatus.REVIEWED ||
            item.status === DataItemStatus.REJECTED)
        : allDataItems;

    const pendingCount = scopedItems.filter((item) => item.status === DataItemStatus.PENDING).length;
    const draftCount = scopedItems.filter((item) => item.status === DataItemStatus.DRAFT).length;
    const submittedCount = scopedItems.filter((item) =>
      item.status === DataItemStatus.SUBMITTED ||
      item.status === DataItemStatus.AI_REVIEWING ||
      item.status === DataItemStatus.AI_REVIEWED
    ).length;
    const pendingReviewCount = scopedItems.filter((item) => item.status === DataItemStatus.PENDING_REVIEW).length;
    const reviewedCount = scopedItems.filter((item) => item.status === DataItemStatus.REVIEWED).length;
    const rejectedCount = scopedItems.filter((item) => item.status === DataItemStatus.REJECTED).length;

    const totalItems = scopedItems.length;
    const completedItems = user?.role === Role.ANNOTATOR
      ? submittedCount + pendingReviewCount + reviewedCount + rejectedCount
      : reviewedCount + rejectedCount;
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const reviewPassed = scopedItems.filter((item) => item.status === DataItemStatus.REVIEWED).length;
    const reviewRejected = scopedItems.filter((item) => item.status === DataItemStatus.REJECTED).length;
    const reviewTotal = reviewPassed + reviewRejected;
    const passRate = reviewTotal > 0 ? Math.round((reviewPassed / reviewTotal) * 100) : 0;

    const scopedItemIds = new Set(scopedItems.map((item) => item.id));
    const scopedAIReviews = aiReviewResults.filter((review) => scopedItemIds.has(review.dataItemId));
    const aiRiskCount = scopedAIReviews.filter((review) => review.reviewStatus === 'risk' || review.reviewStatus === 'fail').length;
    const aiRiskRate = scopedAIReviews.length > 0 ? Math.round((aiRiskCount / scopedAIReviews.length) * 100) : 0;

    const inProgressTasks = tasks.filter((task) => task.status === TaskStatus.IN_PROGRESS).length;
    const completedTasks = tasks.filter((task) => task.status === TaskStatus.COMPLETED).length;

    const statusCounts = Object.values(DataItemStatus).map((status) => ({
      status,
      label: statusLabelMap[status],
      count: scopedItems.filter((item) => item.status === status).length,
      percent: totalItems > 0
        ? Math.round((scopedItems.filter((item) => item.status === status).length / totalItems) * 100)
        : 0,
    })).filter((item) => item.count > 0);

    return {
      pendingCount,
      draftCount,
      submittedCount,
      pendingReviewCount,
      reviewedCount,
      rejectedCount,
      totalItems,
      completedItems,
      progress,
      passRate,
      aiRiskCount,
      aiRiskRate,
      aiReviewTotal: scopedAIReviews.length,
      inProgressTasks,
      completedTasks,
      statusCounts,
    };
  }, [tasks, allDataItems, aiReviewResults, user]);

  const taskRows = useMemo(() => (
    tasks.slice(0, 6).map((task) => {
      const taskItems = allDataItems.filter((item) => item.taskId === task.id);
      const done = taskItems.filter((item) =>
        item.status === DataItemStatus.REVIEWED ||
        item.status === DataItemStatus.REJECTED
      ).length;
      const percent = taskItems.length > 0 ? Math.round((done / taskItems.length) * 100) : 0;
      return { task, taskItems, done, percent, statusInfo: taskStatusLabelMap[task.status] };
    })
  ), [tasks, allDataItems]);

  if (loading && tasks.length === 0 && allDataItems.length === 0) {
    return <Spin style={{ display: 'block', margin: '100px auto' }} />;
  }

  const roleLabel = user?.role === Role.OWNER ? '负责人' : user?.role === Role.REVIEWER ? '审核员' : '标注员';
  const primaryPendingTitle = user?.role === Role.ANNOTATOR
    ? '待标注'
    : user?.role === Role.REVIEWER
      ? '待审核'
      : '待处理';
  const primaryPendingValue = user?.role === Role.ANNOTATOR
    ? stats.pendingCount
    : user?.role === Role.REVIEWER
      ? stats.pendingReviewCount
      : stats.pendingCount + stats.pendingReviewCount;
  const completionLabel = user?.role === Role.ANNOTATOR ? '提交进度' : '审核进度';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
      <Card
        styles={{ body: { padding: '18px 20px' } }}
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fbff 58%, #f7fffc 100%)',
          borderColor: '#e8eef7',
        }}
      >
        <Row gutter={[16, 12]} align="middle" justify="space-between">
          <Col xs={24} lg={13}>
            <Space direction="vertical" size={4}>
              <Title level={4} style={{ margin: 0 }}>
                仪表盘
              </Title>
              <Paragraph style={{ margin: 0 }}>
                欢迎回来，<Text strong>{user?.username}</Text>。当前角色：
                <Tag color={user?.role === Role.OWNER ? 'blue' : user?.role === Role.REVIEWER ? 'orange' : 'green'}>
                  {roleLabel}
                </Tag>
              </Paragraph>
            </Space>
          </Col>
          <Col xs={24} lg={11}>
            <Space size={[8, 8]} wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Tag color="blue">任务 {tasks.length}</Tag>
              <Tag color="cyan">数据 {stats.totalItems}</Tag>
              <Tag color={stats.aiRiskCount > 0 ? 'red' : 'green'}>AI 风险 {stats.aiRiskCount}</Tag>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            title={primaryPendingTitle}
            value={primaryPendingValue}
            color="#faad14"
            icon={<ClockCircleOutlined />}
            hint={user?.role === Role.OWNER && stats.submittedCount > 0 ? `另有 ${stats.submittedCount} 条 AI 预审中` : '当前优先处理项'}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            title={user?.role === Role.REVIEWER ? '审核通过' : '已通过'}
            value={stats.reviewedCount}
            color="#52c41a"
            icon={<CheckCircleOutlined />}
            hint={`${stats.passRate}% 通过率`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            title="已驳回"
            value={stats.rejectedCount}
            color="#ff4d4f"
            icon={<CloseCircleOutlined />}
            hint="需要关注返工数据"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            title="整体进度"
            value={stats.progress}
            suffix="%"
            color="#1677ff"
            icon={<DashboardOutlined />}
            hint={`${stats.completedItems} / ${stats.totalItems || 0} 条已完成`}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <PanelCard
            title={completionLabel}
            extra={<Tag color={stats.progress === 100 ? 'green' : 'blue'}>{stats.progress}%</Tag>}
          >
            {stats.totalItems === 0 ? (
              <Empty description="暂无分配的标注数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                <Progress
                  percent={stats.progress}
                  status={stats.progress === 100 ? 'success' : 'active'}
                  strokeColor={{ from: '#1677ff', to: '#13c2c2' }}
                />
                <Row gutter={[12, 12]}>
                  <Col span={6}>
                    <Statistic title="待标注" value={stats.pendingCount} valueStyle={{ fontSize: 22 }} />
                  </Col>
                  <Col span={6}>
                    <Statistic title="草稿" value={stats.draftCount} valueStyle={{ fontSize: 22 }} />
                  </Col>
                  <Col span={6}>
                    <Statistic title="待审核" value={stats.pendingReviewCount} valueStyle={{ fontSize: 22 }} />
                  </Col>
                  <Col span={6}>
                    <Statistic title="已完成" value={stats.reviewedCount + stats.rejectedCount} valueStyle={{ fontSize: 22 }} />
                  </Col>
                </Row>
                <Space size={[8, 8]} wrap>
                  <Tag color={statusColorMap[DataItemStatus.SUBMITTED]}>已提交 {stats.submittedCount}</Tag>
                  <Tag color={statusColorMap[DataItemStatus.REVIEWED]}>通过 {stats.reviewedCount}</Tag>
                  <Tag color={statusColorMap[DataItemStatus.REJECTED]}>驳回 {stats.rejectedCount}</Tag>
                </Space>
              </Space>
            )}
          </PanelCard>
        </Col>

        <Col xs={24} xl={12}>
          <PanelCard title="任务概览" extra={<Tag color="processing">进行中 {stats.inProgressTasks}</Tag>}>
            {tasks.length === 0 ? (
              <Empty description="暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic title="总任务" value={tasks.length} prefix={<UnorderedListOutlined />} valueStyle={{ fontSize: 22 }} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="进行中" value={stats.inProgressTasks} valueStyle={{ color: '#1677ff', fontSize: 22 }} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="已完成" value={stats.completedTasks} valueStyle={{ color: '#52c41a', fontSize: 22 }} />
                  </Col>
                </Row>
                <Divider style={{ margin: '4px 0' }} />
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {taskRows.map(({ task, taskItems, done, percent, statusInfo }) => (
                    <div key={task.id}>
                      <Row gutter={12} align="middle" wrap={false}>
                        <Col flex="auto" style={{ minWidth: 0 }}>
                          <Text ellipsis={{ tooltip: task.name }} style={{ maxWidth: '100%' }}>
                            {task.name}
                          </Text>
                        </Col>
                        <Col flex="none">
                          <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {done}/{taskItems.length}
                          </Text>
                        </Col>
                      </Row>
                      <Progress percent={percent} showInfo={false} size="small" style={{ marginTop: 4 }} />
                    </div>
                  ))}
                </Space>
                {tasks.length > taskRows.length && (
                  <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
                    共 {tasks.length} 个任务
                  </Text>
                )}
              </Space>
            )}
          </PanelCard>
        </Col>

        <Col xs={24} xl={12}>
          <PanelCard
            title="AI 预审风险"
            extra={<Tag color={stats.aiRiskCount > 0 ? 'red' : 'green'}>{stats.aiRiskRate}%</Tag>}
          >
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="风险/不通过"
                    value={stats.aiRiskCount}
                    prefix={<AlertOutlined />}
                    valueStyle={{ color: stats.aiRiskCount > 0 ? '#ff4d4f' : '#52c41a', fontSize: 22 }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="AI预审总数"
                    value={stats.aiReviewTotal}
                    prefix={<RobotOutlined />}
                    valueStyle={{ fontSize: 22 }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="风险率"
                    value={stats.aiRiskRate}
                    suffix="%"
                    valueStyle={{ color: stats.aiRiskCount > 0 ? '#faad14' : '#52c41a', fontSize: 22 }}
                  />
                </Col>
              </Row>
              <Progress
                percent={stats.aiRiskRate}
                status={stats.aiRiskCount > 0 ? 'exception' : 'success'}
                strokeColor={stats.aiRiskCount > 0 ? '#ff4d4f' : '#52c41a'}
              />
              <Text type="secondary">
                当前统计仅包含该角色可见数据，避免把无权限数据混入个人仪表盘。
              </Text>
            </Space>
          </PanelCard>
        </Col>

        <Col xs={24} xl={12}>
          <PanelCard title="数据状态分布" extra={<FieldTimeOutlined style={{ color: '#1677ff' }} />}>
            {stats.statusCounts.length === 0 ? (
              <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {stats.statusCounts.map((item) => (
                  <div key={item.status}>
                    <Row justify="space-between" align="middle" style={{ marginBottom: 4 }}>
                      <Col>
                        <Tag color={statusColorMap[item.status]}>{item.label}</Tag>
                      </Col>
                      <Col>
                        <Text strong>{item.count}</Text>
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                          {item.percent}%
                        </Text>
                      </Col>
                    </Row>
                    <Progress
                      percent={item.percent}
                      showInfo={false}
                      size="small"
                      strokeColor={statusProgressColorMap[item.status]}
                    />
                  </div>
                ))}
              </Space>
            )}
          </PanelCard>
        </Col>
      </Row>
    </div>
  );
}
