<template>
  <!-- 无障碍：跳过导航直达内容的隐藏链接（Tab 聚焦时可见） -->
  <a href="#main-content" class="skip-to-content">跳至内容</a>
  <a-layout class="labelhub-layout" :class="{ 'labelhub-layout--collapsed': collapsed }">
    <a-layout-sider
      v-model:collapsed="collapsed"
      class="labelhub-layout__sider"
      :width="184"
      :collapsed-width="72"
      collapsible
    >
      <div class="labelhub-layout__brand">
        <span class="labelhub-layout__brand-logo" aria-hidden="true">
          <span class="labelhub-layout__brand-dot labelhub-layout__brand-dot--blue"></span>
          <span class="labelhub-layout__brand-dot labelhub-layout__brand-dot--red"></span>
          <span class="labelhub-layout__brand-dot labelhub-layout__brand-dot--yellow"></span>
          <span class="labelhub-layout__brand-dot labelhub-layout__brand-dot--green"></span>
        </span>
        <span class="labelhub-layout__brand-mark">{{ collapsed ? 'LH' : 'LabelHub' }}</span>
      </div>
      <a-menu theme="light" mode="inline" :selected-keys="selectedKeys" :items="menuItems" />
    </a-layout-sider>
    <a-layout class="labelhub-layout__main">
      <NetworkStatusBar />
      <a-layout-header class="labelhub-layout__header">
        <div class="labelhub-layout__title">
          <a-typography-text strong class="labelhub-layout__route-title">
            {{ currentTitle }}
          </a-typography-text>
        </div>
        <div class="labelhub-layout__actions">
          <a-popover
            v-model:open="notificationStore.panelOpen"
            trigger="click"
            placement="bottomRight"
            :arrow="false"
          >
            <template #content>
              <div class="notification-panel">
                <div class="notification-panel__header">
                  <div class="notification-panel__title">
                    <span>通知</span>
                    <a-tag v-if="notificationStore.unreadCount > 0" color="red">
                      {{ notificationStore.unreadCount }} 条未读
                    </a-tag>
                  </div>
                  <div class="notification-panel__tools">
                    <a-tooltip
                      :title="notificationStore.connected ? '实时通知已连接' : '实时通知未连接'"
                    >
                      <WifiOutlined
                        v-if="notificationStore.connected"
                        class="notification-panel__status notification-panel__status--online"
                      />
                      <DisconnectOutlined
                        v-else
                        class="notification-panel__status notification-panel__status--offline"
                      />
                    </a-tooltip>
                    <a-button
                      v-if="notificationStore.unreadCount > 0"
                      type="link"
                      size="small"
                      @click.stop="handleMarkAllRead"
                    >
                      <template #icon>
                        <CheckOutlined />
                      </template>
                      全部已读
                    </a-button>
                    <a-button
                      v-if="notificationStore.notifications.length > 0"
                      type="link"
                      size="small"
                      danger
                      @click.stop="notificationStore.clearAll()"
                    >
                      <template #icon>
                        <DeleteOutlined />
                      </template>
                      清空
                    </a-button>
                  </div>
                </div>

                <div class="notification-panel__body">
                  <a-empty
                    v-if="notificationStore.notifications.length === 0"
                    class="notification-panel__empty"
                    :image="simpleEmptyImage"
                    description="暂无通知"
                  />
                  <button
                    v-for="item in notificationStore.notifications"
                    v-else
                    :key="item.id"
                    type="button"
                    class="notification-panel__item"
                    :class="{ 'notification-panel__item--unread': !item.read }"
                    :style="{ '--notification-color': getNotificationColor(item.type) }"
                    @click="handleNotificationClick(item)"
                  >
                    <span class="notification-panel__item-icon">
                      <component :is="getNotificationIcon(item.type)" />
                    </span>
                    <span class="notification-panel__item-main">
                      <span class="notification-panel__item-title">
                        <span class="notification-panel__item-name">{{ item.title }}</span>
                        <a-tag
                          :color="getNotificationColor(item.type)"
                          class="notification-panel__item-tag"
                        >
                          {{ getNotificationLabel(item.type) }}
                        </a-tag>
                        <a-tag
                          v-if="item.priority === 'high'"
                          color="red"
                          class="notification-panel__item-tag"
                        >
                          重要
                        </a-tag>
                      </span>
                      <span class="notification-panel__item-message">{{ item.message }}</span>
                      <span class="notification-panel__item-meta">
                        {{ formatRelativeTime(item.timestamp) }}
                        <template
                          v-if="item.sender && item.sender !== 'system' && item.sender !== 'AI系统'"
                        >
                          来自 {{ item.sender }}
                        </template>
                      </span>
                    </span>
                    <a-tooltip title="删除">
                      <a-button
                        type="text"
                        size="small"
                        class="notification-panel__delete"
                        @click.stop="notificationStore.removeNotification(item.id)"
                      >
                        <template #icon>
                          <DeleteOutlined />
                        </template>
                      </a-button>
                    </a-tooltip>
                  </button>
                </div>
              </div>
            </template>

            <a-badge :count="notificationStore.unreadCount" size="small" :offset="[-3, 3]">
              <a-button type="text" class="labelhub-layout__icon-button" title="通知">
                <template #icon>
                  <BellOutlined />
                </template>
              </a-button>
            </a-badge>
          </a-popover>

          <a-dropdown placement="bottomRight">
            <button class="labelhub-layout__user" type="button">
              <a-avatar size="small">
                <template #icon>
                  <UserOutlined />
                </template>
              </a-avatar>
              <span class="labelhub-layout__username">{{ userStore.user?.username ?? '-' }}</span>
              <a-tag v-if="roleInfo" :color="roleInfo.color" class="labelhub-layout__role">
                {{ roleInfo.label }}
              </a-tag>
            </button>
            <template #overlay>
              <a-menu>
                <a-menu-item key="status" disabled>
                  <template #icon>
                    <WifiOutlined v-if="notificationStore.connected" />
                    <DisconnectOutlined v-else />
                  </template>
                  {{ notificationStore.connected ? '实时已连接' : '实时未连接' }}
                </a-menu-item>
                <a-menu-divider />
                <a-menu-item key="logout" @click="handleLogout">
                  <template #icon>
                    <LogoutOutlined />
                  </template>
                  退出登录
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>
      <a-layout-content id="main-content" class="labelhub-layout__content">
        <ErrorBoundary>
          <router-view v-slot="{ Component, route: routeData }">
            <transition name="page-fade" mode="out-in" appear>
              <!-- 列表页按组件名白名单缓存，返回时保留筛选与滚动状态 -->
              <keep-alive include="TaskListPage,TemplateManagePage">
                <component :is="Component" :key="routeData.path" />
              </keep-alive>
            </transition>
          </router-view>
        </ErrorBoundary>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ItemType } from 'ant-design-vue';
import {
  AuditOutlined,
  BarChartOutlined,
  BellOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DashboardOutlined,
  DisconnectOutlined,
  EditOutlined,
  ExportOutlined,
  FieldTimeOutlined,
  LineChartOutlined,
  InboxOutlined,
  LogoutOutlined,
  NotificationOutlined,
  RobotOutlined,
  SendOutlined,
  SwapOutlined,
  SyncOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  UserOutlined,
  WifiOutlined,
} from '@ant-design/icons-vue';
import { Role } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import {
  NOTIFICATION_COLOR_MAP,
  type NotificationItem,
  useNotificationStore,
} from '../store/useNotificationStore';
import { hasRouteRole } from '../utils/roleHelper';
import { useAnnotationStore } from '../store/useAnnotationStore';
import {
  connectNotificationWS,
  disconnectNotificationWS,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationWebSocket';
import ErrorBoundary from '../components/ErrorBoundary.vue';
import NetworkStatusBar from '../components/NetworkStatusBar.vue';

const route = useRoute();
const router = useRouter();
const userStore = useAuthStore();
const notificationStore = useNotificationStore();
const collapsed = ref(false);
const simpleEmptyImage = undefined;

type NavItem = {
  key: string;
  label: string;
  path: string;
  roles: Role[];
  icon: unknown;
  match?: string[];
};

const roleLabelMap: Record<Role, { label: string; color: string }> = {
  [Role.ADMIN]: { label: '管理员', color: 'purple' },
  [Role.OWNER]: { label: '负责人', color: 'blue' },
  [Role.ANNOTATOR]: { label: '标注员', color: 'green' },
  [Role.REVIEWER]: { label: '审核员', color: 'orange' },
};

const navItems: NavItem[] = [
  {
    key: 'dashboard',
    label: '概览',
    path: '/dashboard',
    roles: [Role.ADMIN, Role.ANNOTATOR, Role.REVIEWER],
    icon: DashboardOutlined,
  },
  {
    key: 'annotate',
    label: '标注工作台',
    path: '/annotate',
    roles: [Role.ANNOTATOR],
    icon: EditOutlined,
  },
  {
    key: 'review',
    label: '审核工作台',
    path: '/review',
    roles: [Role.REVIEWER],
    icon: AuditOutlined,
  },
  {
    key: 'tasks',
    label: '任务',
    path: '/tasks',
    match: ['/tasks'],
    roles: [Role.ADMIN],
    icon: InboxOutlined,
  },
  {
    key: 'archive',
    label: '归档',
    path: '/archive',
    roles: [Role.ADMIN, Role.ANNOTATOR, Role.REVIEWER],
    icon: InboxOutlined,
  },
  { key: 'templates', label: '模板', path: '/templates', roles: [Role.ADMIN], icon: EditOutlined },
  {
    key: 'template-builder',
    label: '搭建',
    path: '/templates/builder',
    roles: [Role.ADMIN],
    icon: SendOutlined,
  },
  {
    key: 'statistics',
    label: '统计',
    path: '/statistics',
    roles: [Role.ADMIN, Role.REVIEWER],
    icon: BarChartOutlined,
  },
  {
    key: 'monitoring',
    label: '监控',
    path: '/monitoring',
    roles: [Role.ADMIN],
    icon: LineChartOutlined,
  },
  {
    key: 'export',
    label: '导出',
    path: '/export',
    roles: [Role.ADMIN, Role.REVIEWER],
    icon: ExportOutlined,
  },
  { key: 'users', label: '用户管理', path: '/users', roles: [Role.ADMIN], icon: TeamOutlined },
  {
    key: 'notification-publish',
    label: '发通知',
    path: '/notifications/publish',
    roles: [Role.ADMIN],
    icon: SendOutlined,
  },
  {
    key: 'notification-manage',
    label: '通知管理',
    path: '/notifications/manage',
    roles: [Role.ADMIN],
    icon: NotificationOutlined,
  },
];

const notificationLabelMap: Record<string, string> = {
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

const notificationIconMap: Record<string, unknown> = {
  review_approved: CheckCircleOutlined,
  review_rejected: CloseCircleOutlined,
  ai_review_complete: RobotOutlined,
  task_assigned: UserAddOutlined,
  task_unassigned: UserDeleteOutlined,
  task_submitted: SendOutlined,
  task_resubmitted: SyncOutlined,
  task_status_changed: SwapOutlined,
  task_due_soon: FieldTimeOutlined,
  owner_message: NotificationOutlined,
};

const menuItems = computed<ItemType[]>(() => {
  const role = userStore.user?.role;
  if (!role) return [];

  return navItems
    .map((item) => {
      if (!hasRouteRole(role, item.roles)) return null;

      return {
        key: item.key,
        icon: () => h(item.icon as never),
        label: item.label,
        onClick: () => router.push(item.path),
      };
    })
    .filter(Boolean) as ItemType[];
});

const selectedKeys = computed(() => {
  const match = navItems
    .filter((item) => hasRouteRole(userStore.user?.role, item.roles))
    .filter((item) =>
      (item.match ?? [item.path]).some(
        (path) => route.path === path || route.path.startsWith(`${path}/`),
      ),
    )
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match ? [match.key] : [];
});

const currentTitle = computed(() => String(route.meta.title || 'LabelHub'));
const roleInfo = computed(() => {
  const role = userStore.user?.role;
  return role ? roleLabelMap[role] : null;
});

watch(
  () => [userStore.user?.id, userStore.token] as const,
  ([userId, token]) => {
    if (userId && token) {
      notificationStore.setCurrentUser(userId);
      notificationStore.setPanelOpen(false);
      void notificationStore.fetchNotifications();
      connectNotificationWS(token);
      return;
    }

    disconnectNotificationWS();
    notificationStore.setConnected(false);
    notificationStore.setCurrentUser(null);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  disconnectNotificationWS();
  notificationStore.setConnected(false);
});

async function handleLogout() {
  // 登出前释放当前用户持有的所有标注编辑锁（需在清除会话前调用，携带有效 token）
  await useAnnotationStore.getState().releaseAllMyItems();
  disconnectNotificationWS();
  notificationStore.setConnected(false);
  notificationStore.setCurrentUser(null);
  await userStore.logout();
  await router.replace('/login');
}

function getNotificationLabel(type: string): string {
  return notificationLabelMap[type] || '通知';
}

function getNotificationIcon(type: string): unknown {
  return notificationIconMap[type] || BellOutlined;
}

function getNotificationColor(type: string): string {
  return NOTIFICATION_COLOR_MAP[type] || '#8c8c8c';
}

function getStringData(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' && value ? value : null;
}

function getNotificationLink(notification: NotificationItem): string | null {
  const taskId = getStringData(notification.data, 'taskId');
  const dataItemId = getStringData(notification.data, 'dataItemId');
  const phase = getStringData(notification.data, 'phase');

  if (notification.type === 'review_rejected') {
    if (taskId && dataItemId) {
      return `/annotate?taskId=${encodeURIComponent(taskId)}&dataItemId=${encodeURIComponent(dataItemId)}`;
    }
    return taskId ? `/annotate?taskId=${encodeURIComponent(taskId)}` : '/annotate';
  }

  if (notification.type === 'task_resubmitted') {
    if (taskId && dataItemId) {
      return `/review?taskId=${encodeURIComponent(taskId)}&dataItemId=${encodeURIComponent(dataItemId)}`;
    }
    return taskId ? `/review?taskId=${encodeURIComponent(taskId)}` : '/review';
  }

  if (notification.type === 'task_submitted' || notification.type === 'ai_review_complete') {
    return taskId ? `/review?taskId=${encodeURIComponent(taskId)}` : '/review';
  }

  if (notification.type === 'task_status_changed') {
    return taskId ? `/tasks/detail?id=${encodeURIComponent(taskId)}` : '/tasks';
  }

  if (notification.type === 'task_due_soon') {
    if (phase === 'review') {
      return taskId ? `/review?taskId=${encodeURIComponent(taskId)}` : '/review';
    }
    return taskId ? `/annotate?taskId=${encodeURIComponent(taskId)}` : '/annotate';
  }

  if (notification.type === 'task_assigned') {
    return taskId ? `/annotate?taskId=${encodeURIComponent(taskId)}` : '/annotate';
  }

  return null;
}

function formatRelativeTime(timestamp: string): string {
  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time)) return '';

  const diff = Date.now() - time;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

function handleMarkAllRead() {
  notificationStore.markAllAsRead();
  markAllNotificationsRead();
}

async function handleNotificationClick(notification: NotificationItem) {
  notificationStore.markAsRead(notification.id);
  markNotificationRead(notification.id);

  const link = getNotificationLink(notification);
  if (!link) return;

  notificationStore.setPanelOpen(false);
  await router.push(link);
}
</script>

<style scoped>
.labelhub-layout {
  min-height: 100vh;
  height: 100vh;
  overflow: hidden;
  background: var(--lh-bg);
}

.labelhub-layout__sider {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 20;
  height: 100vh;
  overflow: auto;
  background: #fff !important;
  border-right: 1px solid var(--lh-border);
  box-shadow: none;
  transition:
    width var(--lh-motion-slow) var(--lh-ease-emphasized),
    max-width var(--lh-motion-slow) var(--lh-ease-emphasized),
    min-width var(--lh-motion-slow) var(--lh-ease-emphasized),
    border-color var(--lh-motion-base) var(--lh-ease-standard);
}

.labelhub-layout__sider :deep(.ant-layout-sider-trigger) {
  color: #5f6368;
  background: #fff;
  border-top: 1px solid var(--lh-border);
}

.labelhub-layout__sider :deep(.ant-menu-dark),
.labelhub-layout__sider :deep(.ant-menu) {
  background: transparent;
}

.labelhub-layout__sider :deep(.ant-menu-item) {
  width: calc(100% - 16px);
  height: 38px;
  margin: 3px 8px;
  border-radius: 6px;
  color: #3c4043;
  transition:
    color var(--lh-motion-base) var(--lh-ease-standard),
    background-color var(--lh-motion-base) var(--lh-ease-standard),
    transform var(--lh-motion-base) var(--lh-ease-standard);
}

.labelhub-layout__sider :deep(.ant-menu-item:hover) {
  color: #174ea6;
  background: #f4f7fb;
  transform: translateX(2px);
}

.labelhub-layout__sider :deep(.ant-menu-item-selected) {
  color: #174ea6;
  background: #eaf2ff;
  box-shadow: none;
  transform: translateX(2px);
}

.labelhub-layout__sider :deep(.ant-menu-item-selected .ant-menu-item-icon),
.labelhub-layout__sider :deep(.ant-menu-item-selected .anticon) {
  color: #1a73e8;
}

.labelhub-layout__brand {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  height: 60px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--lh-divider);
}

.labelhub-layout__brand-logo {
  display: grid;
  grid-template-columns: repeat(2, 8px);
  grid-template-rows: repeat(2, 8px);
  gap: 3px;
  flex: 0 0 auto;
  transition: transform var(--lh-motion-slow) var(--lh-ease-emphasized);
}

.labelhub-layout__brand:hover .labelhub-layout__brand-logo {
  transform: rotate(8deg) scale(1.04);
}

.labelhub-layout__brand-dot {
  display: block;
  border-radius: 50%;
}

.labelhub-layout__brand-dot--blue {
  background: #4285f4;
}

.labelhub-layout__brand-dot--red {
  background: #ea4335;
}

.labelhub-layout__brand-dot--yellow {
  background: #fbbc04;
}

.labelhub-layout__brand-dot--green {
  background: #34a853;
}

.labelhub-layout__brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  padding: 0;
  color: #202124;
  font-size: 18px;
  font-weight: 650;
  line-height: 1;
  white-space: nowrap;
  background: transparent;
  border: 0;
  border-radius: 0;
  letter-spacing: 0;
}

.labelhub-layout--collapsed .labelhub-layout__brand {
  justify-content: center;
  gap: 0;
  padding-inline: 12px;
}

.labelhub-layout--collapsed .labelhub-layout__brand-logo {
  display: none;
}

.labelhub-layout--collapsed .labelhub-layout__brand-mark {
  font-size: 15px;
}

.labelhub-layout__main {
  height: 100vh;
  margin-left: 184px;
  overflow: hidden;
  transition: margin-left var(--lh-motion-slow) var(--lh-ease-emphasized);
}

.labelhub-layout--collapsed .labelhub-layout__main {
  margin-left: 72px;
}

.labelhub-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  height: 56px;
  padding: 0 22px;
  background: #fff;
  border-bottom: 1px solid var(--lh-border);
  box-shadow: none;
  transition: border-color var(--lh-motion-base) var(--lh-ease-standard);
}

.labelhub-layout__title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.labelhub-layout__route-title {
  max-width: 320px;
  overflow: hidden;
  color: #202124;
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--lh-motion-base) var(--lh-ease-standard);
}

.labelhub-layout__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.labelhub-layout__icon-button {
  width: 34px;
  height: 34px;
  color: #5f6368;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  transition:
    color var(--lh-motion-fast) var(--lh-ease-standard),
    background-color var(--lh-motion-fast) var(--lh-ease-standard),
    transform var(--lh-motion-fast) var(--lh-ease-standard);
}

.labelhub-layout__icon-button:hover {
  color: var(--lh-primary);
  background: #f1f3f4;
  border-color: transparent;
  transform: translateY(-1px);
}

.notification-panel {
  width: min(400px, calc(100vw - 32px));
  max-height: 500px;
  overflow: hidden;
  background: #fff;
  border-radius: 8px;
  box-shadow: var(--lh-shadow-lg);
  animation: notification-panel-enter var(--lh-motion-slow) var(--lh-ease-emphasized);
}

.notification-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--lh-border);
}

.notification-panel__title,
.notification-panel__tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notification-panel__title {
  min-width: 0;
  color: #202124;
  font-weight: 600;
}

.notification-panel__tools {
  flex-shrink: 0;
}

.notification-panel__status {
  font-size: 14px;
}

.notification-panel__status--online {
  color: #188038;
}

.notification-panel__status--offline {
  color: #d93025;
}

.notification-panel__body {
  max-height: 400px;
  overflow-y: auto;
}

.notification-panel__empty {
  padding: 40px 0;
}

.notification-panel__item {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 28px;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid #edf0f5;
  cursor: pointer;
  transition:
    background-color var(--lh-motion-base) var(--lh-ease-standard),
    box-shadow var(--lh-motion-base) var(--lh-ease-standard),
    transform var(--lh-motion-base) var(--lh-ease-standard);
}

.notification-panel__item:hover {
  background: #f8fafd;
  transform: translateX(2px);
}

.notification-panel__item--unread {
  background: #f3f7ff;
  box-shadow: inset 3px 0 0 var(--notification-color);
}

.notification-panel__item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: var(--notification-color);
  background: color-mix(in srgb, var(--notification-color) 10%, white);
  border-radius: 50%;
  transition:
    background-color var(--lh-motion-base) var(--lh-ease-standard),
    transform var(--lh-motion-base) var(--lh-ease-standard);
}

.notification-panel__item:hover .notification-panel__item-icon {
  transform: scale(1.05);
}

.notification-panel__item-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 4px;
}

.notification-panel__item-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.notification-panel__item-name,
.notification-panel__item-message {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-panel__item-name {
  color: #202124;
  font-size: 14px;
  font-weight: 600;
}

.notification-panel__item-tag {
  flex-shrink: 0;
  margin-inline-end: 0;
  font-size: 11px;
  line-height: 18px;
}

.notification-panel__item-message {
  color: #5f6368;
  font-size: 13px;
}

.notification-panel__item-meta {
  color: #80868b;
  font-size: 11px;
}

.notification-panel__delete {
  align-self: start;
}

.labelhub-layout__user {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 260px;
  min-height: 34px;
  padding: 2px 6px;
  color: #202124;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  box-shadow: none;
  transition:
    background-color var(--lh-motion-fast) var(--lh-ease-standard),
    transform var(--lh-motion-fast) var(--lh-ease-standard);
}

.labelhub-layout__user:hover {
  border-color: transparent;
  background: #f1f3f4;
  transform: translateY(-1px);
}

.labelhub-layout__username {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.labelhub-layout__role {
  margin-inline-end: 0;
  line-height: 20px;
}

.labelhub-layout__content {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 18px 22px;
  overflow: auto;
  background: var(--lh-bg);
}

.labelhub-layout__content > :deep(*) {
  width: 100%;
  max-width: 1360px;
  margin-inline: auto;
}

@keyframes notification-panel-enter {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.985);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 768px) {
  .labelhub-layout__main {
    margin-left: 72px;
  }

  .labelhub-layout__header {
    padding: 0 16px;
  }

  .labelhub-layout__route-title,
  .labelhub-layout__username,
  .labelhub-layout__role {
    display: none;
  }

  .labelhub-layout__content {
    padding: 12px;
  }
}

/* ── 无障碍：跳至内容链接（Tab 聚焦时可见） ── */
.skip-to-content {
  position: fixed;
  top: -100%;
  left: 12px;
  z-index: 999;
  padding: 8px 16px;
  color: #fff;
  font-weight: 600;
  background: var(--lh-primary);
  border-radius: 6px;
  text-decoration: none;
  transition: top var(--lh-motion-base) var(--lh-ease-standard);
}

.skip-to-content:focus {
  top: 8px;
}
</style>
