export const storage = {
  get<T>(key: string, fallback: T): T {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  },
  set<T>(key: string, value: T): void {
    window.localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key: string): void {
    window.localStorage.removeItem(key);
  },
};
