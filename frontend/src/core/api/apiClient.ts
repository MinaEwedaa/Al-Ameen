import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { appConfig } from '../../app/config/app.config';
import { ApiError } from './apiError';
import type { ApiErrorBody } from './api.types';

// ---------- التوكن: في الذاكرة بس (مش localStorage) ----------
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ---------- الـ axios instance الوحيد في المشروع ----------
const http = axios.create({
  baseURL: appConfig.apiBaseUrl,
  withCredentials: true, // عشان الـ refresh cookie
});

http.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ---------- تحويل أي خطأ لـ ApiError ----------
function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    const err = error as AxiosError<ApiErrorBody>;
    if (!err.response) {
      return new ApiError('Network error', 'NETWORK_ERROR');
    }
    const body = err.response.data;
    const retryAfter = Number(err.response.headers['retry-after']);
    return new ApiError(
      body?.error?.message ?? 'Request failed',
      body?.error?.code ?? 'UNKNOWN_ERROR',
      err.response.status,
      Number.isFinite(retryAfter) ? retryAfter : undefined,
    );
  }

  return new ApiError('Unknown error', 'UNKNOWN_ERROR');
}

// ---------- الـ refresh (طلب واحد بس حتى لو فيه طلبات كتير فشلت) ----------
let refreshPromise: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ access_token: string }>(
        `${appConfig.apiBaseUrl}/auth/refresh`,
        null,
        { withCredentials: true },
      )
      .then((res) => {
        setAccessToken(res.data.access_token);
        return res.data.access_token;
      })
      .catch((e) => {
        setAccessToken(null);
        throw toApiError(e);
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// لما الطلب blob والباك اند يرجّع خطأ، الـ body بيجي Blob، فنحوّله لـ JSON عشان نقرا الـ code
async function normalizeBlobError(error: unknown): Promise<unknown> {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const text = await error.response.data.text();
      error.response.data = JSON.parse(text);
    } catch {
      // سيبيه زي ما هو
    }
  }
  return error;
}

// ---------- الطلب الأساسي ----------
type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  params?: Record<string, unknown>;
  idempotencyKey?: string;
  responseType?: 'json' | 'blob';
};

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const config: AxiosRequestConfig = {
    url: path,
    method: options.method ?? 'GET',
    data: options.body,
    params: options.params,
    responseType: options.responseType ?? 'json',
    headers: options.idempotencyKey
      ? { 'Idempotency-Key': options.idempotencyKey }
      : undefined,
  };

  const isAuthPath = path.startsWith('/auth/');

  try {
    const res = await http.request<T>(config);
    return res.data;
  } catch (error) {
    const apiError = toApiError(await normalizeBlobError(error));

    // 401 على طلب عادي: جرّبي refresh مرة واحدة وأعيدي الطلب
    if (apiError.statusCode === 401 && !isAuthPath) {
      try {
        await refreshAccessToken();
        const retry = await http.request<T>(config);
        return retry.data;
      } catch (retryError) {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('al-amin-auth-session');
          if (!window.location.pathname.startsWith('/login')) {
            window.location.href = '/login';
          }
        }
        throw toApiError(await normalizeBlobError(retryError));
      }
    }

    throw apiError;
  }
}

// ---------- للتوافق مع كود Member 1 (auth.api.ts) ----------
export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  let parsedBody: unknown = undefined;
  if (options.body !== undefined && options.body !== null) {
    if (typeof options.body === 'string') {
      try {
        parsedBody = JSON.parse(options.body);
      } catch {
        parsedBody = options.body;
      }
    } else {
      parsedBody = options.body;
    }
  }

  return request<T>(path, {
    method: (options.method as RequestOptions['method']) ?? 'GET',
    body: parsedBody,
  });
}