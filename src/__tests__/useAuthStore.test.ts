/**
 * Auth Store 单元测试
 *
 * 运行: npx vitest run src/__tests__/useAuthStore.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../store/useAuthStore';
import { Role } from '../types';

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('should initialize with no user and no token', () => {
    const store = useAuthStore();
    expect(store.user).toBeNull();
    expect(store.token).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('should set session correctly', () => {
    const store = useAuthStore();
    store.setSession({
      token: 'test-token-123',
      user: { id: 'u001', username: 'owner', role: Role.OWNER },
    });
    expect(store.token).toBe('test-token-123');
    expect(store.user?.username).toBe('owner');
    expect(store.isAuthenticated).toBe(true);
    expect(store.role).toBe('owner');
  });

  it('should clear session correctly', () => {
    const store = useAuthStore();
    store.setSession({
      token: 'test-token',
      user: { id: 'u001', username: 'owner', role: Role.OWNER },
    });
    store.clearSession('expired');
    expect(store.token).toBeNull();
    expect(store.user).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(store.error).toBe('expired');
  });

  it('should persist user info to localStorage (not token)', () => {
    const store = useAuthStore();
    store.setSession({
      token: 'secure-token',
      user: { id: 'u001', username: 'owner', role: Role.OWNER },
    });
    const saved = localStorage.getItem('user');
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.username).toBe('owner');
    // Token should NOT be in localStorage (httpOnly cookie security)
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('should load persisted user on re-initialization', () => {
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 'u002', username: 'annotator', role: Role.ANNOTATOR }),
    );
    const store = useAuthStore();
    expect(store.user?.username).toBe('annotator');
    expect(store.role).toBe('annotator');
  });

  it('should clear invalid persisted user data', () => {
    localStorage.setItem('user', JSON.stringify({ invalid: true }));
    const store = useAuthStore();
    expect(store.user).toBeNull();
  });
});
