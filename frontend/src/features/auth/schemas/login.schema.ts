import type { LoginCredentials } from '../types/auth.types';

export interface LoginValidationErrors {
  username?: string;
  password?: string;
  general?: string;
}

export function validateLogin(
  input: LoginCredentials,
  t: (key: string) => string,
): LoginValidationErrors | null {
  const errors: LoginValidationErrors = {};

  if (!input.username.trim()) errors.username = t('errUsernameRequired');

  if (!input.password) errors.password = t('errPasswordRequired');

  return Object.keys(errors).length > 0 ? errors : null;
}
