import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/stores/auth';

export const AUTH_EXPIRED_EVENT = 'labelhub:auth-expired';

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface ApiError<T = unknown> extends Error {
  code?: number | undefined;
  status?: number | undefined;
  data?: T | undefined;
  originalError?: unknown;
}

export interface RequestConfig<D = unknown> extends AxiosRequestConfig<D> {
  skipAuth?: boolean;
  /** Max retry attempts for transient failures (default: 0) */
  retry?: number;
  /** Base delay in ms between retries (default: 1000, doubles each attempt) */
  retryDelay?: number;
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;
let redirectingToLogin = false;

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  unauthorizedHandler = handler;
}

export function resetUnauthorizedRedirect() {
  redirectingToLogin = false;
}

function createApiError<T = unknown>(
  message: string,
  options: Omit<ApiError<T>, 'name' | 'message'> = {},
): ApiError<T> {
  return Object.assign(new Error(message), options);
}

function isApiResponse<T = unknown>(value: unknown): value is ApiResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'data' in value
  );
}

function isSuccessCode(code: number) {
  return code >= 200 && code < 300;
}

function resolveToken(config: RequestConfig) {
  if (config.skipAuth) return null;
  const authStore = useAuthStore();
  return authStore.token;
}

function handleUnauthorized() {
  const authStore = useAuthStore();
  authStore.clearSession();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }

  if (redirectingToLogin) return;
  redirectingToLogin = true;

  if (unauthorizedHandler) {
    unauthorizedHandler();
    return;
  }

  if (typeof window !== 'undefined') {
    if (window.location.pathname === '/login') {
      return;
    }

    const current = `${window.location.pathname}${window.location.search}`;
    const redirect = encodeURIComponent(current);
    window.location.replace(`/login?redirect=${redirect}`);
  }
}

instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = resolveToken(config as RequestConfig);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// ─── Retry helper ──────────────────────────────────────────
function isRetryableError(error: AxiosError): boolean {
  // Network errors (no response)
  if (!error.response) return true;
  const status = error.response.status;
  // Retry on server errors and rate limiting
  return status >= 500 || status === 429;
}

function getRetryConfig(config: RequestConfig): { maxRetries: number; baseDelay: number } {
  return {
    maxRetries: config.retry ?? 0,
    baseDelay: config.retryDelay ?? 1000,
  };
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

instance.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const body = response.data;
    if (!isApiResponse(body)) {
      return body as unknown as AxiosResponse<ApiResponse>;
    }

    if (isSuccessCode(body.code)) {
      return body as unknown as AxiosResponse<ApiResponse>;
    }

    if (body.code === 401) {
      handleUnauthorized();
    }

    return Promise.reject(
      createApiError(body.message || 'Request failed', {
        code: body.code,
        status: response.status,
        data: body.data,
      }),
    );
  },
  async (error: AxiosError<ApiResponse>) => {
    const config = error.config as RequestConfig | undefined;
    const { maxRetries, baseDelay } = getRetryConfig(config ?? {});

    // Track retry count on the config object
    const retryCount =
      (config as Record<string, unknown> & { __retryCount?: number }).__retryCount ?? 0;

    if (retryCount < maxRetries && isRetryableError(error)) {
      (config as Record<string, unknown> & { __retryCount: number }).__retryCount = retryCount + 1;
      // Exponential backoff with jitter: baseDelay * 2^attempt * (0.5-1.0 random)
      const jitter = 0.5 + Math.random() * 0.5;
      const waitMs = baseDelay * Math.pow(2, retryCount) * jitter;
      await delay(waitMs);
      return instance.request(config!);
    }

    const status = error.response?.status;
    const body = error.response?.data;

    if (status === 401) {
      handleUnauthorized();
    }

    return Promise.reject(
      createApiError(body?.message || error.message || 'Network error', {
        code: body?.code ?? status,
        status,
        data: body?.data,
        originalError: error,
      }),
    );
  },
);

export async function get<T = unknown>(
  url: string,
  params?: Record<string, unknown>,
  config?: RequestConfig,
): Promise<ApiResponse<T>> {
  return instance.get<ApiResponse<T>, ApiResponse<T>>(url, { params, ...config });
}

export async function post<T = unknown>(
  url: string,
  data?: unknown,
  config?: RequestConfig,
): Promise<ApiResponse<T>> {
  return instance.post<ApiResponse<T>, ApiResponse<T>>(url, data, config);
}

export async function put<T = unknown>(
  url: string,
  data?: unknown,
  config?: RequestConfig,
): Promise<ApiResponse<T>> {
  return instance.put<ApiResponse<T>, ApiResponse<T>>(url, data, config);
}

export async function del<T = unknown>(
  url: string,
  params?: Record<string, unknown>,
  config?: RequestConfig,
): Promise<ApiResponse<T>> {
  return instance.delete<ApiResponse<T>, ApiResponse<T>>(url, { params, ...config });
}

export default instance;
