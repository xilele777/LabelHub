import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Form, Input, message, Select, Space, Tag, Typography } from 'antd';
import { NotificationOutlined, SendOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { Role, type UserInfo } from '../../types';
import * as authApi from '../../api/auth';
import { publishNotification } from '../../api/notification';

const { Title, Text } = Typography;

const roleOptions = [
  { label: '负责人', value: Role.OWNER },
  { label: '标注员', value: Role.ANNOTATOR },
  { label: '审核员', value: Role.REVIEWER },
];

const priorityOptions = [
  { label: '普通', value: 'medium' },
  { label: '重要', value: 'high' },
  { label: '低优先级', value: 'low' },
];

interface PublishFormValues {
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  targetRoles?: string[];
  targetUsernames?: string[];
}

export default function NotificationPublish() {
  const [form] = Form.useForm<PublishFormValues>();
  const location = useLocation();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await authApi.getUserList();
      setUsers(res.data.items || []);
    } catch (err: any) {
      message.error(err?.message || '获取用户列表失败');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const state = location.state as Partial<PublishFormValues> | null;
    if (!state) return;
    form.setFieldsValue({
      title: state.title,
      message: state.message,
      priority: state.priority || 'medium',
      targetRoles: state.targetRoles,
      targetUsernames: state.targetUsernames,
    });
  }, [form, location.state]);

  const userOptions = useMemo(
    () =>
      users.map((user) => ({
        label: `${user.username} (${roleOptions.find((role) => role.value === user.role)?.label || user.role})`,
        value: user.username,
      })),
    [users],
  );

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const targetRoles = values.targetRoles || [];
      const targetUsernames = values.targetUsernames || [];

      if (targetRoles.length === 0 && targetUsernames.length === 0) {
        message.warning('请至少选择一个接收角色或接收人员');
        return;
      }

      setSubmitting(true);
      const res = await publishNotification({
        title: values.title,
        message: values.message,
        priority: values.priority,
        targetRoles,
        targetUsernames,
      });
      message.success(`通知已发布，送达 ${res.data.delivered} 人`);
      form.resetFields();
      form.setFieldsValue({ priority: 'medium' });
    } catch (err: any) {
      if (err?.message) message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <NotificationOutlined style={{ color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>通知发布</Title>
        </Space>
        <Tag color="blue">负责人权限</Tag>
      </div>

      <Alert
        type="info"
        showIcon
        message="负责人发布的通知会进入接收人的通知铃铛，可按角色、人员或两者组合发送。"
      />

      <Card size="small" styles={{ body: { maxWidth: 760 } }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ priority: 'medium' }}
          autoComplete="off"
        >
          <Form.Item
            name="title"
            label="通知标题"
            rules={[{ required: true, message: '请输入通知标题' }]}
          >
            <Input maxLength={60} showCount placeholder="例如：本周审核安排调整" />
          </Form.Item>

          <Form.Item
            name="message"
            label="通知内容"
            rules={[{ required: true, message: '请输入通知内容' }]}
          >
            <Input.TextArea rows={6} maxLength={500} showCount placeholder="请输入需要同步给目标人员的内容" />
          </Form.Item>

          <Form.Item name="priority" label="优先级">
            <Select style={{ width: 180 }} options={priorityOptions} />
          </Form.Item>

          <Form.Item name="targetRoles" label="按角色发送">
            <Checkbox.Group options={roleOptions} />
          </Form.Item>

          <Form.Item name="targetUsernames" label="按人员发送">
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              loading={loadingUsers}
              options={userOptions}
              placeholder="选择指定接收人员"
            />
          </Form.Item>

          <Space>
            <Button type="primary" icon={<SendOutlined />} loading={submitting} onClick={handleSubmit}>
              发布通知
            </Button>
            <Button onClick={() => form.resetFields()}>重置</Button>
            <Text type="secondary">角色和人员取并集，重复人员只发送一次。</Text>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
