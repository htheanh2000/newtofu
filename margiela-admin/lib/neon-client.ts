"use client";

import { createClient } from "@neondatabase/neon-js";

let client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (typeof window === "undefined") {
    throw new Error("Neon client can only be used in the browser");
  }
  const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL?.trim();
  const dataApiUrl = process.env.NEXT_PUBLIC_NEON_DATA_API_URL?.trim();
  if (!authUrl || !dataApiUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_NEON_AUTH_URL or NEXT_PUBLIC_NEON_DATA_API_URL"
    );
  }
  if (!client) {
    client = createClient({
      auth: { url: authUrl },
      dataApi: { url: dataApiUrl },
    });
  }
  return client;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await getClient().auth.signIn.email({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOut() {
  const { error } = await getClient().auth.signOut();
  if (error) throw new Error(error.message);
}

/** Returns true if the error indicates JWT expired or auth failure (should logout). */
export function isAuthError(error: unknown): boolean {
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  return (
    msg.includes("jwt") && msg.includes("expired") ||
    msg.includes("unauthorized") ||
    msg.includes("token") && msg.includes("expired") ||
    msg.includes("session") && msg.includes("expired")
  );
}

export async function getSession() {
  const { data } = await getClient().auth.getSession();
  return data?.session ?? null;
}

// Prisma tables: User, Composition (default names; PostgREST may expose as lowercase)
const USER_TABLE = "User";
const COMPOSITION_TABLE = "Composition";

export type AdminUser = {
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
    notes: string;
    createdAt: string;
  };
};

export type AdminComposition = {
  id: string;
  instrument: string;
  notes: string;
  duration: number;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    gender: string;
    dateOfBirth: string;
    country: string;
    state: string | null;
    city: string;
    postcode: string;
    phone: string;
    createdAt: string;
  } | null;
};

function toAdminUser(row: Record<string, unknown>): AdminUser {
  let c = (row.composition ?? row.Composition) as Record<string, unknown> | Record<string, unknown>[] | undefined;
  if (Array.isArray(c) && c.length > 0 && c[0] && typeof c[0] === "object") c = c[0] as Record<string, unknown>;
  const getStr = (o: Record<string, unknown>, ...keys: string[]) => {
    for (const k of keys) if (o[k] != null) return String(o[k]);
    return "";
  };
  return {
    id: String(row.id),
    compositionId: String(row.compositionId ?? row.composition_id ?? ""),
    firstName: getStr(row as Record<string, unknown>, "firstName", "first_name"),
    lastName: getStr(row as Record<string, unknown>, "lastName", "last_name"),
    gender: getStr(row as Record<string, unknown>, "gender"),
    dateOfBirth: getStr(row as Record<string, unknown>, "dateOfBirth", "date_of_birth"),
    country: getStr(row as Record<string, unknown>, "country"),
    state: row.state != null ? String(row.state) : null,
    city: getStr(row as Record<string, unknown>, "city"),
    postcode: getStr(row as Record<string, unknown>, "postcode"),
    phone: getStr(row as Record<string, unknown>, "phone"),
    email: getStr(row as Record<string, unknown>, "email"),
    createdAt: String(row.createdAt ?? row.created_at ?? ""),
    ...(c && typeof c === "object" && !Array.isArray(c) && {
      composition: {
        instrument: getStr(c, "instrument"),
        duration: Number(c.duration ?? 0),
        notes: getStr(c, "notes"),
        createdAt: String(c.createdAt ?? c.created_at ?? ""),
      },
    }),
  };
}

function toAdminComposition(row: Record<string, unknown>): AdminComposition {
  let u = (row.user ?? row.User) as Record<string, unknown> | Record<string, unknown>[] | undefined;
  if (Array.isArray(u) && u.length > 0 && u[0] && typeof u[0] === "object") u = u[0] as Record<string, unknown>;
  const getStr = (o: Record<string, unknown>, ...keys: string[]) => {
    for (const k of keys) if (o[k] != null) return String(o[k]);
    return "";
  };
  return {
    id: String(row.id),
    instrument: String(row.instrument ?? ""),
    notes: String(row.notes ?? ""),
    duration: Number(row.duration ?? 0),
    createdAt: String(row.createdAt ?? row.created_at ?? ""),
    ...(u && typeof u === "object" && !Array.isArray(u) && {
      user: {
        firstName: getStr(u, "firstName", "first_name"),
        lastName: getStr(u, "lastName", "last_name"),
        email: getStr(u, "email"),
        gender: getStr(u, "gender"),
        dateOfBirth: getStr(u, "dateOfBirth", "date_of_birth"),
        country: getStr(u, "country"),
        state: u.state != null ? String(u.state) : null,
        city: getStr(u, "city"),
        postcode: getStr(u, "postcode"),
        phone: getStr(u, "phone"),
        createdAt: String(u.createdAt ?? u.created_at ?? ""),
      },
    }),
  };
}

export async function fetchUsers(opts?: {
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<AdminUser[]> {
  const c = getClient();
  let q = c
    .from(USER_TABLE)
    .select("*, composition:Composition(instrument, duration, notes, createdAt)");
  const orderKey = opts?.sortBy ?? "createdAt";
  const ascending = (opts?.sortOrder ?? "desc") === "asc";
  q = q.order(orderKey, { ascending });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let list = (data ?? []).map(toAdminUser);
  const term = opts?.search?.trim();
  if (term) {
    const lower = term.toLowerCase();
    list = list.filter((row: AdminUser) =>
      row.firstName.toLowerCase().includes(lower) ||
      row.lastName.toLowerCase().includes(lower) ||
      row.email.toLowerCase().includes(lower) ||
      (row.phone && row.phone.includes(term)) ||
      row.compositionId.toLowerCase().includes(lower) ||
      (row.composition?.instrument && row.composition.instrument.toLowerCase().includes(lower))
    );
  }
  return list;
}

function userRecordToAdminUserUser(u: Record<string, unknown>): AdminComposition["user"] {
  const getStr = (o: Record<string, unknown>, ...keys: string[]) => {
    for (const k of keys) if (o[k] != null) return String(o[k]);
    return "";
  };
  return {
    firstName: getStr(u, "firstName", "first_name"),
    lastName: getStr(u, "lastName", "last_name"),
    email: getStr(u, "email"),
    gender: getStr(u, "gender"),
    dateOfBirth: getStr(u, "dateOfBirth", "date_of_birth"),
    country: getStr(u, "country"),
    state: u.state != null ? String(u.state) : null,
    city: getStr(u, "city"),
    postcode: getStr(u, "postcode"),
    phone: getStr(u, "phone"),
    createdAt: String(u.createdAt ?? u.created_at ?? ""),
  };
}

export async function fetchCompositions(opts?: {
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<AdminComposition[]> {
  const c = getClient();
  let q = c.from(COMPOSITION_TABLE).select("*");
  const orderKey = opts?.sortBy ?? "createdAt";
  const ascending = (opts?.sortOrder ?? "desc") === "asc";
  q = q.order(orderKey, { ascending });
  const { data: compData, error: compError } = await q;
  if (compError) throw new Error(compError.message);
  const compositions = (compData ?? []).map(toAdminComposition);

  const ids = compositions.map((row: AdminComposition) => row.id).filter(Boolean);
  if (ids.length === 0) return compositions;

  const { data: userData, error: userError } = await c
    .from(USER_TABLE)
    .select("compositionId, firstName, lastName, email, gender, dateOfBirth, country, state, city, postcode, phone, createdAt");
  if (userError) throw new Error(userError.message);

  const userByCompId = new Map<string, Record<string, unknown>>();
  for (const u of userData ?? []) {
    const r = u as Record<string, unknown>;
    const compId = String(r.compositionId ?? (r as Record<string, unknown>).composition_id ?? "");
    if (compId) userByCompId.set(compId, r);
  }

  const list = compositions.map((row: AdminComposition) => {
    const u = userByCompId.get(row.id);
    return {
      ...row,
      user: u ? userRecordToAdminUserUser(u) : null,
    };
  });

  const term = opts?.search?.trim();
  if (term) {
    const lower = term.toLowerCase();
    return list.filter((row: AdminComposition) =>
      row.instrument.toLowerCase().includes(lower) ||
      (row.user &&
        (row.user.email.toLowerCase().includes(lower) ||
          row.user.firstName.toLowerCase().includes(lower) ||
          row.user.lastName.toLowerCase().includes(lower)))
    );
  }
  return list;
}
