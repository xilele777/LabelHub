import { Card, Form, Input, Button, Typography, message, Spin, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { getDefaultPath } from '../../utils/roleHelper';

const { Title, Text } = Typography;

interface LoginFormValues {
  account: string;
  passcode: string;
}

export default function Login() {
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm<LoginFormValues>();

  const from = (location.state as { from?: string })?.from;

  const handleFinish = async (values: LoginFormValues) => {
    const user = await login(values.account, values.passcode);
    if (user) {
      message.success('登录成功');
      const target = from ?? getDefaultPath(user.role);
      navigate(target, { replace: true });
    } else {
      const latestError = useAuthStore.getState().error;
      message.error(latestError || '用户名或密码错误');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Spin spinning={loading}>
        <Card
          style={{ width: 420, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Title level={3} style={{ marginBottom: 4 }}>LabelHub</Title>
            <Text type="secondary">数据标注平台</Text>
          </div>

          {error && (
            <Alert
              type="error"
              message={error}
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Form form={form} onFinish={handleFinish} size="large" autoComplete="off">
            <input type="text" name="username" autoComplete="username" style={{ display: 'none' }} />
            <input type="password" name="password" autoComplete="current-password" style={{ display: 'none' }} />
            <Form.Item
              name="account"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="off" disabled={loading} />
            </Form.Item>
            <Form.Item
              name="passcode"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="new-password" disabled={loading} />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block loading={loading}>
                登录
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Spin>
    </div>
  );
}
