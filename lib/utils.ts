import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts BigInt values to Numbers in an object or array for JSON serialization
 * SQLite returns BigInt for INTEGER columns, which can't be JSON.stringify'd
 */
export function serializeBigInt<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'bigint') {
    return Number(data) as T;
  }

  if (Array.isArray(data)) {
    return data.map(item => serializeBigInt(item)) as T;
  }

  if (typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = serializeBigInt(value);
    }
    return result as T;
  }

  return data;
}
