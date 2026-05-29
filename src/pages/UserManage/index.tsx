import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Typography,
} from 'antd';
import {
  UserAddOutlined, EditOutlined, DeleteOutlined, KeyOutlined, ReloadOutlined,
} from '@ant-design/icons';
import type { UserInfo } from '../../types';
import * as authApi from '../../api/auth';

const { Title } = Typography;

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  owner: { label: '负责人', color: 'red' },
  annotator: { label: '标注员', color: 'blue' },
  reviewer: { label: '审核员', color: 'green' },
};

export default function UserManage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authApi.getUserList();
      setUsers(res.data.items);
    } catch (err: any) {
      message.error(err?.message || '获取用户列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ===== Create User =====
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      await authApi.createUser(values);
      message.success('用户创建成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchUsers();
    } catch (err: any) {
      if (err?.message) message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Update User =====
  const handleEdit = async () => {
    if (!editingUser) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      await authApi.updateUser(editingUser.id, values);
      message.success('用户更新成功');
      setEditModalOpen(false);
      setEditingUser(null);
      editForm.resetFields();
      fetchUsers();
    } catch (err: any) {
      if (err?.message) message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Change Password =====
  const handleChangePassword = async () => {
    if (!editingUser) return;
    try {
      const values = await passwordForm.validateFields();
      setSubmitting(true);
      await authApi.changePassword(editingUser.id, {
        newPassword: values.newPassword,
      });
      message.success('密码修改成功');
      setPasswordModalOpen(false);
      setEditingUser(null);
      passwordForm.resetFields();
    } catch (err: any) {
      if (err?.message) message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Delete User =====
  const handleDelete = async (id: string) => {
    try {
      await authApi.deleteUser(id);
      message.success('用户删除成功');
      fetchUsers();
    } catch (err: any) {
      message.error(err?.message || '删除失败');
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 180,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => {
        const cfg = ROLE_CONFIG[role] || { label: role, color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 140,
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_: unknown, record: UserInfo) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingUser(record);
              editForm.setFieldsValue({ username: record.username, role: record.role });
              setEditModalOpen(true);
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<KeyOutlined />}
            onClick={() => {
              setEditingUser(record);
              setPasswordModalOpen(true);
            }}
          >
            改密
          </Button>
          <Popconfirm
            title={`确定删除用户 "${record.username}" 吗？`}
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <Card
        size="small"
        style={{ marginBottom: 12 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Title level={5} style={{ margin: 0 }}>用户管理</Title>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchUsers} loading={loading}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => {
                createForm.resetFields();
                setCreateModalOpen(true);
              }}
            >
              新增用户
            </Button>
          </Space>
        </Space>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={users}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          size="small"
        />
      </Card>

      {/* ===== Create User Modal ===== */}
      <Modal
        title="新增用户"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        confirmLoading={submitting}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" autoComplete="off">
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 2, message: '用户名至少2个字符' },
            ]}
          >
            <Input placeholder="请输入用户名" maxLength={30} />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 4, message: '密码至少4位' },
            ]}
          >
            <Input.Password placeholder="请输入密码" maxLength={50} />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Select.Option value="owner">
                <Tag color="red">负责人</Tag> — 管理所有任务、模板、用户
              </Select.Option>
              <Select.Option value="annotator">
                <Tag color="blue">标注员</Tag> — 执行数据标注
              </Select.Option>
              <Select.Option value="reviewer">
                <Tag color="green">审核员</Tag> — 审核标注结果
              </Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== Edit User Modal ===== */}
      <Modal
        title={`编辑用户 — ${editingUser?.username ?? ''}`}
        open={editModalOpen}
        onOk={handleEdit}
        onCancel={() => { setEditModalOpen(false); setEditingUser(null); editForm.resetFields(); }}
        confirmLoading={submitting}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" autoComplete="off">
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 2, message: '用户名至少2个字符' },
            ]}
          >
            <Input placeholder="请输入用户名" maxLength={30} />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Select.Option value="owner">
                <Tag color="red">负责人</Tag>
              </Select.Option>
              <Select.Option value="annotator">
                <Tag color="blue">标注员</Tag>
              </Select.Option>
              <Select.Option value="reviewer">
                <Tag color="green">审核员</Tag>
              </Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== Change Password Modal ===== */}
      <Modal
        title={`修改密码 — ${editingUser?.username ?? ''}`}
        open={passwordModalOpen}
        onOk={handleChangePassword}
        onCancel={() => { setPasswordModalOpen(false); setEditingUser(null); passwordForm.resetFields(); }}
        confirmLoading={submitting}
        okText="确认修改"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={passwordForm} layout="vertical" autoComplete="off">
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 4, message: '密码至少4位' },
            ]}
          >
            <Input.Password placeholder="请输入新密码" maxLength={50} />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次密码输入不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" maxLength={50} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
