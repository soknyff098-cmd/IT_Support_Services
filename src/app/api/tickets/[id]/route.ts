import { NextRequest, NextResponse } from "next/server";
import {
  repoDeleteTicket,
  repoFindTicketById,
  repoUpdateTicket,
} from "@/db/repository";
import { getCurrentUser } from "@/lib/auth";
import {
  getEnrichedTickets,
  getTicketCommentsForViewer,
} from "@/lib/tickets";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "សូមចូលគណនីជាមុនសិន" },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId)) {
    return NextResponse.json(
      { ok: false, error: "ID មិនត្រឹមត្រូវ" },
      { status: 400 }
    );
  }

  const enriched = await getEnrichedTickets(user, ticketId);
  if (!enriched[0]) {
    return NextResponse.json(
      { ok: false, error: "រកមិនឃើញសំណើ (Ticket) នេះទេ" },
      { status: 404 }
    );
  }

  const comments = await getTicketCommentsForViewer(ticketId, user);
  return NextResponse.json({
    ok: true,
    ticket: enriched[0],
    comments,
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "សូមចូលគណនីជាមុនសិន" },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId)) {
    return NextResponse.json(
      { ok: false, error: "ID មិនត្រឹមត្រូវ" },
      { status: 400 }
    );
  }

  const existing = await repoFindTicketById(ticketId);
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "រកមិនឃើញសំណើ (Ticket) នេះទេ" },
      { status: 404 }
    );
  }

  const isStaff = user.role === "admin" || user.role === "agent";
  if (!isStaff && existing.requesterId !== user.id) {
    return NextResponse.json(
      { ok: false, error: "មិនមានសិទ្ធិកែប្រែសំណើនេះទេ" },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    categoryId?: number | null;
    requesterId?: number;
    assigneeId?: number | null;
    location?: string | null;
  };

  const updates: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    categoryId: number | null;
    requesterId: number;
    assigneeId: number | null;
    location: string | null;
    resolvedAt: Date | null;
    updatedAt: Date;
  }> = {
    updatedAt: new Date(),
  };

  if (typeof body.title === "string" && body.title.trim()) {
    updates.title = body.title.trim();
  }
  if (typeof body.description === "string" && body.description.trim()) {
    updates.description = body.description.trim();
  }
  if (body.location !== undefined) {
    updates.location = body.location ? body.location.trim() : null;
  }
  if (body.categoryId !== undefined) {
    updates.categoryId = body.categoryId ? Number(body.categoryId) : null;
  }

  if (typeof body.status === "string") {
    const validStatuses = ["open", "in_progress", "resolved", "closed"];
    if (validStatuses.includes(body.status)) {
      if (isStaff || body.status === "closed" || body.status === "open") {
        updates.status = body.status;
        if (body.status === "resolved") {
          updates.resolvedAt = new Date();
        } else if (body.status === "open" || body.status === "in_progress") {
          updates.resolvedAt = null;
        }
      }
    }
  }

  if (typeof body.priority === "string") {
    if (["low", "medium", "high", "urgent"].includes(body.priority)) {
      if (isStaff || existing.requesterId === user.id) {
        updates.priority = body.priority;
      }
    }
  }

  if (isStaff && body.assigneeId !== undefined) {
    updates.assigneeId = body.assigneeId ? Number(body.assigneeId) : null;
  }

  if (isStaff && body.requesterId !== undefined && Number(body.requesterId) > 0) {
    updates.requesterId = Number(body.requesterId);
  }

  await repoUpdateTicket(ticketId, updates);

  const enriched = await getEnrichedTickets(user, ticketId);
  return NextResponse.json({ ok: true, ticket: enriched[0] });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "សូមចូលគណនីជាមុនសិន" },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId)) {
    return NextResponse.json(
      { ok: false, error: "ID មិនត្រឹមត្រូវ" },
      { status: 400 }
    );
  }

  const existing = await repoFindTicketById(ticketId);
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "រកមិនឃើញសំណើនេះទេ" },
      { status: 404 }
    );
  }

  const canDelete =
    user.role === "admin" ||
    (existing.requesterId === user.id && existing.status === "open");

  if (!canDelete) {
    return NextResponse.json(
      { ok: false, error: "មានតែ Admin ប៉ុណ្ណោះដែលអាចលុបសំណើនេះបាន។" },
      { status: 403 }
    );
  }

  await repoDeleteTicket(ticketId);
  return NextResponse.json({ ok: true });
}
