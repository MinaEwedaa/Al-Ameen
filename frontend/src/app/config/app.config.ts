export const appConfig = {
  name: 'Al-Amin Hotel Management',
  version: '0.1.0',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
} as const;