/**
 * 通知状态管理 Store (Zustand)
 *
 * 管理实时通知的状态：
 *   - 通知列表（最近 100 条）
 *   - 未读计数
 *   - 标记已读 / 全部已读
 *   - 清空通知
 *   - 通知弹窗显示/隐藏
 *   - 按用户持久化到 localStorage，页面刷新/重新登录后恢复
 */
import { create } from 'zustand';
import * as notificationApi from '../api/notification';

/**
 * 通知对象接口（与 WebSocket 服务一致）
 */
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  data: Record<string, any>;
  sender: string | null;
  targetUsers: string[];
  timestamp: string;
  read: boolean;
}

const MAX_NOTIFICATIONS = 100;

/** localStorage key 前缀，按用户隔离 */
const STORAGE_PREFIX = 'notif_';

/**
 * 通知类型 → 颜色映射
 */
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

// ─── localStorage 持久化辅助 ──────────────────────────────────

/**
 * 获取当前用户的 localStorage key
 */
function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

/**
 * 将通知持久化到 localStorage（按用户隔离）
 */
function saveToLocalStorage(userId: string | null, notifications: NotificationItem[]): void {
  if (!userId) return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(notifications));
  } catch {
    // localStorage 满或不可用时静默失败
  }
}

/**
 * 从 localStorage 加载用户通知
 */
function loadFromLocalStorage(userId: string): NotificationItem[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_NOTIFICATIONS) : [];
  } catch {
    return [];
  }
}

/**
 * 清除指定用户在 localStorage 中的通知
 */
function removeFromLocalStorage(userId: string): void {
  try {
    localStorage.removeItem(getStorageKey(userId));
  } catch {
    // 静默失败
  }
}

// ─── Store 定义 ──────────────────────────────────

interface NotificationState {
  /** 通知列表（最新在前） */
  notifications: NotificationItem[];
  /** 未读数量 */
  unreadCount: number;
  /** 通知面板是否打开 */
  panelOpen: boolean;
  /** 连接状态 */
  connected: boolean;
  /** 当前用户ID（用于按用户持久化） */
  currentUserId: string | null;

  /** 添加通知 */
  addNotification: (notification: NotificationItem) => void;
  /** 从服务端加载通知 */
  fetchNotifications: () => Promise<void>;
  /** 标记单条已读 */
  markAsRead: (id: string) => void;
  /** 标记全部已读 */
  markAllAsRead: () => void;
  /** 清空通知 */
  clearAll: () => void;
  /** 删除单条通知 */
  removeNotification: (id: string) => void;
  /** 切换面板开关 */
  togglePanel: () => void;
  /** 设置面板开关 */
  setPanelOpen: (open: boolean) => void;
  /** 设置连接状态 */
  setConnected: (connected: boolean) => void;
  /**
   * 切换当前用户：加载该用户持久化的通知
   * 若用户ID发生变化，将旧用户通知保存后加载新用户的
   */
  setCurrentUser: (userId: string | null) => void;
  /**
   * 登出时调用：仅清除 localStorage 中的通知数据，
   * 不影响内存状态（因为组件即将卸载）
   */
  clearUserStorage: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  panelOpen: false,
  connected: false,
  currentUserId: null,

  addNotification: (notification) => {
    set((state) => {
      // 去重：如果已存在相同 id 的通知，不再添加
      if (state.notifications.some((n) => n.id === notification.id)) {
        return state;
      }

      const newNotifications = [notification, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
      const unreadCount = newNotifications.filter((n) => !n.read).length;

      // 持久化
      saveToLocalStorage(state.currentUserId, newNotifications);

      return {
        notifications: newNotifications,
        unreadCount,
      };
    });
  },

  fetchNotifications: async () => {
    const { currentUserId } = get();
    if (!currentUserId) return;
    try {
      const res = await notificationApi.getNotificationList({ limit: MAX_NOTIFICATIONS });
      const notifications = res.data.items || [];
      const unreadCount = res.data.unreadCount ?? notifications.filter((n) => !n.read).length;
      saveToLocalStorage(currentUserId, notifications);
      set({ notifications, unreadCount });
    } catch (err) {
      console.warn('[NotificationStore] Failed to fetch notifications:', err);
    }
  },

  markAsRead: (id) => {
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      const unreadCount = notifications.filter((n) => !n.read).length;
      saveToLocalStorage(state.currentUserId, notifications);
      return { notifications, unreadCount };
    });
    notificationApi.markNotificationRead(id).catch(() => {});
  },

  markAllAsRead: () => {
    set((state) => {
      const notifications = state.notifications.map((n) => ({ ...n, read: true }));
      saveToLocalStorage(state.currentUserId, notifications);
      return {
        notifications,
        unreadCount: 0,
      };
    });
    notificationApi.markAllNotificationsRead().catch(() => {});
  },

  clearAll: () => {
    set((state) => {
      saveToLocalStorage(state.currentUserId, []);
      return { notifications: [], unreadCount: 0 };
    });
    notificationApi.clearNotifications().catch(() => {});
  },

  removeNotification: (id) => {
    set((state) => {
      const notifications = state.notifications.filter((n) => n.id !== id);
      const unreadCount = notifications.filter((n) => !n.read).length;
      saveToLocalStorage(state.currentUserId, notifications);
      return { notifications, unreadCount };
    });
    notificationApi.deleteNotification(id).catch(() => {});
  },

  togglePanel: () => {
    set((state) => ({ panelOpen: !state.panelOpen }));
  },

  setPanelOpen: (open) => {
    set({ panelOpen: open });
  },

  setConnected: (connected) => {
    set({ connected });
  },

  setCurrentUser: (userId) => {
    const { currentUserId, notifications } = get();

    // 同一用户，无需切换
    if (currentUserId === userId) return;

    // 先保存当前用户的通知
    if (currentUserId) {
      saveToLocalStorage(currentUserId, notifications);
    }

    if (userId) {
      // 加载新用户的通知
      const savedNotifications = loadFromLocalStorage(userId);
      const unreadCount = savedNotifications.filter((n) => !n.read).length;
      set({
        currentUserId: userId,
        notifications: savedNotifications,
        unreadCount,
        panelOpen: false,
      });
    } else {
      // 用户登出：清空内存
      set({
        currentUserId: null,
        notifications: [],
        unreadCount: 0,
        panelOpen: false,
      });
    }
  },

  clearUserStorage: () => {
    const { currentUserId } = get();
    if (currentUserId) {
      removeFromLocalStorage(currentUserId);
    }
  },
}));
