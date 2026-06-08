import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { UserInfo } from '../types';
import { AUTH_EXPIRED_EVENT, resetUnauthorizedRedirect } from '../api/request';

export interface AuthState {
  user: UserInfo | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

function getStorage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function loadPersistedToken(): string | null {
  return getStorage()?.getItem(TOKEN_KEY) ?? null;
}

function loadPersistedUser(): UserInfo | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const token = storage.getItem(TOKEN_KEY);
    if (!token) {
      storage.removeItem(USER_KEY);
      return null;
    }

    const saved = storage.getItem(USER_KEY);
    if (!saved) return null;

    const user = JSON.parse(saved) as Partial<UserInfo>;
    if (!user.id || !user.username || !user.role) {
      storage.removeItem(USER_KEY);
      return null;
    }

    return user as UserInfo;
  } catch {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(USER_KEY);
    return null;
  }
}

const useAuthPiniaStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(loadPersistedUser());
  const token = ref<string | null>(loadPersistedToken());
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => Boolean(token.value && user.value));
  const role = computed(() => user.value?.role ?? null);

  function setSession(payload: { token: string; user: UserInfo }) {
    token.value = payload.token;
    user.value = payload.user;
    error.value = null;
    resetUnauthorizedRedirect();

    const storage = getStorage();
    storage?.setItem(TOKEN_KEY, payload.token);
    storage?.setItem(USER_KEY, JSON.stringify(payload.user));
  }

  function clearSession(message?: string) {
    token.value = null;
    user.value = null;
    loading.value = false;
    error.value = message ?? null;

    const storage = getStorage();
    storage?.removeItem(TOKEN_KEY);
    storage?.removeItem(USER_KEY);
  }

  function setUser(nextUser: UserInfo | null) {
    user.value = nextUser;

    const storage = getStorage();
    if (!storage) return;

    if (nextUser) {
      storage.setItem(USER_KEY, JSON.stringify(nextUser));
    } else {
      storage.removeItem(USER_KEY);
    }
  }

  async function login(username: string, password: string): Promise<UserInfo | null> {
    loading.value = true;
    error.value = null;

    try {
      const { loginApi } = await import('../api/auth');
      const res = await loginApi({ username, password });
      setSession(res.data);
      loading.value = false;
      return res.data.user;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '登录失败';
      loading.value = false;
      error.value = message;
      return null;
    }
  }

  async function logout(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const { releaseAllItems } = await import('../api/annotation');
      await releaseAllItems();
    } catch {
      // Releasing item locks should not block logout.
    }

    clearSession();
  }

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    role,
    login,
    logout,
    setUser,
    setSession,
    clearSession,
  };
});

export type AuthStore = ReturnType<typeof useAuthPiniaStore>;

interface UseAuthStore {
  (): AuthStore;
  <T>(selector: (store: AuthStore) => T): T;
  getState: () => AuthStore;
  setState: (patch: Partial<AuthState>) => void;
}

export const useAuthStore = ((selector?: (store: AuthStore) => unknown) => {
  const store = useAuthPiniaStore();
  return selector ? selector(store) : store;
}) as UseAuthStore;

useAuthStore.getState = () => useAuthPiniaStore();
useAuthStore.setState = (patch) => {
  useAuthPiniaStore().$patch(patch as never);
};

if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_EXPIRED_EVENT, () => {
    useAuthStore().clearSession('登录已过期，请重新登录');
  });
}
