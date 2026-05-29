/**
 * 统一请求工具 — 基于 axios 封装
 *
 * - 自动携带 token（localStorage）
 * - 统一处理后端响应格式 { code, message, data }
 * - 401 自动跳转登录
 * - 提供 loading / error 语义
 */
import axios, {
  type AxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from 'axios';

export const AUTH_EXPIRED_EVENT = 'labelhub:auth-expired';

/* ─── 后端统一响应体 ──────────────────────────────── */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/* ─── 创建 axios 实例 ──────────────────────────────── */
const instance = axios.create({
  baseURL: '/api',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

function expireLocalSession(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

/* ─── 请求拦截器：注入 token ──────────────────────── */
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ─── 响应拦截器：统一错误处理 ────────────────────── */
instance.interceptors.response.use(
  (res: AxiosResponse<ApiResponse>) => {
    const body = res.data;
    // 业务层成功 (code 2xx)
    if (body.code >= 200 && body.code < 300) {
      return body as any; // 让调用方直接拿到 { code, message, data }
    }
    // 业务层失败
    const err = new Error(body.message || '请求失败') as any;
    err.code = body.code;
    err.data = body.data;
    return Promise.reject(err);
  },
  (error: AxiosError<ApiResponse>) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        expireLocalSession();
        // 避免重复跳转
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      const msg = data?.message || `请求错误 (${status})`;
      const err = new Error(msg) as any;
      err.code = status;
      err.data = data?.data;
      return Promise.reject(err);
    }
    // 网络错误 / 超时
    return Promise.reject(new Error(error.message || '网络异常，请稍后重试'));
  },
);

/* ─── 对外暴露的便捷方法 ──────────────────────────── */

/**
 * GET 请求
 */
export async function get<T = unknown>(
  url: string,
  params?: Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  return instance.get(url, { params, ...config });
}

/**
 * POST 请求
 */
export async function post<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  return instance.post(url, data, config);
}

/**
 * PUT 请求
 */
export async function put<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  return instance.put(url, data, config);
}

/**
 * DELETE 请求
 */
export async function del<T = unknown>(
  url: string,
  params?: Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  return instance.delete(url, { params, ...config });
}

export default instance;
