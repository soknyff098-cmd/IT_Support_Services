import { NextRequest, NextResponse } from "next/server";
import { repoFindUserById } from "@/db/repository";
import { verifyPassword } from "@/lib/password";
import {
  attachAuthCookie,
  getCurrentUser,
  signAuthToken,
  toSafeUser,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const current = await getCurrentUser(req);
    if (!current) {
      return NextResponse.json(
        { ok: false, error: "សូមចូលគណនីជាមុនសិន" },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { userId?: number; password?: unknown };
    const targetId = Number(body.userId);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return NextResponse.json(
        { ok: false, error: "លេខសម្គាល់គណនីមិនត្រឹមត្រូវ" },
        { status: 400 }
      );
    }

    const targetUser = await repoFindUserById(targetId);
    if (!targetUser) {
      return NextResponse.json(
        { ok: false, error: "រកមិនឃើញគណនីនេះទេ" },
        { status: 404 }
      );
    }

    if (targetUser.isActive === false) {
      return NextResponse.json(
        { ok: false, error: "គណនីនេះត្រូវបានផ្អាកជាបណ្ដោះអាសន្ន" },
        { status: 403 }
      );
    }

    // Knowing a user ID must never be enough to assume that account (including Admin).
    if (typeof body.password !== "string" || !body.password.trim() || !verifyPassword(body.password, targetUser.passwordHash)) {
      return NextResponse.json(
        { ok: false, error: "ពាក្យសម្ងាត់សម្រាប់គណនីនេះមិនត្រឹមត្រូវទេ។" },
        { status: 401 }
      );
    }

    const safeUser = toSafeUser(targetUser);
    const token = signAuthToken(safeUser.id, safeUser.role, targetUser.passwordHash);

    const res = NextResponse.json({
      ok: true,
      token,
      user: safeUser,
    });
    attachAuthCookie(res, req, token);
    return res;
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `មិនអាចប្ដូរគណនីបានទេ៖ ${detail}` },
      { status: 500 }
    );
  }
}
