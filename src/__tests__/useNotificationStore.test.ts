/**
 * Notification Store 单元测试
 *
 * 运行: npx vitest run src/__tests__/useNotificationStore.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useNotificationStore } from '../store/useNotificationStore';

describe('useNotificationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('should initialize with empty state', () => {
    const store = useNotificationStore();
    expect(store.notifications).toEqual([]);
    expect(store.unreadCount).toBe(0);
    expect(store.panelOpen).toBe(false);
    expect(store.connected).toBe(false);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.hasUnread).toBe(false);
  });

  it('should add notification correctly', () => {
    const store = useNotificationStore();
    store.setCurrentUser('u001');
    store.addNotification({
      id: 'n001',
      type: 'task_assigned',
      title: 'New Task',
      message: 'You have been assigned a new task',
      priority: 'high',
      data: {},
      sender: 'owner',
      targetUsers: ['u001'],
      timestamp: new Date().toISOString(),
      read: false,
    });
    expect(store.notifications.length).toBe(1);
    expect(store.unreadCount).toBe(1);
    expect(store.hasUnread).toBe(true);
  });

  it('should not add duplicate notifications', () => {
    const store = useNotificationStore();
    store.setCurrentUser('u001');
    const notif = {
      id: 'n001',
      type: 'task_assigned',
      title: 'Task',
      message: 'msg',
      priority: 'high' as const,
      data: {},
      sender: 'owner',
      targetUsers: ['u001'],
      timestamp: new Date().toISOString(),
      read: false,
    };
    store.addNotification(notif);
    store.addNotification(notif);
    expect(store.notifications.length).toBe(1);
  });

  it('should mark notification as read', () => {
    const store = useNotificationStore();
    store.setCurrentUser('u001');
    store.addNotification({
      id: 'n001',
      type: 'task_assigned',
      title: 'Task',
      message: 'msg',
      priority: 'high',
      data: {},
      sender: 'owner',
      targetUsers: ['u001'],
      timestamp: new Date().toISOString(),
      read: false,
    });
    store.markAsRead('n001');
    expect(store.notifications[0]?.read).toBe(true);
    expect(store.unreadCount).toBe(0);
  });

  it('should toggle panel', () => {
    const store = useNotificationStore();
    expect(store.panelOpen).toBe(false);
    store.togglePanel();
    expect(store.panelOpen).toBe(true);
    store.setPanelOpen(false);
    expect(store.panelOpen).toBe(false);
  });

  it('should clear notifications', () => {
    const store = useNotificationStore();
    store.setCurrentUser('u001');
    store.addNotification({
      id: 'n001',
      type: 'task_assigned',
      title: 'Task',
      message: 'msg',
      priority: 'low',
      data: {},
      sender: 'owner',
      targetUsers: ['u001'],
      timestamp: new Date().toISOString(),
      read: false,
    });
    store.clearAll();
    expect(store.notifications.length).toBe(0);
  });

  it('should set error state', () => {
    const store = useNotificationStore();
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
  });
});
