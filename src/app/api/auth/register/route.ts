import { NextRequest, NextResponse } from "next/server";
import { repoCreateUser, repoFindDuplicateUser } from "@/db/repository";
import { hashPassword, normalizeKhmerDigits } from "@/lib/password";
import {
  attachAuthCookie,
  sanitizeAvatarUrl,
  signAuthToken,
  toSafeUser,
} from "@/lib/auth";

const AVATAR_PALETTE = [
  "#2563eb",
  "#0891b2",
  "#059669",
  "#7c3aed",
  "#d97706",
  "#dc2626",
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      fullName?: string;
      username?: string;
      email?: string;
      password?: string;
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
    const rawUsername = (
      body.username?.trim() || email.split("@")[0] || ""
    )
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, "");
    const password = normalizeKhmerDigits((body.password ?? "").trim());
    const department = (body.department ?? "").trim() || "ទូទៅ (General)";

    if (!fullName || !email || !email.includes("@")) {
      return NextResponse.json(
        {
          ok: false,
          error: "សូមបញ្ចូលឈ្មោះពេញ និងអ៊ីមែលឲ្យបានត្រឹមត្រូវ។",
        },
        { status: 400 }
      );
    }

    if (!rawUsername || rawUsername.length < 3) {
      return NextResponse.json(
        {
          ok: false,
          error: "ឈ្មោះគណនី (Username) ត្រូវមានយ៉ាងតិច ៣ តួអក្សរ (a-z, 0-9)។",
        },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        {
          ok: false,
          error: "ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៤ តួអក្សរ។",
        },
        { status: 400 }
      );
    }

    const existing = await repoFindDuplicateUser(email, rawUsername);
    if (existing) {
      const isEmailDup = existing.email.toLowerCase() === email;
      return NextResponse.json(
        {
          ok: false,
          error: isEmailDup
            ? "អ៊ីមែលនេះមានរួចហើយ សូមប្រើអ៊ីមែលផ្សេង ឬចូលប្រើប្រាស់ផ្ទាល់។"
            : "ឈ្មោះគណនី (Username) នេះមានអ្នកប្រើរួចហើយ។",
        },
        { status: 409 }
      );
    }

    if (body.avatarColor !== undefined && (typeof body.avatarColor !== "string" || !/^#[0-9a-f]{6}$/i.test(body.avatarColor))) {
      return NextResponse.json({ ok: false, error: "ពណ៌តំណាងមិនត្រឹមត្រូវទេ។" }, { status: 400 });
    }
    const avatarColor = body.avatarColor ?? AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];

    const inserted = await repoCreateUser({
      username: rawUsername,
      email,
      passwordHash: hashPassword(password),
      fullName,
      role: "user",
      department,
      avatarColor,
      avatarUrl: avatarCheck.value ?? null,
      isActive: true,
    });

    const createdUser = toSafeUser(inserted);
    const token = signAuthToken(createdUser.id, createdUser.role, inserted.passwordHash);

    const res = NextResponse.json(
      {
        ok: true,
        token,
        user: createdUser,
      },
      { status: 201 }
    );
    attachAuthCookie(res, req, token);
    return res;
  } catch (err: unknown) {
    console.error("Register error:", err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        error: `មិនអាចបង្កើតគណនីបានទេ៖ ${detail}`,
      },
      { status: 500 }
    );
  }
}
