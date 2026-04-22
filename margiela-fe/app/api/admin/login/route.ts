import { NextRequest, NextResponse } from "next/server";
import { withApiErrorNotify } from "@/lib/with-api-error-notify";

const ADMIN_CORS_ORIGIN = process.env.ADMIN_CORS_ORIGIN?.trim() || "*";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ADMIN_CORS_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

async function postHandler(request: NextRequest) {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const secret = process.env.ADMIN_SECRET?.trim();

  if (!username || !password || !secret) {
    return NextResponse.json(
      { error: "Admin login not configured" },
      { status: 503, headers: corsHeaders() }
    );
  }

  try {
    const body = await request.json();
    const { username: u, password: p } = (body ?? {}) as { username?: string; password?: string };

    if (u === username && p === password) {
      return NextResponse.json({ token: secret }, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: "Invalid username or password" }, { status: 401, headers: corsHeaders() });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400, headers: corsHeaders() });
  }
}

export const POST = withApiErrorNotify(postHandler);
