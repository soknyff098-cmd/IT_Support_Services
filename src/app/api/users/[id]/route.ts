import { NextRequest, NextResponse } from "next/server";
import {
  repoDeleteUser,
  repoFindDuplicateUser,
  repoFindUserById,
  repoUpdateUser,
} from "@/db/repository";
import { attachAuthCookie, getCurrentUser, sanitizeAvatarUrl, signAuthToken, toSafeUser } from "@/lib/auth";
import { hashPassword, normalizeKhmerDigits } from "@/lib/password";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return NextResponse.json(
      { ok: false, error: "សូមចូលគណនីជាមុនសិន" },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId)) {
    return NextResponse.json(
      { ok: false, error: "ID មិនត្រឹមត្រូវ" },
      { status: 400 }
    );
  }

  const isAdmin = currentUser.role === "admin";
  const isSelf = currentUser.id === targetId;

  if (!isAdmin && !isSelf) {
    return NextResponse.json(
      { ok: false, error: "មិនមានសិទ្ធិកែប្រែគណនីនេះទេ" },
      { status: 403 }
    );
  }

  const existingUser = await repoFindUserById(targetId);
  if (!existingUser) {
    return NextResponse.json(
      { ok: false, error: "រកមិនឃើញគណនីនេះទេ" },
      { status: 404 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    fullName?: string;
    username?: string;
    email?: string;
    department?: string;
    avatarColor?: string;
    avatarUrl?: string | null;
    role?: string;
    isActive?: boolean;
    newPassword?: string;
  };

  const updates: Partial<{
    username: string;
    email: string;
    fullName: string;
    department: string;
    avatarColor: string;
    avatarUrl: string | null;
    role: string;
    isActive: boolean;
    passwordHash: string;
  }> = {};

  if (body.avatarUrl !== undefined) {
    const avatarCheck = sanitizeAvatarUrl(body.avatarUrl);
    if (!avatarCheck.valid) {
      return NextResponse.json(
        { ok: false, error: avatarCheck.error },
        { status: 400 }
      );
    }
    updates.avatarUrl = avatarCheck.value ?? null;
  }

  if (typeof body.fullName === "string" && body.fullName.trim()) {
    updates.fullName = body.fullName.trim();
  }

  if (typeof body.username === "string" && body.username.trim()) {
    const cleanUser = body.username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, "");
    if (cleanUser.length < 3) {
      return NextResponse.json(
        { ok: false, error: "Username ត្រូវមានយ៉ាងតិច ៣ តួអក្សរ (a-z, 0-9)។" },
        { status: 400 }
      );
    }
    updates.username = cleanUser;
  }

  if (typeof body.email === "string" && body.email.trim()) {
    const cleanEmail = body.email.trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "ទម្រង់អ៊ីមែលមិនត្រឹមត្រូវទេ។" },
        { status: 400 }
      );
    }
    updates.email = cleanEmail;
  }

  if (updates.email || updates.username) {
    const checkEmail = updates.email ?? existingUser.email;
    const checkUsername = updates.username ?? existingUser.username;
    const dup = await repoFindDuplicateUser(
      checkEmail,
      checkUsername,
      targetId
    );
    if (dup) {
      return NextResponse.json(
        {
          ok: false,
          error:
            dup.email.toLowerCase() === checkEmail.toLowerCase()
              ? "អ៊ីមែលនេះមានអ្នកប្រើរួចហើយនៅក្នុងប្រព័ន្ធ។"
              : "Username នេះមានអ្នកប្រើរួចហើយនៅក្នុងប្រព័ន្ធ។",
        },
        { status: 409 }
      );
    }
  }

  if (typeof body.department === "string" && body.department.trim()) {
    updates.department = body.department.trim();
  }

  if (body.avatarColor !== undefined) {
    if (typeof body.avatarColor !== "string" || !/^#[0-9a-f]{6}$/i.test(body.avatarColor)) {
      return NextResponse.json({ ok: false, error: "ពណ៌តំណាងមិនត្រឹមត្រូវទេ។" }, { status: 400 });
    }
    updates.avatarColor = body.avatarColor;
  }

  if (isAdmin && typeof body.role === "string") {
    if (
      body.role === "admin" ||
      body.role === "agent" ||
      body.role === "user"
    ) {
      updates.role = body.role;
    }
  }

  if (isAdmin && typeof body.isActive === "boolean") {
    if (isSelf && !body.isActive) {
      return NextResponse.json(
        { ok: false, error: "មិនអាចបិទគណនីខ្លួនឯងដែលកំពុងប្រើប្រាស់បានទេ។" },
        { status: 400 }
      );
    }
    updates.isActive = body.isActive;
  }

  if (typeof body.newPassword === "string" && body.newPassword.trim()) {
    const cleanPass = normalizeKhmerDigits(body.newPassword.trim());
    if (cleanPass.length < 4) {
      return NextResponse.json(
        { ok: false, error: "ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៤ តួអក្សរ។" },
        { status: 400 }
      );
    }
    updates.passwordHash = hashPassword(cleanPass);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { ok: false, error: "មិនមានទិន្នន័យត្រូវកែប្រែទេ។" },
      { status: 400 }
    );
  }

  const updated = await repoUpdateUser(targetId, updates);
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "រកមិនឃើញគណនីនេះទេ" },
      { status: 404 }
    );
  }

  const safeUser = toSafeUser(updated);
  // A password change invalidates old sessions; renew the current session only
  // when the caller changed their own password.
  const renewedToken = isSelf && updates.passwordHash
    ? signAuthToken(safeUser.id, safeUser.role, updated.passwordHash)
    : undefined;
  const response = NextResponse.json({ ok: true, user: safeUser, ...(renewedToken ? { token: renewedToken } : {}) });
  if (renewedToken) attachAuthCookie(response, req, renewedToken);
  return response;
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "មានតែ Admin ប៉ុណ្ណោះដែលអាចលុបគណនីអ្នកប្រើប្រាស់បាន។" },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId)) {
    return NextResponse.json(
      { ok: false, error: "ID មិនត្រឹមត្រូវ" },
      { status: 400 }
    );
  }

  if (targetId === currentUser.id) {
    return NextResponse.json(
      { ok: false, error: "មិនអាចលុបគណនីខ្លួនឯងដែលកំពុងប្រើប្រាស់បានទេ។" },
      { status: 400 }
    );
  }

  const deleted = await repoDeleteUser(targetId);
  if (!deleted) {
    return NextResponse.json(
      { ok: false, error: "រកមិនឃើញគណនីនេះទេ" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
