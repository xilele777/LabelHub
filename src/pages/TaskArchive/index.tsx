import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Empty,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  EyeOutlined,
  FileTextOutlined,
  InboxOutlined,
  ProjectOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAnnotationStore } from '../../store/useAnnotationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useTaskStore } from '../../store/useTaskStore';
import {
  AuditActionType,
  DataItemStatus,
  Role,
  STATUS_DISPLAY_CONFIG,
  TaskStatus,
  TaskType,
  type AuditHistoryRecord,
  type DataItem,
  type TaskItem,
} from '../../types';
import { renderStatusTag, renderTaskTypeTag } from '../TaskList/constants';

const { Title, Text } = Typography;

function renderJsonBlock(value: unknown) {
  const text = value === null || value === undefined ? '—' : JSON.stringify(value, null, 2);
  return (
    <Text code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
      {text}
    </Text>
  );
}

function renderDataItemStatus(status: DataItemStatus) {
  const config = STATUS_DISPLAY_CONFIG[status];
  return config ? <Tag color={config.color}>{config.label}</Tag> : <Tag>{status}</Tag>;
}

const auditActionMeta: Record<string, { label: string; color: string }> = {
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

function CompactAuditHistory({ history }: { history: AuditHistoryRecord[] }) {
  if (!history || history.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无流转记录" />;
  }

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {history.map((record, index) => {
        const meta = auditActionMeta[record.actionType] ?? { label: record.actionType, color: 'default' };
        return (
          <div
            key={record.id || `${record.actionType}-${record.timestamp}-${index}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '130px 108px 100px minmax(0, 1fr)',
              gap: 8,
              alignItems: 'center',
              padding: '6px 8px',
              borderBottom: index === history.length - 1 ? 'none' : '1px solid #f0f0f0',
            }}
          >
            <Text type="secondary">{dayjs(record.timestamp).format('MM-DD HH:mm')}</Text>
            <Tag color={meta.color} style={{ margin: 0 }}>{meta.label}</Tag>
            <Text>{record.operator || '—'}</Text>
            <Text type="secondary" ellipsis={{ tooltip: record.reason || undefined }}>
              {record.reason || '—'}
            </Text>
          </div>
        );
      })}
    </Space>
  );
}

export default function TaskArchive() {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === Role.OWNER;

  const archivedTasks = useTaskStore((s) => s.archivedTasks);
  const fetchArchivedTasks = useTaskStore((s) => s.fetchArchivedTasks);
  const unarchiveTask = useTaskStore((s) => s.unarchiveTask);

  const archivedItems = useAnnotationStore((s) => s.archivedItems);
  const fetchArchivedItems = useAnnotationStore((s) => s.fetchArchivedItems);
  const unarchiveItem = useAnnotationStore((s) => s.unarchiveItem);

  const [activeTab, setActiveTab] = useState(isOwner ? 'tasks' : 'items');
  const [taskDetailVisible, setTaskDetailVisible] = useState(false);
  const [itemDetailVisible, setItemDetailVisible] = useState(false);
  const [currentTask, setCurrentTask] = useState<TaskItem | null>(null);
  const [currentItem, setCurrentItem] = useState<DataItem | null>(null);

  useEffect(() => {
    if (isOwner) fetchArchivedTasks();
    fetchArchivedItems();
  }, [fetchArchivedTasks, fetchArchivedItems, isOwner]);

  const openItemDetail = (item: DataItem) => {
    setCurrentItem(item);
    setItemDetailVisible(true);
  };

  const taskColumns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: TaskType) => renderTaskTypeTag(type),
    },
    {
      title: '原状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: TaskStatus) => renderStatusTag(status),
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      key: 'owner',
      width: 110,
    },
    {
      title: '归档时间',
      dataIndex: 'archivedAt',
      key: 'archivedAt',
      width: 170,
      render: (value: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: TaskItem) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setCurrentTask(record);
              setTaskDetailVisible(true);
            }}
          >
            查看
          </Button>
          {isOwner && (
            <Popconfirm
              title="确认取消归档？任务将恢复到任务列表。"
              onConfirm={async () => {
                await unarchiveTask(record.id);
                message.success('已取消归档');
              }}
            >
              <Button size="small" icon={<UndoOutlined />}>
                取消归档
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const itemColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 130,
      ellipsis: true,
    },
    {
      title: '所属任务',
      dataIndex: 'taskId',
      key: 'taskId',
      width: 130,
      ellipsis: true,
    },
    {
      title: '标注员',
      dataIndex: 'annotator',
      key: 'annotator',
      width: 110,
      render: (value: string | null) => value || '—',
    },
    {
      title: '审核员',
      dataIndex: 'reviewer',
      key: 'reviewer',
      width: 110,
      render: (value: string | null) => value || '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: DataItemStatus) => renderDataItemStatus(status),
    },
    {
      title: '归档时间',
      dataIndex: 'archivedAt',
      key: 'archivedAt',
      width: 170,
      render: (value: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: '操作',
      key: 'action',
      width: 210,
      render: (_: unknown, record: DataItem) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openItemDetail(record)}>
            查看
          </Button>
          {isOwner && (
            <Popconfirm
              title="确认取消归档？标注项将恢复到标注列表。"
              onConfirm={async () => {
                await unarchiveItem(record.id);
                message.success('已取消归档');
              }}
            >
              <Button size="small" icon={<UndoOutlined />}>
                取消归档
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const itemTable = archivedItems.length === 0 ? (
    <Empty description="暂无归档标注项" />
  ) : (
    <Table
      rowKey="id"
      columns={itemColumns}
      dataSource={archivedItems}
      pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
      expandable={{
        expandedRowRender: (record: DataItem) => (
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="原始数据">{renderJsonBlock(record.rawData)}</Descriptions.Item>
            <Descriptions.Item label="标注数据">{renderJsonBlock(record.annotationData)}</Descriptions.Item>
          </Descriptions>
        ),
      }}
    />
  );

  return (
    <>
      <Title level={4}>
        <InboxOutlined style={{ marginRight: 8 }} />
        任务归档
      </Title>

      <Card>
        {isOwner ? (
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'tasks',
                label: (
                  <span>
                    <ProjectOutlined style={{ marginRight: 4 }} />
                    归档任务 ({archivedTasks.length})
                  </span>
                ),
                children: archivedTasks.length === 0 ? (
                  <Empty description="暂无归档任务" />
                ) : (
                  <Table
                    rowKey="id"
                    columns={taskColumns}
                    dataSource={archivedTasks}
                    pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
                    expandable={{
                      expandedRowRender: (record: TaskItem) => (
                        <Descriptions size="small" column={2}>
                          <Descriptions.Item label="任务描述">{record.description || '—'}</Descriptions.Item>
                          <Descriptions.Item label="绑定模板">{record.templateName || '—'}</Descriptions.Item>
                          <Descriptions.Item label="创建时间">
                            {record.createdAt ? dayjs(record.createdAt).format('YYYY-MM-DD HH:mm') : '—'}
                          </Descriptions.Item>
                          <Descriptions.Item label="任务说明" span={2}>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{record.instructions || '—'}</div>
                          </Descriptions.Item>
                        </Descriptions>
                      ),
                    }}
                  />
                ),
              },
              {
                key: 'items',
                label: (
                  <span>
                    <FileTextOutlined style={{ marginRight: 4 }} />
                    归档标注项 ({archivedItems.length})
                  </span>
                ),
                children: itemTable,
              },
            ]}
          />
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <FileTextOutlined style={{ marginRight: 4 }} />
              <Text strong>归档标注项 ({archivedItems.length})</Text>
            </div>
            {itemTable}
          </>
        )}
      </Card>

      <Modal
        title={currentTask ? `归档任务详情 - ${currentTask.name}` : '归档任务详情'}
        open={taskDetailVisible}
        onCancel={() => setTaskDetailVisible(false)}
        footer={
          isOwner ? (
            <Space>
              <Button onClick={() => setTaskDetailVisible(false)}>关闭</Button>
              <Popconfirm
                title="确认取消归档？任务将恢复到任务列表。"
                onConfirm={async () => {
                  if (!currentTask) return;
                  await unarchiveTask(currentTask.id);
                  message.success('已取消归档');
                  setTaskDetailVisible(false);
                  setCurrentTask(null);
                }}
              >
                <Button icon={<UndoOutlined />} type="primary" danger>
                  取消归档
                </Button>
              </Popconfirm>
            </Space>
          ) : (
            <Button onClick={() => setTaskDetailVisible(false)}>关闭</Button>
          )
        }
        width={680}
      >
        {currentTask && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="任务名称">{currentTask.name}</Descriptions.Item>
            <Descriptions.Item label="类型">{renderTaskTypeTag(currentTask.type)}</Descriptions.Item>
            <Descriptions.Item label="原状态">{renderStatusTag(currentTask.status)}</Descriptions.Item>
            <Descriptions.Item label="负责人">{currentTask.owner || '—'}</Descriptions.Item>
            <Descriptions.Item label="绑定模板">{currentTask.templateName || '—'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {currentTask.createdAt ? dayjs(currentTask.createdAt).format('YYYY-MM-DD HH:mm') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="归档时间">
              {currentTask.archivedAt ? dayjs(currentTask.archivedAt).format('YYYY-MM-DD HH:mm') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="任务描述" span={2}>
              {currentTask.description || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="任务说明" span={2}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{currentTask.instructions || '—'}</div>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title={currentItem ? `标注项详情 - ${currentItem.id}` : '标注项详情'}
        open={itemDetailVisible}
        onCancel={() => {
          setItemDetailVisible(false);
          setCurrentItem(null);
        }}
        footer={<Button onClick={() => setItemDetailVisible(false)}>关闭</Button>}
        width={920}
      >
        {currentItem && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="标注项ID">{currentItem.id}</Descriptions.Item>
              <Descriptions.Item label="所属任务">{currentItem.taskId}</Descriptions.Item>
              <Descriptions.Item label="标注员">{currentItem.annotator || '—'}</Descriptions.Item>
              <Descriptions.Item label="审核员">{currentItem.reviewer || '—'}</Descriptions.Item>
              <Descriptions.Item label="状态">{renderDataItemStatus(currentItem.status)}</Descriptions.Item>
              <Descriptions.Item label="版本">{currentItem.version}</Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {currentItem.submittedAt ? dayjs(currentItem.submittedAt).format('YYYY-MM-DD HH:mm') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="审核时间">
                {currentItem.reviewedAt ? dayjs(currentItem.reviewedAt).format('YYYY-MM-DD HH:mm') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="归档时间" span={2}>
                {currentItem.archivedAt ? dayjs(currentItem.archivedAt).format('YYYY-MM-DD HH:mm') : '—'}
              </Descriptions.Item>
              {currentItem.rejectReason && (
                <Descriptions.Item label="驳回原因" span={2}>
                  {currentItem.rejectReason}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Card size="small" title="原始数据">
              {renderJsonBlock(currentItem.rawData)}
            </Card>

            <Card size="small" title="标注结果">
              {renderJsonBlock(currentItem.annotationData)}
            </Card>

            <Card size="small" title="流转记录">
              <CompactAuditHistory history={currentItem.auditHistory || []} />
            </Card>
          </Space>
        )}
      </Modal>
    </>
  );
}
