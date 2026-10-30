import { NextResponse } from "next/server";
import { ensureDatabaseReady } from "@/db/init";
import { repoListUsers } from "@/db/repository";
import { toSafeUser } from "@/lib/auth";

export async function GET() {
  try {
    const dbState = await ensureDatabaseReady();
    const allUsers = await repoListUsers();
    const activeUsers = allUsers.map(toSafeUser).filter((u) => u.isActive);

    // Every active account is live data, including accounts added later by the admin.
    const quickUsers = activeUsers.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      username: u.username,
      role: u.role,
      avatarColor: u.avatarColor,
      avatarUrl: u.avatarUrl,
    }));

    return NextResponse.json({
      ok: true,
      connected: true,
      mode: dbState.mode,
      database: dbState.database,
      host: dbState.host,
      port: dbState.port,
      user: dbState.user,
      fallbackReason: dbState.fallbackReason,
      userCount: allUsers.length,
      quickUsers,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Database initialization failed";
    return NextResponse.json(
      {
        ok: false,
        connected: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
