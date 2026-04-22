import { NextRequest, NextResponse } from "next/server";
import { saveSessionToDb } from "@/lib/db";
import { withApiErrorNotify } from "@/lib/with-api-error-notify";
import type { Composition, UserInfo } from "@/lib/store";

async function postHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const { composition, userInfo } = body as {
      composition: Composition;
      userInfo: UserInfo;
    };

    if (!composition || !userInfo) {
      return NextResponse.json(
        { error: "Missing composition or user info" },
        { status: 400 }
      );
    }

    try {
      await saveSessionToDb(composition, userInfo);
    } catch (dbError) {
      console.error("Failed to save to Neon DB:", dbError);
      return NextResponse.json(
        { error: "Failed to save to database" },
        { status: 500 }
      );
    }

    const savedToDb = !!process.env.DATABASE_URL?.trim();
    return NextResponse.json({ success: true, savedToDb });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Submit failed:", message, error);
    return NextResponse.json(
      { error: "Failed to save to database" },
      { status: 500 }
    );
  }
}

export const POST = withApiErrorNotify(postHandler);
