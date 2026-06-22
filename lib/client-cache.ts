const CACHE_PREFIX = 'attendance-tracker-cache:';
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
};

export function getCachedData<T>(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): T | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry || Date.now() - entry.timestamp > maxAgeMs) {
      storage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }

    return entry.data;
  } catch {
    storage.removeItem(`${CACHE_PREFIX}${key}`);
    return null;
  }
}

export function setCachedData<T>(key: string, data: T) {
  const storage = getStorage();
  if (!storage) return;

  const entry: CacheEntry<T> = {
    timestamp: Date.now(),
    data,
  };
  storage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
}

export function clearCachedDataByPrefix(prefix: string) {
  const storage = getStorage();
  if (!storage) return;

  const fullPrefix = `${CACHE_PREFIX}${prefix}`;
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index);
    if (key?.startsWith(fullPrefix)) {
      storage.removeItem(key);
    }
  }
}
