import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, authenticated: false, user: null },
        { status: 401 }
      );
    }
    return NextResponse.json({
      ok: true,
      authenticated: true,
      user,
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, authenticated: false, error: detail },
      { status: 500 }
    );
  }
}
