import { NextRequest, NextResponse } from "next/server";
import { repoCreateTicket } from "@/db/repository";
import { getCurrentUser } from "@/lib/auth";
import { getEnrichedTickets } from "@/lib/tickets";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "សូមចូលគណនីជាមុនសិន" },
        { status: 401 }
      );
    }

    const list = await getEnrichedTickets(user);
    return NextResponse.json({ ok: true, tickets: list });
  } catch (err: unknown) {
    console.error("GET /api/tickets error:", err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `មិនអាចទាញយកបញ្ជីសំណើបានទេ៖ ${detail}` },
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

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      description?: string;
      priority?: string;
      categoryId?: number | null;
      location?: string;
      assigneeId?: number | null;
      requesterId?: number | null;
    };

    const title = (body.title ?? "").trim();
    const description = (body.description ?? "").trim();

    if (!title || !description) {
      return NextResponse.json(
        { ok: false, error: "សូមបំពេញចំណងជើងបញ្ហា និងការពិពណ៌នាលម្អិត។" },
        { status: 400 }
      );
    }

    const priority =
      body.priority === "low" ||
      body.priority === "medium" ||
      body.priority === "high" ||
      body.priority === "urgent"
        ? body.priority
        : "medium";

    const isStaff = user.role === "admin" || user.role === "agent";

    const created = await repoCreateTicket({
      title,
      description,
      priority,
      categoryId: body.categoryId ? Number(body.categoryId) : null,
      requesterId:
        isStaff && body.requesterId ? Number(body.requesterId) : user.id,
      assigneeId: isStaff && body.assigneeId ? Number(body.assigneeId) : null,
      location: (body.location ?? "").trim() || null,
    });

    const enriched = await getEnrichedTickets(user, created.id);
    return NextResponse.json(
      { ok: true, ticket: enriched[0] },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("POST /api/tickets error:", err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `មិនអាចបង្កើតសំណើថ្មីបានទេ៖ ${detail}` },
      { status: 500 }
    );
  }
}
