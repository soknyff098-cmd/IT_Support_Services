import { NextRequest, NextResponse } from "next/server";
import { configureExternalPostgres, ensureDatabaseReady } from "@/db/init";

export async function GET() {
  const status = await ensureDatabaseReady();
  return NextResponse.json({
    ok: true,
    ...status,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      host?: string;
      port?: number | string;
      user?: string;
      password?: string;
      database?: string;
    };

    const status = await configureExternalPostgres({
      host: body.host ?? "127.0.0.1",
      port: Number(body.port ?? 5432),
      user: body.user ?? "postgres",
      password: body.password ?? "",
      database: body.database ?? "helpdesk",
    });

    return NextResponse.json({
      ok: true,
      message: `ភ្ជាប់ទៅកាន់ PostgreSQL (${status.database}) បានជោគជ័យ!`,
      ...status,
    });
  } catch (err: unknown) {
    const detail =
      err instanceof Error ? err.message : "មិនអាចភ្ជាប់ទៅកាន់ PostgreSQL បានទេ";
    return NextResponse.json(
      {
        ok: false,
        error: `ការភ្ជាប់ PostgreSQL បរាជ័យ៖ ${detail}`,
      },
      { status: 400 }
    );
  }
}
