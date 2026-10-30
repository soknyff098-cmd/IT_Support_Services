import { NextRequest, NextResponse } from "next/server";
import { repoDeleteCategory, repoUpdateCategory } from "@/db/repository";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user || (user.role !== "admin" && user.role !== "agent")) {
    return NextResponse.json(
      {
        ok: false,
        error: "មានតែ Admin ឬ Agent ប៉ុណ្ណោះដែលអាចកែសម្រួលប្រភេទបញ្ហាបាន។",
      },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const catId = Number(id);
  if (!Number.isInteger(catId)) {
    return NextResponse.json(
      { ok: false, error: "ID មិនត្រឹមត្រូវ" },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string | null;
    color?: string;
    slaHours?: number;
  };

  const updates: Partial<{
    name: string;
    description: string | null;
    color: string;
    slaHours: number;
  }> = {};

  if (typeof body.name === "string") {
    if (!body.name.trim()) {
      return NextResponse.json(
        { ok: false, error: "ឈ្មោះប្រភេទបញ្ហាមិនអាចទទេបានទេ។" },
        { status: 400 }
      );
    }
    updates.name = body.name.trim();
  }
  if (body.description !== undefined) {
    updates.description = body.description ? body.description.trim() : null;
  }
  if (typeof body.color === "string" && body.color.trim()) {
    updates.color = body.color.trim();
  }
  if (body.slaHours !== undefined) {
    updates.slaHours = Math.max(1, Number(body.slaHours) || 24);
  }

  const updated = await repoUpdateCategory(catId, updates);
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "រកមិនឃើញប្រភេទបញ្ហានេះទេ" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, category: updated });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "មានតែ Admin ប៉ុណ្ណោះដែលអាចលុបប្រភេទបញ្ហាបាន។" },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const catId = Number(id);
  if (!Number.isInteger(catId)) {
    return NextResponse.json(
      { ok: false, error: "ID មិនត្រឹមត្រូវ" },
      { status: 400 }
    );
  }

  await repoDeleteCategory(catId);
  return NextResponse.json({ ok: true });
}
