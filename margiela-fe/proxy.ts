import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const ADMIN_CORS_ORIGIN = process.env.ADMIN_CORS_ORIGIN?.trim() || "*";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ADMIN_CORS_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    "Access-Control-Max-Age": "86400",
  };
}

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (request.method === "OPTIONS" && pathname.startsWith("/api/admin/")) {
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/api/admin/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
