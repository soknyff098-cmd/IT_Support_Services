import { NextRequest, NextResponse } from "next/server";
import {
  repoCreateUser,
  repoFindDuplicateUser,
  repoListUsers,
} from "@/db/repository";
import { getCurrentUser, sanitizeAvatarUrl, toSafeUser } from "@/lib/auth";
import { hashPassword, normalizeKhmerDigits } from "@/lib/password";

const AVATAR_PALETTE = [
  "#2563eb",
  "#0891b2",
  "#059669",
  "#7c3aed",
  "#d97706",
  "#dc2626",
];

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json(
        { ok: false, error: "សូមចូលគណនីជាមុនសិន" },
        { status: 401 }
      );
    }

    const all = await repoListUsers();
    const safeList = all.map(toSafeUser);

    if (currentUser.role === "user") {
      return NextResponse.json({
        ok: true,
        users: safeList.filter((u) => u.isActive),
      });
    }

    return NextResponse.json({ ok: true, users: safeList });
  } catch (err: unknown) {
    console.error("GET /api/users error:", err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `មិនអាចទាញយកបញ្ជីអ្នកប្រើប្រាស់បានទេ៖ ${detail}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json(
        {
          ok: false,
          error: "មានតែ Admin ប៉ុណ្ណោះដែលអាចបង្កើតគណនីបុគ្គលិកថ្មីបាន។",
        },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      fullName?: string;
      username?: string;
      email?: string;
      password?: string;
      role?: string;
      department?: string;
      avatarColor?: string;
      avatarUrl?: string | null;
    };

    const avatarCheck = sanitizeAvatarUrl(body.avatarUrl);
    if (!avatarCheck.valid) {
      return NextResponse.json(
        { ok: false, error: avatarCheck.error },
        { status: 400 }
      );
    }

    const fullName = (body.fullName ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const username = (body.username?.trim() || email.split("@")[0] || "")
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, "");
    const password = normalizeKhmerDigits((body.password ?? "").trim());
    const role =
      body.role === "admin" || body.role === "agent" ? body.role : "user";
    const department = (body.department ?? "").trim() || "ទូទៅ (General)";

    if (!fullName || !email || !email.includes("@") || username.length < 3) {
      return NextResponse.json(
        {
          ok: false,
          error: "សូមបំពេញឈ្មោះ អ៊ីមែល និង Username (យ៉ាងតិច ៣ តួអក្សរ)។",
        },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { ok: false, error: "ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៤ តួអក្សរ។" },
        { status: 400 }
      );
    }

    const dup = await repoFindDuplicateUser(email, username);
    if (dup) {
      return NextResponse.json(
        {
          ok: false,
          error: "អ៊ីមែល ឬ Username នេះមានរួចហើយនៅក្នុងប្រព័ន្ធ។",
        },
        { status: 409 }
      );
    }

    if (body.avatarColor !== undefined && (typeof body.avatarColor !== "string" || !/^#[0-9a-f]{6}$/i.test(body.avatarColor))) {
      return NextResponse.json({ ok: false, error: "ពណ៌តំណាងមិនត្រឹមត្រូវទេ។" }, { status: 400 });
    }
    const avatarColor = body.avatarColor ?? AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];

    const created = await repoCreateUser({
      username,
      email,
      passwordHash: hashPassword(password),
      fullName,
      role,
      department,
      avatarColor,
      avatarUrl: avatarCheck.value ?? null,
      isActive: true,
    });

    return NextResponse.json(
      { ok: true, user: toSafeUser(created) },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("POST /api/users error:", err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `មិនអាចបង្កើតគណនីបានទេ៖ ${detail}` },
      { status: 500 }
    );
  }
}
