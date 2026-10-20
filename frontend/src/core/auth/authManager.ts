import type { Role } from '../constants/roles';
import { setAccessToken } from '../api/apiClient';

export interface AuthSession {
  role: Role;
  userId: string;
  staffName: string;
  readOnly: boolean;
}

const sessionKey = 'al-amin-auth-session';

export function getAuthSession(): AuthSession | null {
  try {
    const value = window.localStorage.getItem(sessionKey);
    return value ? (JSON.parse(value) as AuthSession) : null;
  } catch {
    window.localStorage.removeItem(sessionKey);
    return null;
  }
}

export function setAuthSession(session: AuthSession): void {
  window.localStorage.setItem(sessionKey, JSON.stringify(session));
}

export function clearAuthSession(): void {
  window.localStorage.removeItem(sessionKey);
  setAccessToken(null);
}
