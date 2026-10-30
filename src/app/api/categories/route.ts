import { NextRequest, NextResponse } from "next/server";
import { repoCreateCategory, repoListCategories } from "@/db/repository";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "សូមចូលគណនីជាមុនសិន" },
        { status: 401 }
      );
    }

    const list = await repoListCategories();
    return NextResponse.json({ ok: true, categories: list });
  } catch (err: unknown) {
    console.error("GET /api/categories error:", err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `មិនអាចទាញយកប្រភេទបញ្ហាបានទេ៖ ${detail}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "សូមចូលគណនីជាមុនសិន" },
        { status: 401 }
      );
    }
    if (user.role !== "admin" && user.role !== "agent") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "មានតែអ្នកគ្រប់គ្រង ឬបុគ្គលិកបច្ចេកទេសប៉ុណ្ណោះដែលអាចបន្ថែមប្រភេទបញ្ហាបាន។",
        },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      color?: string;
      slaHours?: number;
    };

    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { ok: false, error: "សូមបញ្ចូលឈ្មោះប្រភេទបញ្ហា (Category)។" },
        { status: 400 }
      );
    }

    const created = await repoCreateCategory({
      name,
      description: (body.description ?? "").trim() || null,
      color: (body.color ?? "").trim() || "#2563eb",
      slaHours: Math.max(1, Number(body.slaHours ?? 24) || 24),
    });

    return NextResponse.json({ ok: true, category: created }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/categories error:", err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `មិនអាចបង្កើតប្រភេទបញ្ហាបានទេ៖ ${detail}` },
      { status: 500 }
    );
  }
}
