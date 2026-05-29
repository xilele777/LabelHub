import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Button,
  Card,
  Space,
  Typography,
  message,
  Spin,
  Alert,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { TaskStatus, AssignmentStrategy, type TaskItem } from '../../types';
import { useTaskStore } from '../../store/useTaskStore';
import { useTemplateStore } from '../../store/useTemplateStore';
import { getUserList } from '../../api/template';
import { taskTypeMap } from '../TaskList/constants';
const { Title } = Typography;
const { TextArea } = Input;

/** 任务类型下拉选项 */
const taskTypeOptions = Object.entries(taskTypeMap).map(([value, { label }]) => ({
  label,
  value,
}));

interface UserOption {
  label: string;
  value: string;
}

interface TaskFormValues {
  name: string;
  description: string;
  type: TaskItem['type'];
  owner: string;
  templateId: string;
  instructions: string;
  startsAt?: Dayjs | null;
  dueAt?: Dayjs | null;
  annotationTimeoutHours?: number;
  reviewTimeoutHours?: number;
}

export default function TaskForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const tasks = useTaskStore((s) => s.tasks);
  const taskLoading = useTaskStore((s) => s.loading);
  const taskError = useTaskStore((s) => s.error);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);

  const templates = useTemplateStore((s) => s.templates);
  const tplLoading = useTemplateStore((s) => s.loading);
  const fetchTemplates = useTemplateStore((s) => s.fetchTemplates);

  const [ownerOptions, setOwnerOptions] = useState<UserOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [form] = Form.useForm();

  const isEdit = Boolean(editId);
  const editingTask = useMemo(
    () => (editId ? tasks.find((t) => t.id === editId) : undefined),
    [editId, tasks],
  );

  // 加载模板列表和用户列表
  useEffect(() => {
    const loadOptions = async () => {
      setOptionsLoading(true);
      setOptionsError(null);
      try {
        const [, userRes] = await Promise.all([
          fetchTemplates(),
          getUserList(),
        ]);
        const owners = (userRes.data.items || [])
          .filter((u) => u.role === 'owner')
          .map((u) => ({ label: u.username, value: u.username }));
        setOwnerOptions(owners);
      } catch (err: any) {
        setOptionsError(err?.message || '加载选项失败');
      } finally {
        setOptionsLoading(false);
      }
    };
    loadOptions();
  }, [fetchTemplates]);

  // 编辑模式时填充表单
  useEffect(() => {
    if (editingTask) {
      form.setFieldsValue({
        name: editingTask.name,
        description: editingTask.description,
        type: editingTask.type,
        owner: editingTask.owner,
        templateId: editingTask.templateId,
        instructions: editingTask.instructions,
        startsAt: editingTask.startsAt ? dayjs(editingTask.startsAt) : null,
        dueAt: editingTask.dueAt ? dayjs(editingTask.dueAt) : null,
        annotationTimeoutHours: editingTask.annotationTimeoutHours ?? editingTask.reminderHours ?? 24,
        reviewTimeoutHours: editingTask.reviewTimeoutHours ?? editingTask.reviewReminderHours ?? 24,
      });
    }
  }, [editingTask, form]);

  const handleTypeChange = () => {
    form.setFieldValue('templateId', undefined);
  };

  const selectedType = Form.useWatch('type', form);
  const templateOptions = useMemo(() => {
    const all = selectedType
      ? templates.filter((t) => t.type === selectedType)
      : templates;
    return all.map((t) => ({ label: t.name, value: t.id }));
  }, [selectedType, templates]);

  const handleSubmit = async () => {
    const values = await form.validateFields() as TaskFormValues;
    const timeFields = {
      startsAt: values.startsAt ? values.startsAt.toISOString() : null,
      dueAt: values.dueAt ? values.dueAt.toISOString() : null,
      annotationTimeoutHours: values.annotationTimeoutHours ?? 24,
      reviewTimeoutHours: values.reviewTimeoutHours ?? 24,
    };

    if (isEdit && editId) {
      const selectedTemplate = templates.find((t) => t.id === values.templateId);
      try {
        await updateTask(editId, {
          ...values,
          ...timeFields,
          templateName: selectedTemplate?.name ?? '',
        });
        message.success('任务已更新');
        navigate('/tasks');
      } catch {
        // updateTask already sets error state, don't navigate
      }
    } else {
      const selectedTemplate = templates.find((t) => t.id === values.templateId);
      // Don't send id — let the backend generate a unique one
      const newTask: Partial<TaskItem> = {
        name: values.name,
        description: values.description ?? '',
        type: values.type,
        owner: values.owner,
        templateId: values.templateId,
        templateName: selectedTemplate?.name ?? '',
        instructions: values.instructions ?? '',
        ...timeFields,
        status: TaskStatus.DRAFT,
        assignmentConfig: {
          strategy: AssignmentStrategy.EVEN_SPLIT,
          annotators: [],
          options: {},
        },
        archived: false,
        archivedAt: null,
      };
      try {
        await addTask(newTask as TaskItem);
        message.success('任务创建成功');
        navigate('/tasks');
      } catch {
        // addTask already sets error state, don't navigate
      }
    }
  };

  const isLoading = taskLoading || tplLoading || optionsLoading;

  return (
    <>
      <Title level={4}>{isEdit ? '编辑任务' : '创建任务'}</Title>

      {(taskError || optionsError) && (
        <Alert
          type="error"
          message={taskError || optionsError || ''}
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={isLoading}>
        <Card style={{ maxWidth: 720 }}>
          <Form
            form={form}
            layout="vertical"
            autoComplete="off"
            onFinish={handleSubmit}
          >
            <Form.Item
              name="name"
              label="任务名称"
              rules={[
                { required: true, message: '请输入任务名称' },
                { max: 50, message: '任务名称不能超过50个字符' },
              ]}
            >
              <Input placeholder="请输入任务名称" maxLength={50} showCount />
            </Form.Item>

            <Form.Item
              name="description"
              label="任务描述"
              rules={[
                { required: true, message: '请输入任务描述' },
                { max: 200, message: '任务描述不能超过200个字符' },
              ]}
            >
              <TextArea
                placeholder="请输入任务描述"
                maxLength={200}
                showCount
                rows={3}
              />
            </Form.Item>

            <Form.Item
              name="type"
              label="任务类型"
              rules={[{ required: true, message: '请选择任务类型' }]}
            >
              <Select
                placeholder="请选择任务类型"
                options={taskTypeOptions}
                onChange={handleTypeChange}
              />
            </Form.Item>

            <Form.Item
              name="owner"
              label="负责人"
              rules={[{ required: true, message: '请选择负责人' }]}
            >
              <Select placeholder="请选择负责人" options={ownerOptions} loading={optionsLoading} />
            </Form.Item>

            <Form.Item
              name="templateId"
              label="绑定模板"
              rules={[{ required: true, message: '请选择绑定模板' }]}
            >
              <Select
                placeholder={selectedType ? '请选择模板' : '请先选择任务类型'}
                options={templateOptions}
                disabled={!selectedType}
                loading={tplLoading}
              />
            </Form.Item>

            <Form.Item
              name="instructions"
              label="任务说明"
              rules={[
                { required: true, message: '请输入任务说明' },
                { max: 500, message: '任务说明不能超过500个字符' },
              ]}
            >
              <TextArea
                placeholder="请输入任务说明，如标注规范、注意事项等"
                maxLength={500}
                showCount
                rows={4}
              />
            </Form.Item>

            <Card size="small" title="任务时效" style={{ marginBottom: 24 }}>
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Space wrap align="start">
                  <Form.Item
                    name="startsAt"
                    label="任务开始"
                    style={{ marginBottom: 0 }}
                  >
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
                          if (!value || !startsAt || value.isAfter(startsAt)) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('任务期限必须晚于任务开始'));
                        },
                      }),
                    ]}
                    style={{ marginBottom: 0 }}
                  >
                    <DatePicker showTime style={{ width: 220 }} placeholder="选择截止时间" />
                  </Form.Item>
                </Space>

                <Space wrap align="start">
                  <Form.Item
                    name="annotationTimeoutHours"
                    label="标注项时限"
                    initialValue={24}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber min={0} max={720} addonAfter="小时" style={{ width: 160 }} />
                  </Form.Item>

                  <Form.Item
                    name="reviewTimeoutHours"
                    label="审核项时限"
                    initialValue={24}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber min={0} max={720} addonAfter="小时" style={{ width: 160 }} />
                  </Form.Item>
                </Space>
              </Space>
            </Card>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={taskLoading}>
                  {isEdit ? '保存修改' : '创建任务'}
                </Button>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/tasks')}>
                  返回列表
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </Spin>
    </>
  );
}
