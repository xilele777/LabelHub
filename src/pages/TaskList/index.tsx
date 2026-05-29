import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Typography,
  Popconfirm,
  message,
  Card,
  Spin,
  Alert,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  RocketOutlined,
  StopOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { Role, TaskStatus, TaskType, type TaskItem } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { useTaskStore } from '../../store/useTaskStore';
import {
  renderStatusTag,
  renderTaskTypeTag,
  statusOptions,
  canEdit,
  canPublish,
  canEnd,
} from './constants';
import { getReviewTimeliness, getTaskTimeliness } from '../../utils/taskTimeliness';

const { Title } = Typography;
const PAGE_SIZE = 5;

export default function TaskList() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === Role.OWNER;

  const tasks = useTaskStore((s) => s.tasks);
  const loading = useTaskStore((s) => s.loading);
  const error = useTaskStore((s) => s.error);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const publishTask = useTaskStore((s) => s.publishTask);
  const endTask = useTaskStore((s) => s.endTask);
  const archiveTask = useTaskStore((s) => s.archiveTask);

  // 页面加载时从 API 获取任务列表
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>(undefined);
  const [current, setCurrent] = useState(1);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const matchName = t.name.toLowerCase().includes(keyword.toLowerCase());
      const matchStatus = statusFilter ? t.status === statusFilter : true;
      return matchName && matchStatus;
    });
  }, [tasks, keyword, statusFilter]);

  const handlePublish = useCallback(async (id: string) => {
    try {
      await publishTask(id);
      message.success('任务已发布');
    } catch (err: any) {
      message.error(err?.message || '发布任务失败');
    }
  }, [publishTask]);

  const handleEnd = useCallback(async (id: string) => {
    try {
      await endTask(id);
      message.success('任务已结束');
    } catch (err: any) {
      message.error(err?.message || '结束任务失败');
    }
  }, [endTask]);

  const handleArchive = useCallback(async (id: string) => {
    try {
      await archiveTask(id);
      message.success('任务已归档');
    } catch (err: any) {
      message.error(err?.message || '归档任务失败');
    }
  }, [archiveTask]);

  const handleEdit = useCallback((id: string) => {
    navigate(`/tasks/edit?id=${id}`);
  }, [navigate]);

  const handleDetail = useCallback((id: string) => {
    navigate(`/tasks/detail?id=${id}`);
  }, [navigate]);

  const columns: ColumnsType<TaskItem> = useMemo(
    () => [
      {
        title: '任务名称',
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
      },
      {
        title: '任务类型',
        dataIndex: 'type',
        key: 'type',
        width: 140,
        render: (type: TaskType) => renderTaskTypeTag(type),
      },
      {
        title: '负责人',
        dataIndex: 'owner',
        key: 'owner',
        width: 100,
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (status: TaskStatus) => renderStatusTag(status),
      },
      {
        title: '模板名称',
        dataIndex: 'templateName',
        key: 'templateName',
        ellipsis: true,
        width: 160,
      },
      {
        title: '时效性',
        key: 'timeliness',
        width: 150,
        render: (_, record) => {
          const annotationInfo = getTaskTimeliness(record);
          const reviewInfo = getReviewTimeliness(record);
          return (
            <Space direction="vertical" size={2}>
              <Space size={4}>
                <Tag color={annotationInfo.color}>标注 {annotationInfo.label}</Tag>
                <Tag color={reviewInfo.color}>审核 {reviewInfo.label}</Tag>
              </Space>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                标注：{annotationInfo.description}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                审核：{reviewInfo.description}
              </Typography.Text>
            </Space>
          );
        },
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
      },
      {
        title: '操作',
        key: 'action',
        width: 260,
        render: (_, record) => (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleDetail(record.id)}
            >
              详情
            </Button>
            {canEdit(record.status) && (
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record.id)}
              >
                编辑
              </Button>
            )}
            {canPublish(record.status) && (
              <Popconfirm
                title="确认发布该任务？"
                onConfirm={() => handlePublish(record.id)}
              >
                <Button type="link" size="small" icon={<RocketOutlined />}>
                  发布
                </Button>
              </Popconfirm>
            )}
            {canEnd(record.status) && (
              <Popconfirm
                title="确认结束该任务？结束后无法恢复。"
                onConfirm={() => handleEnd(record.id)}
              >
                <Button type="link" size="small" danger icon={<StopOutlined />}>
                  结束
                </Button>
              </Popconfirm>
            )}
            {(record.status === TaskStatus.COMPLETED || record.status === TaskStatus.ENDED) && (
              <Popconfirm
                title="确认归档该任务？归档后可到「任务归档」中查看。"
                onConfirm={() => handleArchive(record.id)}
              >
                <Button type="link" size="small" icon={<InboxOutlined />}>
                  归档
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ],
    [handlePublish, handleEnd, handleEdit, handleDetail, handleArchive],
  );

  const onKeywordChange = (val: string) => {
    setKeyword(val);
    setCurrent(1);
  };

  const onStatusChange = (val: TaskStatus | undefined) => {
    setStatusFilter(val);
    setCurrent(1);
  };

  return (
    <>
      <Title level={4}>任务列表</Title>

      {error && (
        <Alert
          type="error"
          message={error}
          showIcon
          closable
          style={{ marginBottom: 16 }}
          onClose={() => useTaskStore.setState({ error: null })}
        />
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="搜索任务名称"
            allowClear
            style={{ width: 240 }}
            onSearch={onKeywordChange}
            onChange={(e) => {
              if (!e.target.value) onKeywordChange('');
            }}
          />
          <Select
            placeholder="按状态筛选"
            allowClear
            style={{ width: 160 }}
            options={statusOptions}
            onChange={onStatusChange}
          />
          {isOwner && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/tasks/create')}
            >
              创建任务
            </Button>
          )}
        </Space>
      </Card>

      <Spin spinning={loading}>
        <Table<TaskItem>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{
            current,
            pageSize: PAGE_SIZE,
            total: filtered.length,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page) => setCurrent(page),
          }}
        />
      </Spin>
    </>
  );
}
