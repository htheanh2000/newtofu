import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import {
  isDeviceRegisteredInDb,
  getDeviceFromDb,
  registerDeviceInDb,
  type DeviceRecord,
} from "./db";

export interface Device {
  deviceId: string;
  name?: string;
  userAgent?: string;
  registeredAt: string; // ISO
}

const DEVICE_ID_HEADER = "x-device-id";
const WHITELIST_ENV = "MARGIELA_DEVICE_WHITELIST_ENABLED";

let store: Map<string, Device> = new Map();
const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "devices.json");

function load(): void {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const arr = JSON.parse(raw) as Device[];
      store = new Map(arr.map((d) => [d.deviceId, d]));
    }
  } catch {
    store = new Map();
  }
}

function save(): void {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const arr = Array.from(store.values());
    fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), "utf-8");
  } catch {
    // Serverless or read-only fs: keep in-memory only
  }
}

let loaded = false;
function ensureLoaded(): void {
  if (!loaded) {
    loaded = true;
    load();
  }
}

function recordToDevice(r: DeviceRecord): Device {
  return {
    deviceId: r.deviceId,
    name: r.name ?? undefined,
    userAgent: r.userAgent ?? undefined,
    registeredAt: r.registeredAt,
  };
}

export function isWhitelistEnabled(): boolean {
  return (
    process.env[WHITELIST_ENV] === "true" ||
    process.env[WHITELIST_ENV] === "1"
  );
}

const useDb = (): boolean => !!process.env.DATABASE_URL?.trim();

export async function getDevice(deviceId: string): Promise<Device | null> {
  if (useDb()) {
    const row = await getDeviceFromDb(deviceId);
    return row ? recordToDevice(row) : null;
  }
  ensureLoaded();
  return store.get(deviceId) ?? null;
}

export async function isDeviceRegistered(deviceId: string): Promise<boolean> {
  if (useDb()) {
    return isDeviceRegisteredInDb(deviceId);
  }
  ensureLoaded();
  return store.has(deviceId);
}

/**
 * Register a device. If deviceId is provided and exists, return it.
 * Otherwise create a new device (generate id if needed) and return.
 * When DATABASE_URL is set, persists to DB; otherwise file + in-memory.
 */
export async function registerDevice(info: {
  deviceId?: string;
  name?: string;
  userAgent?: string;
}): Promise<Device> {
  if (useDb()) {
    const row = await registerDeviceInDb({
      deviceId: info.deviceId,
      name: info.name,
      userAgent: info.userAgent,
    });
    return recordToDevice(row);
  }
  ensureLoaded();
  const existing = info.deviceId ? store.get(info.deviceId) : null;
  if (existing) {
    return existing;
  }
  const deviceId = info.deviceId ?? randomUUID();
  const device: Device = {
    deviceId,
    name: info.name,
    userAgent: info.userAgent,
    registeredAt: new Date().toISOString(),
  };
  store.set(deviceId, device);
  save();
  return device;
}

export function listDevices(): Device[] {
  ensureLoaded();
  return Array.from(store.values());
}

export { DEVICE_ID_HEADER };
