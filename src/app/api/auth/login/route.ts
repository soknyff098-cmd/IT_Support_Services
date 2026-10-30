import { NextRequest, NextResponse } from "next/server";
import { repoFindUserByIdentifier } from "@/db/repository";
import { verifyPassword } from "@/lib/password";
import { attachAuthCookie, signAuthToken, toSafeUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      identifier?: string;
      email?: string;
      username?: string;
      password?: string;
    };

    const rawIdentifier = (
      body.identifier ??
      body.email ??
      body.username ??
      ""
    ).trim();
    const password = body.password ?? "";

    if (!rawIdentifier || !password.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: "សូមបញ្ចូល អ៊ីមែល/ឈ្មោះគណនី និងពាក្យសម្ងាត់។",
        },
        { status: 400 }
      );
    }

    const user = await repoFindUserByIdentifier(rawIdentifier);
    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "រកមិនឃើញគណនីនេះទេ។ សូមពិនិត្យអ៊ីមែល ឬឈ្មោះគណនីម្ដងទៀត (ឧ. admin ឬ admin@helpdesk.com)។",
        },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "គណនីនេះត្រូវបានផ្អាកដំណើរការជាបណ្ដោះអាសន្ន។ សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ (Admin)។",
        },
        { status: 403 }
      );
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "ពាក្យសម្ងាត់មិនត្រឹមត្រូវទេ។ សូមពិនិត្យម្ដងទៀត។",
        },
        { status: 401 }
      );
    }

    const safeUser = toSafeUser(user);
    const token = signAuthToken(safeUser.id, safeUser.role, user.passwordHash);

    const res = NextResponse.json({
      ok: true,
      token,
      user: safeUser,
    });
    attachAuthCookie(res, req, token);
    return res;
  } catch (err: unknown) {
    console.error("Login error:", err);
    const detail = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json(
      {
        ok: false,
        error: `មានបញ្ហាក្នុងការចូលប្រើប្រាស់៖ ${detail}`,
      },
      { status: 500 }
    );
  }
}
