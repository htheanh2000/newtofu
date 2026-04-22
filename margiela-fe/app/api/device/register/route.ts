import { NextRequest, NextResponse } from "next/server";
import { registerDevice } from "@/lib/devices";
import { withApiErrorNotify } from "@/lib/with-api-error-notify";

/**
 * GET /api/device/register
 * Creates a new device token (UUID), saves to DB whitelist, returns { deviceId, ... }.
 * Optional ?name= for label. Client stores deviceId (e.g. localStorage) and sends as X-Device-ID.
 */
async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name")?.trim() || undefined;
    const userAgent = request.headers.get("user-agent") ?? undefined;

    const device = await registerDevice({
      name,
      userAgent,
    });

    return NextResponse.json(device);
  } catch (error) {
    console.error("Device register error:", error);
    return NextResponse.json(
      { error: "Failed to register device" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/device/register
 * Register a device. If deviceId is provided and already registered, returns that device.
 * Otherwise creates a new device (generates deviceId if not provided).
 * Body: { deviceId?: string, name?: string, userAgent?: string }
 */
async function postHandler(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() || undefined : undefined;
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const userAgent = typeof request.headers.get("user-agent") === "string" ? request.headers.get("user-agent")! : undefined;

    const device = await registerDevice({
      deviceId,
      name: name ?? undefined,
      userAgent,
    });

    return NextResponse.json(device);
  } catch (error) {
    console.error("Device register error:", error);
    return NextResponse.json(
      { error: "Failed to register device" },
      { status: 500 }
    );
  }
}

export const GET = withApiErrorNotify(getHandler);
export const POST = withApiErrorNotify(postHandler);
