import { NextRequest, NextResponse } from "next/server";
import { repoCreateComment, repoFindTicketById } from "@/db/repository";
import { getCurrentUser } from "@/lib/auth";
import { getTicketCommentsForViewer } from "@/lib/tickets";

export async function POST(
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
      { ok: false, error: "មិនមានសិទ្ធិឆ្លើយតបលើសំណើនេះទេ" },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    message?: string;
    isInternal?: boolean;
  };

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json(
      { ok: false, error: "សូមសរសេរមតិឆ្លើយតបជាមុនសិន។" },
      { status: 400 }
    );
  }

  const isInternal = isStaff ? Boolean(body.isInternal) : false;

  await repoCreateComment({
    ticketId,
    authorId: user.id,
    message,
    isInternal,
  });

  const comments = await getTicketCommentsForViewer(ticketId, user);
  return NextResponse.json({ ok: true, comments }, { status: 201 });
}
