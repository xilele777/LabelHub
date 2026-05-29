import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Descriptions,
  Button,
  Card,
  Typography,
  Space,
  Empty,
  Upload,
  Modal,
  Alert,
  Table,
  message,
  Popconfirm,
  Tag,
  DatePicker,
  Form,
  InputNumber,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  ImportOutlined,
  InboxOutlined,
  FileTextOutlined,
  UndoOutlined,
  RocketOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';

import { useTaskStore } from '../../store/useTaskStore';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { batchImportItems } from '../../api/annotation';
import { renderStatusTag, renderTaskTypeTag, canEdit } from '../TaskList/constants';
import TaskAssignmentPanel from './TaskAssignmentPanel';
import { Role, TaskStatus } from '../../types';
import { formatTaskTimeRange, getTaskTimeliness } from '../../utils/taskTimeliness';

const { Title, Text } = Typography;
const { Dragger } = Upload;

interface TimeLimitFormValues {
  startsAt?: Dayjs | null;
  dueAt?: Dayjs | null;
  annotationTimeoutHours?: number;
  reviewTimeoutHours?: number;
}

export default function TaskDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('id');

  const user = useAuthStore((s) => s.user);
  const tasks = useTaskStore((s) => s.tasks);
  const archivedTasks = useTaskStore((s) => s.archivedTasks);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const fetchArchivedTasks = useTaskStore((s) => s.fetchArchivedTasks);
  const archiveTask = useTaskStore((s) => s.archiveTask);
  const unarchiveTask = useTaskStore((s) => s.unarchiveTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const fetchDataItems = useAnnotationStore((s) => s.fetchDataItems);
  const isOwner = user?.role === Role.OWNER;
  const task = useMemo(
    () => (taskId ? tasks.find((t) => t.id === taskId) || archivedTasks.find((t) => t.id === taskId) : undefined),
    [taskId, tasks, archivedTasks],
  );
  const isArchived = useMemo(() => (taskId ? archivedTasks.some((t) => t.id === taskId) : false), [taskId, archivedTasks]);

  // 确保归档任务也已加载（以便通过 URL 直接访问归档任务详情）
  useEffect(() => {
    fetchTasks();
    fetchArchivedTasks();
  }, [fetchArchivedTasks, fetchTasks]);

  // 导入相关状态
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [timeLimitModalOpen, setTimeLimitModalOpen] = useState(false);
  const [timeLimitSaving, setTimeLimitSaving] = useState(false);
  const [timeLimitForm] = Form.useForm<TimeLimitFormValues>();
  const [importLoading, setImportLoading] = useState(false);
  const [previewData, setPreviewData] = useState<Array<{ rawData: Record<string, unknown> }>>([]);

  /** 解析上传的 JSON 文件 */
  const parseJsonFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        // 支持两种格式：数组 或 { items: [...] }
        const items: unknown[] = Array.isArray(content) ? content : content?.items;
        if (!Array.isArray(items) || items.length === 0) {
          message.error('JSON 文件格式错误：需要数组或 { items: [...] } 格式');
          return;
        }
        // 每个元素包装为 { rawData: ... }
        const wrapped = items.map((item) => ({
          rawData: typeof item === 'object' && item !== null ? item as Record<string, unknown> : { value: item },
        }));
        setPreviewData(wrapped);
        message.success(`已解析 ${wrapped.length} 条数据`);
      } catch {
        message.error('JSON 解析失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
    return false; // 阻止自动上传
  };

  /** 执行导入 */
  const handleImport = async () => {
    if (!taskId || previewData.length === 0) return;
    setImportLoading(true);
    try {
      const res = await batchImportItems(taskId, previewData);
      message.success(`成功导入 ${res.data.imported} 条数据`);
      setImportModalOpen(false);
      setPreviewData([]);
      // 刷新数据
      fetchDataItems(taskId);
      fetchTasks();
    } catch (err: any) {
      message.error(err?.message || '导入失败');
    } finally {
      setImportLoading(false);
    }
  };

  if (!task) {
    return (
      <>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(isArchived ? '/archive' : '/tasks')}
          style={{ marginBottom: 16 }}
        >
          返回
        </Button>
        <Empty description="未找到该任务" />
      </>
    );
  }

  const isEditable = canEdit(task.status);
  const timeliness = getTaskTimeliness(task);

  const openTimeLimitModal = () => {
    timeLimitForm.setFieldsValue({
      startsAt: task.startsAt ? dayjs(task.startsAt) : null,
      dueAt: task.dueAt ? dayjs(task.dueAt) : null,
      annotationTimeoutHours: task.annotationTimeoutHours ?? task.reminderHours ?? 24,
      reviewTimeoutHours: task.reviewTimeoutHours ?? task.reviewReminderHours ?? 24,
    });
    setTimeLimitModalOpen(true);
  };

  const handleSaveTimeLimit = async () => {
    const values = await timeLimitForm.validateFields();
    setTimeLimitSaving(true);
    try {
      await updateTask(task.id, {
        startsAt: values.startsAt ? values.startsAt.toISOString() : null,
        dueAt: values.dueAt ? values.dueAt.toISOString() : null,
        annotationTimeoutHours: values.annotationTimeoutHours ?? 24,
        reviewTimeoutHours: values.reviewTimeoutHours ?? 24,
      });
      message.success('任务时限已更新');
      setTimeLimitModalOpen(false);
      fetchTasks();
    } catch (err: any) {
      message.error(err?.message || '更新时限失败');
    } finally {
      setTimeLimitSaving(false);
    }
  };

  const previewColumns = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: 'rawData 摘要',
      dataIndex: 'rawData',
      key: 'rawData',
      ellipsis: true,
      render: (v: Record<string, unknown>) => JSON.stringify(v).slice(0, 100) + '…',
    },
  ];

  return (
    <>
      <Title level={4}>任务详情</Title>

      <Card>
        <Descriptions column={2} bordered size="middle">
          <Descriptions.Item label="任务名称">{task.name}</Descriptions.Item>
          <Descriptions.Item label="任务类型">
            {renderTaskTypeTag(task.type)}
          </Descriptions.Item>
          <Descriptions.Item label="负责人">{task.owner}</Descriptions.Item>
          <Descriptions.Item label="状态">
            {renderStatusTag(task.status)}
          </Descriptions.Item>
          <Descriptions.Item label="绑定模板">{task.templateName}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(task.createdAt).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="任务时效">
            <Space direction="vertical" size={4}>
              <Tag color={timeliness.color}>{timeliness.label}</Tag>
              <Text type="secondary">{timeliness.description}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="任务时间窗口">
            {formatTaskTimeRange(task)}
          </Descriptions.Item>
          <Descriptions.Item label="标注项时限">
            领取或分配后 {task.annotationTimeoutHours ?? task.reminderHours ?? 24} 小时
          </Descriptions.Item>
          <Descriptions.Item label="审核项时限">
            领取或分配后 {task.reviewTimeoutHours ?? task.reviewReminderHours ?? 24} 小时
          </Descriptions.Item>
          {isArchived && (
            <>
              <Descriptions.Item label="归档时间">
                {task.archivedAt ? dayjs(task.archivedAt).format('YYYY-MM-DD HH:mm') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="归档状态">
                <Tag color="default">已归档</Tag>
              </Descriptions.Item>
            </>
          )}
          <Descriptions.Item label="任务描述" span={2}>
            {task.description || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="任务说明" span={2}>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {task.instructions || '—'}
            </div>
          </Descriptions.Item>
        </Descriptions>

        {(timeliness.level === 'due_soon' || timeliness.level === 'overdue') && !isArchived && (
          <Alert
            type={timeliness.level === 'overdue' ? 'error' : 'warning'}
            showIcon
            message={timeliness.label}
            description={timeliness.description}
            style={{ marginTop: 16 }}
          />
        )}

        <Space style={{ marginTop: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(isArchived ? '/archive' : '/tasks')}>
            {isArchived ? '返回归档' : '返回列表'}
          </Button>
          {isEditable && !isArchived && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => navigate(`/tasks/edit?id=${task.id}`)}
            >
              编辑任务
            </Button>
          )}
          {!isArchived && (
            <Button
              icon={<ImportOutlined />}
              onClick={() => setImportModalOpen(true)}
            >
              导入数据
            </Button>
          )}
          {isOwner && !isArchived && (
            <Button icon={<FieldTimeOutlined />} onClick={openTimeLimitModal}>
              调整时限
            </Button>
          )}
          {isOwner && !isArchived && (task.status === 'completed' || task.status === 'ended') && (
            <Popconfirm
              title="确认归档该任务？归档后可到「任务归档」中查看。"
              onConfirm={async () => {
                await archiveTask(task.id);
                message.success('任务已归档');
                navigate('/archive');
              }}
            >
              <Button icon={<InboxOutlined />}>归档</Button>
            </Popconfirm>
          )}
          {isOwner && isArchived && (
            <Popconfirm
              title="确认取消归档？任务将恢复到任务列表。"
              onConfirm={async () => {
                await unarchiveTask(task.id);
                message.success('已取消归档');
                navigate('/archive');
              }}
            >
              <Button icon={<UndoOutlined />}>取消归档</Button>
            </Popconfirm>
          )}
        </Space>
      </Card>

      {/* 任务分配面板 - 仅 Owner 可见，归档任务不显示 */}
      {taskId && isOwner && !isArchived && task.status === 'in_progress' && (
        <TaskAssignmentPanel
          taskId={taskId}
          onAssignmentChange={() => fetchDataItems(taskId)}
        />
      )}

      {/* 未发布任务提示 - 引导 Owner 先发布任务 */}
      {taskId && isOwner && !isArchived && (task.status === 'draft' || task.status === 'pending') && (
        <Card style={{ marginTop: 16 }}>
          <Alert
            type="warning"
            showIcon
            icon={<RocketOutlined />}
            message="任务尚未发布"
            description={
              <div>
                <p style={{ marginBottom: 8 }}>任务必须先发布后才能进行分配、标注和审核操作。未发布的任务不会对标注员和审核员可见。</p>
                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  onClick={async () => {
                    try {
                      await updateTask(task.id, { status: TaskStatus.IN_PROGRESS });
                      message.success('任务已发布，现在可以进行分配了');
                      fetchTasks();
                    } catch (err: any) {
                      message.error(err?.message || '发布失败');
                    }
                  }}
                >
                  立即发布任务
                </Button>
              </div>
            }
          />
        </Card>
      )}

      {/* 数据导入弹窗 */}
      <Modal
        title="导入标注数据"
        open={importModalOpen}
        onCancel={() => {
          setImportModalOpen(false);
          setPreviewData([]);
        }}
        onOk={handleImport}
        okText={`确认导入（${previewData.length} 条）`}
        okButtonProps={{ disabled: previewData.length === 0 }}
        confirmLoading={importLoading}
        width={720}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="数据格式说明"
          description={
            <div>
              <p style={{ marginBottom: 4 }}>请上传 JSON 文件，支持以下格式：</p>
              <Text code>{'[ {"text": "示例1"}, {"text": "示例2"} ]'}</Text>
              <br />
              <Text code>{'{ "items": [ {"text": "示例1"}, {"text": "示例2"} ] }'}</Text>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                每个元素将作为一条待标注数据的 rawData 字段存储。
              </p>
            </div>
          }
        />

        <Dragger
          accept=".json"
          maxCount={1}
          showUploadList={false}
          beforeUpload={parseJsonFile}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽 JSON 文件到此处</p>
          <p className="ant-upload-hint">支持 .json 格式</p>
        </Dragger>

        {previewData.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text strong>
              <FileTextOutlined style={{ marginRight: 4 }} />
              数据预览（共 {previewData.length} 条）
            </Text>
            <Table
              size="small"
              columns={previewColumns}
              dataSource={previewData}
              pagination={{ pageSize: 5, showTotal: (total) => `共 ${total} 条` }}
              rowKey={(_, index) => String(index)}
              style={{ marginTop: 8 }}
            />
          </div>
        )}
      </Modal>

      <Modal
        title="调整任务时限"
        open={timeLimitModalOpen}
        onCancel={() => setTimeLimitModalOpen(false)}
        onOk={handleSaveTimeLimit}
        confirmLoading={timeLimitSaving}
        width={760}
        okText="保存时限"
      >
        <Form form={timeLimitForm} layout="vertical">
          <Card size="small" title="任务周期与单项时限">
            <Space wrap align="start">
              <Form.Item name="startsAt" label="任务开始">
                <DatePicker showTime style={{ width: 220 }} placeholder="立即开始" />
              </Form.Item>
              <Form.Item
                name="dueAt"
                label="任务期限"
                dependencies={['startsAt']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value: Dayjs | null) {
                      const startsAt = getFieldValue('startsAt') as Dayjs | null;
                      if (!value || !startsAt || value.isAfter(startsAt)) return Promise.resolve();
                      return Promise.reject(new Error('任务期限必须晚于任务开始'));
                    },
                  }),
                ]}
              >
                <DatePicker showTime style={{ width: 220 }} placeholder="选择任务期限" />
              </Form.Item>
              <Form.Item name="annotationTimeoutHours" label="标注项时限">
                <InputNumber min={0} max={720} addonAfter="小时" style={{ width: 160 }} />
              </Form.Item>
              <Form.Item name="reviewTimeoutHours" label="审核项时限">
                <InputNumber min={0} max={720} addonAfter="小时" style={{ width: 160 }} />
              </Form.Item>
            </Space>
          </Card>
        </Form>
      </Modal>
    </>
  );
}
