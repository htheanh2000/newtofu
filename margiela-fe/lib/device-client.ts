"use client";

export const DEVICE_STORAGE_KEY = "margiela_device_id";

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Safari Private Browsing or storage quota exceeded
  }
}

/**
 * Returns device token for X-Device-ID header.
 * If not in localStorage, calls /api/device/register to create a new token (saved in DB whitelist) and stores it.
 */
export async function getDeviceIdForRequest(): Promise<string> {
  if (typeof window === "undefined") return "";
  const stored = safeGetItem(DEVICE_STORAGE_KEY);
  if (stored) return stored;

  try {
    const res = await fetch("/api/device/register");
    if (!res.ok) return "";
    const data = await res.json();
    const deviceId = data?.deviceId != null ? String(data.deviceId) : "";
    if (deviceId) safeSetItem(DEVICE_STORAGE_KEY, deviceId);
    return deviceId;
  } catch {
    return "";
  }
}

/**
 * Headers to append to fetch when calling APIs that require device (e.g. view-sheet).
 * Only sends X-Device-ID if already registered (does NOT auto-register).
 */
export function getDeviceHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const deviceId = safeGetItem(DEVICE_STORAGE_KEY);
  return deviceId ? { "X-Device-ID": deviceId } : {};
}
