import { request } from '../../../core/api/apiClient';
import type { AuthResponse, LoginCredentials } from '../types/auth.types';

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: credentials,
  });
}

export async function logoutRequest(): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST' });
}