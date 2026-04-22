import { NextRequest, NextResponse } from "next/server";
import { listUsersForAdmin } from "@/lib/db";
import { withApiErrorNotify } from "@/lib/with-api-error-notify";

const ADMIN_CORS_ORIGIN = process.env.ADMIN_CORS_ORIGIN?.trim() || "*";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ADMIN_CORS_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "X-Admin-Key, Content-Type",
  };
}

function requireAdmin(request: NextRequest): NextResponse | null {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Admin API not configured" },
      { status: 503, headers: corsHeaders() }
    );
  }
  const key = request.headers.get("x-admin-key") ?? request.nextUrl.searchParams.get("key") ?? "";
  if (key !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
  }
  return null;
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

async function getHandler(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth) return auth;

  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") ?? undefined;
    const sortBy = (searchParams.get("sortBy") as "createdAt" | "firstName" | "email") ?? undefined;
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") ?? undefined;

    const rows = await listUsersForAdmin({ search, sortBy, sortOrder });
    return NextResponse.json(rows, { headers: corsHeaders() });
  } catch (error) {
    console.error("Admin users list failed:", error);
    return NextResponse.json(
      { error: "Failed to list users" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export const GET = withApiErrorNotify(getHandler);
