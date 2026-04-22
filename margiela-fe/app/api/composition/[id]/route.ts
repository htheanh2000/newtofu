import { NextRequest, NextResponse } from "next/server";
import { getCompositionFromDb } from "@/lib/db";
import { withApiErrorNotify } from "@/lib/with-api-error-notify";

async function getHandler(
  request: NextRequest,
  context?: { params?: Promise<{ id: string }> }
) {
  try {
    const { id } = await (context?.params ?? Promise.resolve({ id: "" }));

    if (!id) {
      return NextResponse.json(
        { error: "Missing composition ID" },
        { status: 400 }
      );
    }

    const composition = await getCompositionFromDb(id);

    if (!composition) {
      return NextResponse.json(
        { error: "Composition not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(composition);
  } catch (error) {
    console.error("Failed to get composition:", error);
    return NextResponse.json(
      { error: "Failed to retrieve composition" },
      { status: 500 }
    );
  }
}

export const GET = withApiErrorNotify(getHandler);
