import React, { useRef } from 'react';
import { Badge, Button, Dropdown, Empty, List, Space, Tag, Tooltip, Typography } from 'antd';
import {
  BellOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DisconnectOutlined,
  FieldTimeOutlined,
  NotificationOutlined,
  RobotOutlined,
  SendOutlined,
  SwapOutlined,
  SyncOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore, NOTIFICATION_COLOR_MAP } from '../../store/useNotificationStore';
import { markAllNotificationsRead, markNotificationRead } from '../../services/notificationWebSocket';

const { Text } = Typography;

const NOTIFICATION_ICON_MAP: Record<string, React.ReactNode> = {
  review_approved: <CheckCircleOutlined />,
  review_rejected: <CloseCircleOutlined />,
  ai_review_complete: <RobotOutlined />,
  task_assigned: <UserAddOutlined />,
  task_unassigned: <UserDeleteOutlined />,
  task_submitted: <SendOutlined />,
  task_resubmitted: <SyncOutlined />,
  task_status_changed: <SwapOutlined />,
  task_due_soon: <FieldTimeOutlined />,
  owner_message: <NotificationOutlined />,
};

const NOTIFICATION_LABEL_MAP: Record<string, string> = {
  review_approved: '通过',
  review_rejected: '驳回',
  ai_review_complete: 'AI预审',
  task_assigned: '分配',
  task_unassigned: '取消分配',
  task_submitted: '提交',
  task_resubmitted: '重新提交',
  task_status_changed: '状态变更',
  task_due_soon: '即将逾期',
  owner_message: '负责人',
};

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = now - time;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

function getNotificationLink(notification: any): string | null {
  const { type, data } = notification;

  if (type === 'review_rejected') {
    if (data?.taskId && data?.dataItemId) {
      return `/annotate?taskId=${encodeURIComponent(data.taskId)}&dataItemId=${encodeURIComponent(data.dataItemId)}`;
    }
    return data?.taskId ? `/annotate?taskId=${encodeURIComponent(data.taskId)}` : '/annotate';
  }

  if (type === 'task_resubmitted') {
    if (data?.taskId && data?.dataItemId) {
      return `/review?taskId=${encodeURIComponent(data.taskId)}&dataItemId=${encodeURIComponent(data.dataItemId)}`;
    }
    return data?.taskId ? `/review?taskId=${encodeURIComponent(data.taskId)}` : '/review';
  }

  if (type === 'task_submitted' || type === 'ai_review_complete') {
    return data?.taskId ? `/review?taskId=${encodeURIComponent(data.taskId)}` : '/review';
  }

  if (type === 'task_status_changed') {
    return data?.taskId ? `/tasks/detail?id=${encodeURIComponent(data.taskId)}` : '/tasks';
  }

  if (type === 'task_due_soon') {
    return data?.phase === 'review'
      ? (data?.taskId ? `/review?taskId=${encodeURIComponent(data.taskId)}` : '/review')
      : (data?.taskId ? `/annotate?taskId=${encodeURIComponent(data.taskId)}` : '/annotate');
  }

  if (type === 'task_assigned') {
    return data?.taskId ? `/annotate?taskId=${encodeURIComponent(data.taskId)}` : '/annotate';
  }

  return null;
}

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    panelOpen,
    connected,
    markAsRead,
    markAllAsRead,
    clearAll,
    removeNotification,
    setPanelOpen,
  } = useNotificationStore();

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    markNotificationRead(notification.id);

    const link = getNotificationLink(notification);
    if (link) {
      setPanelOpen(false);
      navigate(link);
    }
  };

  const handleMarkAllRead = () => {
    markAllAsRead();
    markAllNotificationsRead();
  };

  const notificationList = (
    <div
      ref={panelRef}
      style={{
        width: 400,
        maxHeight: 500,
        overflow: 'hidden',
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 6px 16px 0 rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.12), 0 9px 28px 8px rgba(0,0,0,0.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Space>
          <Text strong>通知</Text>
          {unreadCount > 0 && (
            <Tag color="red" style={{ marginLeft: 4 }}>
              {unreadCount} 条未读
            </Tag>
          )}
        </Space>
        <Space size={4}>
          <Tooltip title={connected ? 'WebSocket 已连接' : 'WebSocket 未连接'}>
            {connected ? (
              <WifiOutlined style={{ color: '#52c41a', fontSize: 14 }} />
            ) : (
              <DisconnectOutlined style={{ color: '#ff4d4f', fontSize: 14 }} />
            )}
          </Tooltip>
          {unreadCount > 0 && (
            <Button type="link" size="small" onClick={handleMarkAllRead} icon={<CheckOutlined />}>
              全部已读
            </Button>
          )}
          {notifications.length > 0 && (
            <Button type="link" size="small" danger onClick={clearAll} icon={<DeleteOutlined />}>
              清空
            </Button>
          )}
        </Space>
      </div>

      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '40px 0' }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无通知" />
          </div>
        ) : (
          <List
            dataSource={notifications}
            renderItem={(item) => {
              const icon = NOTIFICATION_ICON_MAP[item.type] || <BellOutlined />;
              const color = NOTIFICATION_COLOR_MAP[item.type] || '#8c8c8c';
              const label = NOTIFICATION_LABEL_MAP[item.type] || '通知';
              const link = getNotificationLink(item);

              return (
                <List.Item
                  key={item.id}
                  style={{
                    padding: '10px 16px',
                    cursor: link ? 'pointer' : 'default',
                    background: item.read ? 'transparent' : 'rgba(24,144,255,0.04)',
                    borderLeft: item.read ? 'none' : `3px solid ${color}`,
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.02)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = item.read
                      ? 'transparent'
                      : 'rgba(24,144,255,0.04)';
                  }}
                  onClick={() => handleNotificationClick(item)}
                  actions={[
                    <Tooltip title="删除" key="delete">
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(item.id);
                        }}
                      />
                    </Tooltip>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: `${color}15`,
                          color,
                          fontSize: 16,
                        }}
                      >
                        {icon}
                      </div>
                    }
                    title={
                      <Space size={6}>
                        <Text style={{ fontSize: 14, fontWeight: item.read ? 400 : 600 }}>
                          {item.title}
                        </Text>
                        <Tag
                          color={color}
                          style={{ fontSize: 11, lineHeight: '18px', padding: '0 4px', margin: 0 }}
                        >
                          {label}
                        </Tag>
                        {item.priority === 'high' && (
                          <Tag color="red" style={{ fontSize: 11, lineHeight: '18px', padding: '0 4px', margin: 0 }}>
                            重要
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <div>
                        <Text
                          type="secondary"
                          style={{ fontSize: 13, display: 'block' }}
                          ellipsis={{ tooltip: item.message }}
                        >
                          {item.message}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {formatRelativeTime(item.timestamp)}
                          {item.sender && item.sender !== 'system' && item.sender !== 'AI系统' && (
                            <span> 来自 {item.sender}</span>
                          )}
                        </Text>
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </div>
  );

  return (
    <Dropdown
      open={panelOpen}
      onOpenChange={(open) => setPanelOpen(open)}
      popupRender={() => notificationList}
      trigger={['click']}
      placement="bottomRight"
      destroyOnHidden={false}
    >
      <Tooltip title="通知">
        <Badge count={unreadCount} size="small" offset={[-4, 4]} style={{ boxShadow: 'none' }}>
          <Button
            type="text"
            icon={<BellOutlined style={{ fontSize: 18 }} />}
            style={{ padding: '4px 8px' }}
          />
        </Badge>
      </Tooltip>
    </Dropdown>
  );
};

export default NotificationBell;
