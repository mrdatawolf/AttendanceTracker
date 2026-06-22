/**
 * API Client Utilities
 *
 * Helper functions for making API calls with proper URL handling
 */

import { config } from './config';

/**
 * Constructs the full API URL based on configuration
 *
 * @param path - The API path (e.g., '/api/employees')
 * @returns The full URL to use for the API call
 *
 * Examples:
 * - If baseURL is empty: '/api/employees' -> '/api/employees' (relative path)
 * - If baseURL is 'http://192.168.1.100:6029': '/api/employees' -> 'http://192.168.1.100:6029/api/employees'
 */
export function getApiUrl(path: string): string {
  const baseURL = config.api.baseURL;

  // If no base URL configured, use relative path
  if (!baseURL || baseURL.trim() === '') {
    return path;
  }

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Remove trailing slash from baseURL if present
  const normalizedBaseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;

  return `${normalizedBaseURL}${normalizedPath}`;
}

/**
 * Performs a fetch request with the properly constructed API URL
 *
 * @param path - The API path (e.g., '/api/employees')
 * @param options - Fetch options (headers, method, body, etc.)
 * @returns Promise resolving to the Response object
 *
 * Usage:
 * ```typescript
 * const response = await apiFetch('/api/employees', {
 *   headers: { Authorization: `Bearer ${token}` }
 * });
 * const data = await response.json();
 * ```
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(path);
  return fetch(url, options);
}
