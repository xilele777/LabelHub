import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Progress,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CopyOutlined,
  EyeOutlined,
  NotificationOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  getPublishedNotification,
  getPublishedNotifications,
  revokePublishedNotification,
  type PublishedNotificationItem,
  type PublishedNotificationRecipient,
} from '../../api/notification';
import { Role } from '../../types';

const { Title, Text } = Typography;

const roleLabelMap: Record<string, string> = {
  [Role.OWNER]: '负责人',
  [Role.ANNOTATOR]: '标注员',
  [Role.REVIEWER]: '审核员',
};

const priorityConfig: Record<PublishedNotificationItem['priority'], { label: string; color: string }> = {
  high: { label: '重要', color: 'red' },
  medium: { label: '普通', color: 'blue' },
  low: { label: '低优先级', color: 'default' },
};

function renderTargets(record: PublishedNotificationItem) {
  const roles = record.targetRoles.map((role) => roleLabelMap[role] || role);
  const users = record.targetUsernames;
  const labels = [...roles, ...users];
  if (labels.length === 0) return <Text type="secondary">未记录</Text>;
  return (
    <Space size={4} wrap>
      {labels.slice(0, 4).map((label) => (
        <Tag key={label} style={{ margin: 0 }}>{label}</Tag>
      ))}
      {labels.length > 4 && <Tag style={{ margin: 0 }}>+{labels.length - 4}</Tag>}
    </Space>
  );
}

export default function NotificationManage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PublishedNotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<PublishedNotificationItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPublishedNotifications({ limit: 500 });
      setItems(res.data.items || []);
    } catch (err: any) {
      message.error(err?.message || '获取发布记录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const filteredItems = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return items;
    return items.filter((item) =>
      item.title.toLowerCase().includes(value) ||
      item.message.toLowerCase().includes(value) ||
      item.recipients.some((recipient) => recipient.username.toLowerCase().includes(value)),
    );
  }, [items, keyword]);

  const openDetail = useCallback(async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await getPublishedNotification(id);
      setSelected(res.data);
    } catch (err: any) {
      message.error(err?.message || '获取通知详情失败');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleRevoke = useCallback(async (id: string) => {
    setRevokingId(id);
    try {
      await revokePublishedNotification(id);
      message.success('通知已撤回');
      await fetchList();
      if (selected?.id === id) {
        const res = await getPublishedNotification(id);
        setSelected(res.data);
      }
    } catch (err: any) {
      message.error(err?.message || '撤回通知失败');
    } finally {
      setRevokingId(null);
    }
  }, [fetchList, selected?.id]);

  const handleCopyPublish = useCallback((record: PublishedNotificationItem) => {
    navigate('/notifications/publish', {
      state: {
        title: record.title,
        message: record.message,
        priority: record.priority,
        targetRoles: record.targetRoles,
        targetUsernames: record.targetUsernames,
      },
    });
  }, [navigate]);

  const columns: ColumnsType<PublishedNotificationItem> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      width: 220,
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => record.revokedAt ? <Tag color="default">已撤回</Tag> : <Tag color="green">已发布</Tag>,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: PublishedNotificationItem['priority']) => {
        const config = priorityConfig[priority];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '目标范围',
      key: 'targets',
      width: 220,
      render: (_, record) => renderTargets(record),
    },
    {
      title: '阅读进度',
      key: 'readRate',
      width: 180,
      render: (_, record) => {
        const percent = record.totalRecipients > 0
          ? Math.round((record.readCount / record.totalRecipients) * 100)
          : 0;
        return (
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            <Progress percent={percent} size="small" />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.readCount}/{record.totalRecipients} 已读
            </Text>
          </Space>
        );
      },
    },
    {
      title: '发布时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 170,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 230,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record.id)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => handleCopyPublish(record)}>
            复制再发
          </Button>
          {!record.revokedAt && (
            <Popconfirm
              title="确认撤回该通知？"
              description="撤回后接收人通知铃铛中将不再显示该通知。"
              onConfirm={() => handleRevoke(record.id)}
            >
              <Button type="link" size="small" danger icon={<StopOutlined />} loading={revokingId === record.id}>
                撤回
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const recipientColumns: ColumnsType<PublishedNotificationRecipient> = [
    { title: '接收人', dataIndex: 'username', key: 'username', ellipsis: true },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => {
        if (record.deleted) return <Tag color="default">已撤回</Tag>;
        return record.read ? <Tag color="green">已读</Tag> : <Tag color="orange">未读</Tag>;
      },
    },
    {
      title: '阅读时间',
      dataIndex: 'readAt',
      key: 'readAt',
      width: 180,
      render: (value: string | null) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <NotificationOutlined style={{ color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>通知管理</Title>
        </Space>
        <Space>
          <Input.Search
            allowClear
            placeholder="搜索标题、内容或接收人"
            style={{ width: 260 }}
            onSearch={setKeyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchList} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message="这里按发布批次管理负责人通知，可查看接收人阅读状态，也可撤回误发通知。"
      />

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table<PublishedNotificationItem>
          rowKey="id"
          columns={columns}
          dataSource={filteredItems}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }}
          locale={{ emptyText: <Empty description="暂无发布记录" /> }}
          scroll={{ x: 1220 }}
        />
      </Card>

      <Modal
        title="通知详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={[
          selected && (
            <Button key="copy" icon={<CopyOutlined />} onClick={() => handleCopyPublish(selected)}>
              复制再发
            </Button>
          ),
          selected && !selected.revokedAt && (
            <Popconfirm
              key="revoke"
              title="确认撤回该通知？"
              onConfirm={() => handleRevoke(selected.id)}
            >
              <Button danger icon={<StopOutlined />} loading={revokingId === selected.id}>
                撤回
              </Button>
            </Popconfirm>
          ),
          <Button key="close" type="primary" onClick={() => setDetailOpen(false)}>
            关闭
          </Button>,
        ].filter(Boolean)}
        width={860}
      >
        {selected && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="标题" span={2}>{selected.title}</Descriptions.Item>
              <Descriptions.Item label="内容" span={2}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{selected.message}</div>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {selected.revokedAt ? <Tag color="default">已撤回</Tag> : <Tag color="green">已发布</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={priorityConfig[selected.priority].color}>{priorityConfig[selected.priority].label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="发布时间">
                {dayjs(selected.timestamp).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="接收人数">{selected.totalRecipients}</Descriptions.Item>
              <Descriptions.Item label="已读">{selected.readCount}</Descriptions.Item>
              <Descriptions.Item label="未读">{selected.unreadCount}</Descriptions.Item>
              {selected.revokedAt && (
                <Descriptions.Item label="撤回时间" span={2}>
                  {dayjs(selected.revokedAt).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Table<PublishedNotificationRecipient>
              rowKey="id"
              size="small"
              loading={detailLoading}
              columns={recipientColumns}
              dataSource={selected.recipients}
              pagination={{ pageSize: 8, showSizeChanger: false }}
            />
          </Space>
        )}
      </Modal>
    </div>
  );
}
