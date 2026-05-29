import {
  DashboardOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  BuildOutlined,
  EditOutlined,
  AuditOutlined,
  ExportOutlined,
  BarChartOutlined,
  TeamOutlined,
  InboxOutlined,
  NotificationOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Role, type MenuItem } from '../types';

/** 菜单配置 — roles 决定哪些角色可见 */
export const menuConfig: MenuItem[] = [
  {
    key: 'dashboard',
    label: '仪表盘',
    icon: 'DashboardOutlined',
    path: '/dashboard',
    roles: [Role.OWNER, Role.ANNOTATOR, Role.REVIEWER],
  },
  {
    key: 'task-list',
    label: '任务列表',
    icon: 'UnorderedListOutlined',
    path: '/tasks',
    roles: [Role.OWNER],
  },
  {
    key: 'task-archive',
    label: '任务归档',
    icon: 'InboxOutlined',
    path: '/archive',
    roles: [Role.OWNER, Role.ANNOTATOR, Role.REVIEWER],
  },
  {
    key: 'template-manage',
    label: '模板管理',
    icon: 'AppstoreOutlined',
    path: '/templates',
    roles: [Role.OWNER],
  },
  {
    key: 'template-builder',
    label: '模板搭建',
    icon: 'BuildOutlined',
    path: '/templates/builder',
    roles: [Role.OWNER],
  },
  {
    key: 'annotation-workbench',
    label: '标注工作台',
    icon: 'EditOutlined',
    path: '/annotate',
    roles: [Role.ANNOTATOR],
  },
  {
    key: 'review-workbench',
    label: '审核工作台',
    icon: 'AuditOutlined',
    path: '/review',
    roles: [Role.REVIEWER],
  },
  {
    key: 'data-export',
    label: '数据导出',
    icon: 'ExportOutlined',
    path: '/export',
    roles: [Role.OWNER, Role.REVIEWER],
  },
  {
    key: 'statistics-board',
    label: '统计看板',
    icon: 'BarChartOutlined',
    path: '/statistics',
    roles: [Role.OWNER, Role.REVIEWER],
  },
  {
    key: 'user-manage',
    label: '用户管理',
    icon: 'TeamOutlined',
    path: '/users',
    roles: [Role.OWNER],
  },
  {
    key: 'notification-publish',
    label: '通知发布',
    icon: 'NotificationOutlined',
    path: '/notifications/publish',
    roles: [Role.OWNER],
  },
  {
    key: 'notification-manage',
    label: '通知管理',
    icon: 'NotificationOutlined',
    path: '/notifications/manage',
    roles: [Role.OWNER],
  },
];

/** icon 名称 → 组件映射 */
const iconMap: Record<string, React.ReactNode> = {
  DashboardOutlined: <DashboardOutlined />,
  UnorderedListOutlined: <UnorderedListOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  BuildOutlined: <BuildOutlined />,
  EditOutlined: <EditOutlined />,
  AuditOutlined: <AuditOutlined />,
  ExportOutlined: <ExportOutlined />,
  BarChartOutlined: <BarChartOutlined />,
  TeamOutlined: <TeamOutlined />,
  InboxOutlined: <InboxOutlined />,
  NotificationOutlined: <NotificationOutlined />,
};

/** 根据角色过滤菜单，并转换为 antd MenuProps['items'] 格式 */
export function getMenuItems(role: Role | null): MenuProps['items'] {
  if (!role) return [];
  return menuConfig
    .filter((item) => item.roles.includes(role))
    .map((item) => ({
      key: item.key,
      icon: iconMap[item.icon ?? ''],
      label: item.label,
    }));
}

/** key → path 映射，用于菜单点击跳转 */
export function getMenuKeyToPath(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of menuConfig) {
    map[item.key] = item.path;
  }
  return map;
}
