import { Prisma, PrismaClient } from "@prisma/client";
import type { Composition, UserInfo } from "./store";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/** Append connect_timeout=60 to DATABASE_URL for Neon cold-start tolerance (wake can take 17–58s). */
function dbUrlWithTimeout(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) return url;
  const sep = url.includes("?") ? "&" : "?";
  return url.includes("connect_timeout=") ? url : `${url}${sep}connect_timeout=60`;
}

/** Retry on P1001 (Can't reach database server) – Neon cold-start can take 17–58s. */
export async function withRetryOnP1001<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const isP1001 =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P1001";
      if (isP1001 && attempt < maxRetries) {
        const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Unreachable");
}

/** Current moment as Hong Kong time (for consistent createdAt in DB). */
function nowInHK(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const y = get("year");
  const m = get("month").padStart(2, "0");
  const d = get("day").padStart(2, "0");
  const h = get("hour").padStart(2, "0");
  const min = get("minute").padStart(2, "0");
  const s = get("second").padStart(2, "0");
  return new Date(`${y}-${m}-${d}T${h}:${min}:${s}+08:00`);
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(process.env.DATABASE_URL?.trim() && {
      datasources: { db: { url: dbUrlWithTimeout() } },
    }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type CompositionRecord = {
  id: string;
  instrument: string;
  notes: string;
  duration: number;
  createdAt: string;
};

/**
 * Save composition + user to Neon (Prisma). Does not throw on missing DATABASE_URL.
 */
export async function saveSessionToDb(
  composition: Composition,
  userInfo: UserInfo
): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) return;

  const createdAt = nowInHK();

  try {
    await withRetryOnP1001(() =>
      prisma.composition.create({
        data: {
          id: composition.id,
          instrument: composition.instrument,
          notes: JSON.stringify(composition.notes),
          duration: composition.duration,
          createdAt,
          user: {
            create: {
              firstName: userInfo.firstName,
              lastName: userInfo.lastName,
              gender: userInfo.gender,
              dateOfBirth: userInfo.dateOfBirth,
              country: userInfo.country,
              state: userInfo.state || null,
              city: userInfo.city,
              postcode: userInfo.postcode,
              phone: userInfo.phone,
              email: userInfo.email,
              createdAt,
            },
          },
        },
      })
    );
  } catch (e) {
    const isDuplicate =
      e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
    if (!isDuplicate) throw e;
  }
}

/**
 * Get composition by ID from Neon. Returns null if not found or DATABASE_URL not set.
 */
export async function getCompositionFromDb(
  compositionId: string
): Promise<CompositionRecord | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;

  const row = await withRetryOnP1001(() =>
    prisma.composition.findUnique({
      where: { id: compositionId },
    select: {
      id: true,
      instrument: true,
      notes: true,
      duration: true,
      createdAt: true,
    },
  })
  );

  if (!row) return null;

  return {
    id: row.id,
    instrument: row.instrument,
    notes: row.notes,
    duration: row.duration,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Get stored PDF URL for a composition (for device-gated view page). Returns null if not in DB or pdfUrl not set.
 */
export async function getPdfUrlFromDb(compositionId: string): Promise<string | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;
  const row = await withRetryOnP1001(() =>
    prisma.composition.findUnique({
      where: { id: compositionId },
      select: { pdfUrl: true },
    })
  );
  return row?.pdfUrl ?? null;
}

export type DeviceRecord = {
  deviceId: string;
  name?: string | null;
  userAgent?: string | null;
  registeredAt: string;
};

/**
 * Check if device is registered (whitelist). Used for scan/PDF auth.
 */
export async function isDeviceRegisteredInDb(deviceId: string): Promise<boolean> {
  if (!process.env.DATABASE_URL?.trim()) return false;
  const row = await withRetryOnP1001(() =>
    prisma.device.findUnique({
    where: { deviceId },
    select: { deviceId: true },
  })
  );
  return row != null;
}

/**
 * Get device by ID from DB.
 */
export async function getDeviceFromDb(
  deviceId: string
): Promise<DeviceRecord | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;
  const row = await withRetryOnP1001(() =>
    prisma.device.findUnique({
    where: { deviceId },
  })
  );
  if (!row) return null;
  return {
    deviceId: row.deviceId,
    name: row.name,
    userAgent: row.userAgent,
    registeredAt: row.registeredAt.toISOString(),
  };
}

/**
 * Register a device (whitelist). Creates or returns existing.
 */
export async function registerDeviceInDb(info: {
  deviceId?: string;
  name?: string;
  userAgent?: string;
}): Promise<DeviceRecord> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set");
  }
  const deviceId = info.deviceId ?? crypto.randomUUID();
  const existing = await withRetryOnP1001(() =>
    prisma.device.findUnique({
    where: { deviceId },
  })
  );
  if (existing) {
    return {
      deviceId: existing.deviceId,
      name: existing.name,
      userAgent: existing.userAgent,
      registeredAt: existing.registeredAt.toISOString(),
    };
  }
  const row = await withRetryOnP1001(() =>
    prisma.device.create({
    data: {
      deviceId,
      name: info.name ?? null,
      userAgent: info.userAgent ?? null,
    },
  })
  );
  return {
    deviceId: row.deviceId,
    name: row.name,
    userAgent: row.userAgent,
    registeredAt: row.registeredAt.toISOString(),
  };
}

// --- Admin: list users and compositions ---

export type AdminUserRow = {
  id: string;
  compositionId: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  country: string;
  state: string | null;
  city: string;
  postcode: string;
  phone: string;
  email: string;
  createdAt: string;
  composition?: {
    instrument: string;
    duration: number;
    createdAt: string;
  };
};

export type AdminCompositionRow = {
  id: string;
  instrument: string;
  notes: string;
  duration: number;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    country: string;
    createdAt: string;
  } | null;
};

export async function listUsersForAdmin(opts?: {
  search?: string;
  sortBy?: "createdAt" | "firstName" | "email";
  sortOrder?: "asc" | "desc";
}): Promise<AdminUserRow[]> {
  if (!process.env.DATABASE_URL?.trim()) return [];

  const orderBy =
    opts?.sortBy === "firstName"
      ? { firstName: opts.sortOrder ?? "asc" }
      : opts?.sortBy === "email"
        ? { email: opts.sortOrder ?? "asc" }
        : { createdAt: (opts?.sortOrder ?? "desc") as "asc" | "desc" };

  const where = opts?.search?.trim()
    ? {
        OR: [
          { firstName: { contains: opts.search, mode: "insensitive" as const } },
          { lastName: { contains: opts.search, mode: "insensitive" as const } },
          { email: { contains: opts.search, mode: "insensitive" as const } },
          { compositionId: { contains: opts.search, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const rows = await withRetryOnP1001(() =>
    prisma.user.findMany({
    where,
    orderBy,
    include: { composition: { select: { instrument: true, duration: true, createdAt: true } } },
  })
  );

  return rows.map((r: (typeof rows)[number]) => ({
    id: r.id,
    compositionId: r.compositionId,
    firstName: r.firstName,
    lastName: r.lastName,
    gender: r.gender,
    dateOfBirth: r.dateOfBirth,
    country: r.country,
    state: r.state,
    city: r.city,
    postcode: r.postcode,
    phone: r.phone,
    email: r.email,
    createdAt: r.createdAt.toISOString(),
    composition: r.composition
      ? {
          instrument: r.composition.instrument,
          duration: r.composition.duration,
          createdAt: r.composition.createdAt.toISOString(),
        }
      : undefined,
  }));
}

export async function listCompositionsForAdmin(opts?: {
  search?: string;
  sortBy?: "createdAt" | "instrument" | "duration";
  sortOrder?: "asc" | "desc";
}): Promise<AdminCompositionRow[]> {
  if (!process.env.DATABASE_URL?.trim()) return [];

  const orderBy =
    opts?.sortBy === "instrument"
      ? { instrument: opts.sortOrder ?? "asc" }
      : opts?.sortBy === "duration"
        ? { duration: opts.sortOrder ?? "asc" }
        : { createdAt: (opts?.sortOrder ?? "desc") as "asc" | "desc" };

  const where = opts?.search?.trim()
    ? {
        OR: [
          { id: { contains: opts.search, mode: "insensitive" as const } },
          { instrument: { contains: opts.search, mode: "insensitive" as const } },
          { user: { email: { contains: opts.search, mode: "insensitive" as const } } },
          { user: { firstName: { contains: opts.search, mode: "insensitive" as const } } },
          { user: { lastName: { contains: opts.search, mode: "insensitive" as const } } },
        ],
      }
    : undefined;

  const rows = await withRetryOnP1001(() =>
    prisma.composition.findMany({
    where,
    orderBy,
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          country: true,
          createdAt: true,
        },
      },
    },
  })
  );

  return rows.map((r: (typeof rows)[number]) => ({
    id: r.id,
    instrument: r.instrument,
    notes: r.notes,
    duration: r.duration,
    createdAt: r.createdAt.toISOString(),
    user: r.user
      ? {
          firstName: r.user.firstName,
          lastName: r.user.lastName,
          email: r.user.email,
          country: r.user.country,
          createdAt: r.user.createdAt.toISOString(),
        }
      : null,
  }));
}
