import { NextResponse } from "next/server";
import { isWhitelistEnabled, isDeviceRegistered, DEVICE_ID_HEADER } from "./devices";

/**
 * Skip device check when:
 * 1) Referer is our scan page (any /scan/ URL – user viewing or Lambda printing), or
 * 2) User-Agent is headless (Lambda’s Puppeteer may not send Referer).
 */
function isFromScanPageOrPdfService(headers: Headers): boolean {
  const referer = headers.get("referer") ?? headers.get("Referer") ?? "";
  if (referer.includes("/scan/")) return true;
  const ua = headers.get("user-agent") ?? headers.get("User-Agent") ?? "";
  return /HeadlessChrome|Puppeteer|Chrome\/.*Headless/i.test(ua);
}

/**
 * If device whitelist is enabled, checks request for X-Device-ID and verifies
 * the device is registered (DB or file). Returns null if allowed, or a 403 NextResponse if not.
 * Bypasses check when request is from scan page (Referer contains /scan/) or headless (Lambda).
 */
export async function checkDeviceAllowed(
  headers: Headers
): Promise<NextResponse | null> {
  if (!isWhitelistEnabled()) {
    return null;
  }
  if (isFromScanPageOrPdfService(headers)) {
    return null;
  }
  const deviceId = headers.get(DEVICE_ID_HEADER)?.trim();
  if (!deviceId) {
    return NextResponse.json(
      { error: "Device not registered or not allowed to scan" },
      { status: 403 }
    );
  }
  const registered = await isDeviceRegistered(deviceId);
  if (!registered) {
    return NextResponse.json(
      { error: "Device not registered or not allowed to scan" },
      { status: 403 }
    );
  }
  return null;
}
