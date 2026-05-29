import { create } from 'zustand';
import type { UserInfo } from '../types';
import { loginApi } from '../api/auth';
import { AUTH_EXPIRED_EVENT } from '../api/request';
import { releaseAllItems } from '../api/annotation';

// ===== Auth Store =====

interface AuthState {
  user: UserInfo | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<UserInfo | null>;
  logout: () => Promise<void>;
  setUser: (user: UserInfo | null) => void;
}

function loadPersistedUser(): UserInfo | null {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      localStorage.removeItem('user');
      return null;
    }

    const saved = localStorage.getItem('user');
    if (!saved) return null;

    const user = JSON.parse(saved) as Partial<UserInfo>;
    if (!user.id || !user.username || !user.role) {
      localStorage.removeItem('user');
      return null;
    }

    return user as UserInfo;
  } catch {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: loadPersistedUser(),
  loading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const res = await loginApi({ username, password });
      const { token, user } = res.data;
      // 持久化
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, loading: false, error: null });
      return user;
    } catch (err: any) {
      const msg = err?.message || '登录失败';
      set({ loading: false, error: msg });
      return null;
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    // 登出前释放当前用户持有的所有悲观锁
    try {
      await releaseAllItems();
    } catch {
      // 静默失败，不阻塞登出
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, loading: false, error: null });
  },

  setUser: (user) => set({ user }),
}));

if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_EXPIRED_EVENT, () => {
    useAuthStore.setState({ user: null, loading: false, error: '登录已过期，请重新登录' });
  });
}
