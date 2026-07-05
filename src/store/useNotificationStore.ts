import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { logger } from '../utils/logger';
import * as notificationApi from '../api/notification';

export type NotificationPriority = 'high' | 'medium' | 'low';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  data: Record<string, unknown>;
  sender: string | null;
  targetUsers: string[];
  timestamp: string;
  read: boolean;
}

export interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  panelOpen: boolean;
  connected: boolean;
  currentUserId: string | null;
  loading: boolean;
  error: string | null;
}

const MAX_NOTIFICATIONS = 100;
const STORAGE_PREFIX = 'notif_';

export const NOTIFICATION_COLOR_MAP: Record<string, string> = {
  review_approved: '#52c41a',
  review_rejected: '#ff4d4f',
  ai_review_complete: '#722ed1',
  task_assigned: '#1890ff',
  task_unassigned: '#faad14',
  task_submitted: '#13c2c2',
  task_resubmitted: '#eb2f96',
  task_status_changed: '#8c8c8c',
  task_due_soon: '#ff4d4f',
  owner_message: '#1677ff',
};

function getStorage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function saveToLocalStorage(userId: string | null, notifications: NotificationItem[]): void {
  if (!userId) return;
  try {
    getStorage()?.setItem(getStorageKey(userId), JSON.stringify(notifications));
  } catch {
    // localStorage may be unavailable or full.
  }
}

function loadFromLocalStorage(userId: string): NotificationItem[] {
  try {
    const raw = getStorage()?.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as NotificationItem[]).slice(0, MAX_NOTIFICATIONS) : [];
  } catch {
    return [];
  }
}

function removeFromLocalStorage(userId: string): void {
  try {
    getStorage()?.removeItem(getStorageKey(userId));
  } catch {
    // Ignore storage cleanup failures.
  }
}

const useNotificationPiniaStore = defineStore('notification', () => {
  const notifications = ref<NotificationItem[]>([]);
  const unreadCount = ref(0);
  const panelOpen = ref(false);
  const connected = ref(false);
  const currentUserId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const hasUnread = computed(() => unreadCount.value > 0);
  const latestNotification = computed(() => notifications.value[0]);

  function syncNotifications(nextNotifications: NotificationItem[]) {
    notifications.value = nextNotifications.slice(0, MAX_NOTIFICATIONS);
    unreadCount.value = notifications.value.filter((notification) => !notification.read).length;
    saveToLocalStorage(currentUserId.value, notifications.value);
  }

  function addNotification(notification: NotificationItem): void {
    if (notifications.value.some((item) => item.id === notification.id)) return;
    syncNotifications([notification, ...notifications.value]);
  }

  async function fetchNotifications(): Promise<void> {
    if (!currentUserId.value) return;

    loading.value = true;
    error.value = null;

    try {
      const res = await notificationApi.getNotificationList({ limit: MAX_NOTIFICATIONS });
      notifications.value = res.data.items || [];
      unreadCount.value =
        res.data.unreadCount ?? notifications.value.filter((item) => !item.read).length;
      saveToLocalStorage(currentUserId.value, notifications.value);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch notifications';
      error.value = message;
      logger.warn('[NotificationStore] Failed to fetch notifications:', err);
    } finally {
      loading.value = false;
    }
  }

  function markAsRead(id: string): void {
    syncNotifications(
      notifications.value.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    );
    notificationApi.markNotificationRead(id).catch(() => {});
  }

  function markAllAsRead(): void {
    syncNotifications(notifications.value.map((notification) => ({ ...notification, read: true })));
    unreadCount.value = 0;
    notificationApi.markAllNotificationsRead().catch(() => {});
  }

  function clearAll(): void {
    syncNotifications([]);
    notificationApi.clearNotifications().catch(() => {});
  }

  function removeNotification(id: string): void {
    syncNotifications(notifications.value.filter((notification) => notification.id !== id));
    notificationApi.deleteNotification(id).catch(() => {});
  }

  function togglePanel(): void {
    panelOpen.value = !panelOpen.value;
  }

  function setPanelOpen(open: boolean): void {
    panelOpen.value = open;
  }

  function setConnected(nextConnected: boolean): void {
    connected.value = nextConnected;
  }

  function setCurrentUser(userId: string | null): void {
    if (currentUserId.value === userId) return;

    if (currentUserId.value) {
      saveToLocalStorage(currentUserId.value, notifications.value);
    }

    currentUserId.value = userId;
    panelOpen.value = false;

    if (!userId) {
      notifications.value = [];
      unreadCount.value = 0;
      return;
    }

    const savedNotifications = loadFromLocalStorage(userId);
    notifications.value = savedNotifications;
    unreadCount.value = savedNotifications.filter((notification) => !notification.read).length;
  }

  function clearUserStorage(): void {
    if (currentUserId.value) {
      removeFromLocalStorage(currentUserId.value);
    }
  }

  return {
    notifications,
    unreadCount,
    panelOpen,
    connected,
    currentUserId,
    loading,
    error,
    hasUnread,
    latestNotification,
    addNotification,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    clearAll,
    removeNotification,
    togglePanel,
    setPanelOpen,
    setConnected,
    setCurrentUser,
    clearUserStorage,
  };
});

export type NotificationStore = ReturnType<typeof useNotificationPiniaStore>;

interface UseNotificationStore {
  (): NotificationStore;
  <T>(selector: (store: NotificationStore) => T): T;
  getState: () => NotificationStore;
  setState: (patch: Partial<NotificationState>) => void;
}

export const useNotificationStore = ((selector?: (store: NotificationStore) => unknown) => {
  const store = useNotificationPiniaStore();
  return selector ? selector(store) : store;
}) as UseNotificationStore;

useNotificationStore.getState = () => useNotificationPiniaStore();
useNotificationStore.setState = (patch) => {
  useNotificationPiniaStore().$patch(patch as never);
};
