import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Tag, theme } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { connectNotificationWS, disconnectNotificationWS } from '../services/notificationWebSocket';
import { getMenuItems, getMenuKeyToPath } from '../utils/menuConfig';
import { Role } from '../types';
import NotificationBell from '../components/NotificationBell';

const { Header, Sider, Content } = Layout;

const keyToPath = getMenuKeyToPath();

const roleLabelMap: Record<Role, { label: string; color: string }> = {
  [Role.OWNER]: { label: '负责人', color: 'blue' },
  [Role.ANNOTATOR]: { label: '标注员', color: 'green' },
  [Role.REVIEWER]: { label: '审核员', color: 'orange' },
};

/** 根据当前路径用前缀匹配找到最合适的菜单 key */
function getSelectedKey(pathname: string): string {
  let bestKey = 'dashboard';
  let bestLen = 0;
  for (const [key, path] of Object.entries(keyToPath)) {
    if (pathname === path || pathname.startsWith(path + '/')) {
      if (path.length > bestLen) {
        bestKey = key;
        bestLen = path.length;
      }
    }
  }
  return bestKey;
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const { setConnected, setCurrentUser, setPanelOpen, fetchNotifications } = useNotificationStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  // ─── WebSocket 连接生命周期管理 ───
  useEffect(() => {
    const authToken = localStorage.getItem('token');
    if (authToken && user) {
      // 切换用户时加载该用户持久化的通知，而非清空
      setCurrentUser(user.id);
      setPanelOpen(false);
      fetchNotifications();
      // 登录后自动连接 WebSocket
      connectNotificationWS(authToken);
    } else {
      // 用户登出：重置通知用户上下文
      setCurrentUser(null);
    }

    return () => {
      // 组件卸载时断开 WebSocket
      disconnectNotificationWS();
      setConnected(false);
    };
  }, [user?.id, setCurrentUser, setPanelOpen, setConnected, fetchNotifications]);

  const selectedKey = getSelectedKey(location.pathname);

  const menuItems = getMenuItems(user?.role ?? null);

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        // 先断开 WebSocket，防止登出后仍尝试重连
        disconnectNotificationWS();
        setConnected(false);
        setCurrentUser(null);
        logout();
        navigate('/login');
      },
    },
  ];

  const roleInfo = user ? roleLabelMap[user.role] : null;

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div
          style={{
            height: 32,
            margin: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: collapsed ? 14 : 18,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {collapsed ? 'LH' : 'LabelHub'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => {
            const target = keyToPath[key];
            if (target) navigate(target);
          }}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s', height: '100vh', overflow: 'hidden' }}>
        <Header
          style={{
            padding: '0 24px',
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            flexShrink: 0,
            height: 64,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 500 }}>数据标注平台</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NotificationBell />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar size="small" icon={<UserOutlined />} />
                <span>{user?.username ?? '—'}</span>
                {roleInfo && <Tag color={roleInfo.color}>{roleInfo.label}</Tag>}
              </span>
            </Dropdown>
          </div>
        </Header>
        <Content style={{
          flex: 1,
          minHeight: 0,
          margin: 16,
          padding: 20,
          background: token.colorBgContainer,
          borderRadius: token.borderRadiusLG,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
