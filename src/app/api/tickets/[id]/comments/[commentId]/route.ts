import { NextRequest, NextResponse } from "next/server";
import {
  repoDeleteComment,
  repoFindCommentById,
  repoUpdateComment,
} from "@/db/repository";
import { getCurrentUser } from "@/lib/auth";
import { getTicketCommentsForViewer } from "@/lib/tickets";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "សូមចូលគណនីជាមុនសិន" },
      { status: 401 }
    );
  }

  const { id, commentId } = await context.params;
  const tId = Number(id);
  const cId = Number(commentId);
  if (!Number.isInteger(tId) || !Number.isInteger(cId)) {
    return NextResponse.json(
      { ok: false, error: "ID មិនត្រឹមត្រូវ" },
      { status: 400 }
    );
  }

  const existing = await repoFindCommentById(cId);
  if (!existing || existing.ticketId !== tId) {
    return NextResponse.json(
      { ok: false, error: "រកមិនឃើញមតិឆ្លើយតបនេះទេ" },
      { status: 404 }
    );
  }

  if (user.role !== "admin" && existing.authorId !== user.id) {
    return NextResponse.json(
      { ok: false, error: "មិនមានសិទ្ធិកែសម្រួលមតិនេះទេ" },
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
      { ok: false, error: "អត្ថបទឆ្លើយតបមិនអាចទទេបានទេ។" },
      { status: 400 }
    );
  }

  const isStaff = user.role === "admin" || user.role === "agent";

  await repoUpdateComment(cId, {
    message,
    ...(isStaff && typeof body.isInternal === "boolean"
      ? { isInternal: body.isInternal }
      : {}),
  });

  const comments = await getTicketCommentsForViewer(tId, user);
  return NextResponse.json({ ok: true, comments });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "សូមចូលគណនីជាមុនសិន" },
      { status: 401 }
    );
  }

  const { id, commentId } = await context.params;
  const tId = Number(id);
  const cId = Number(commentId);
  if (!Number.isInteger(tId) || !Number.isInteger(cId)) {
    return NextResponse.json(
      { ok: false, error: "ID មិនត្រឹមត្រូវ" },
      { status: 400 }
    );
  }

  const existing = await repoFindCommentById(cId);
  if (!existing || existing.ticketId !== tId) {
    return NextResponse.json(
      { ok: false, error: "រកមិនឃើញមតិឆ្លើយតបនេះទេ" },
      { status: 404 }
    );
  }

  if (user.role !== "admin" && existing.authorId !== user.id) {
    return NextResponse.json(
      { ok: false, error: "មិនមានសិទ្ធិលុបមតិនេះទេ" },
      { status: 403 }
    );
  }

  await repoDeleteComment(cId);
  const comments = await getTicketCommentsForViewer(tId, user);
  return NextResponse.json({ ok: true, comments });
}
