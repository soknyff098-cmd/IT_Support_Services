import type { Ticket } from "@/db/schema";
import {
  repoListAllComments,
  repoListCategories,
  repoListCommentsByTicket,
  repoListTickets,
  repoListUsers,
} from "@/db/repository";
import type { SafeUser } from "./auth";

function toIsoSafe(val: Date | string | null | undefined): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) {
    return Number.isNaN(val.getTime())
      ? new Date().toISOString()
      : val.toISOString();
  }
  const parsed = new Date(val);
  return Number.isNaN(parsed.getTime())
    ? String(val)
    : parsed.toISOString();
}

export interface EnrichedTicket {
  id: number;
  ticketCode: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  categoryId: number | null;
  requesterId: number;
  assigneeId: number | null;
  location: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: {
    id: number;
    name: string;
    color: string;
    slaHours: number;
  } | null;
  requester: {
    id: number;
    fullName: string;
    username: string;
    email: string;
    department: string;
    avatarColor: string;
    avatarUrl: string | null;
  };
  assignee: {
    id: number;
    fullName: string;
    username: string;
    email: string;
    department: string;
    avatarColor: string;
    avatarUrl: string | null;
  } | null;
  commentCount: number;
}

export interface EnrichedComment {
  id: number;
  ticketId: number;
  authorId: number;
  message: string;
  isInternal: boolean;
  createdAt: string;
  author: {
    id: number;
    fullName: string;
    username: string;
    role: string;
    avatarColor: string;
    avatarUrl: string | null;
  };
}

export async function getEnrichedTickets(
  viewer: SafeUser,
  singleTicketId?: number
): Promise<EnrichedTicket[]> {
  const [ticketRows, allUsers, allCategories, allComments] = await Promise.all([
    repoListTickets(singleTicketId),
    repoListUsers(),
    repoListCategories(),
    repoListAllComments(),
  ]);

  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const catMap = new Map(allCategories.map((c) => [c.id, c]));

  const commentCountMap = new Map<number, number>();
  for (const c of allComments) {
    if (viewer.role === "user" && c.isInternal) continue;
    commentCountMap.set(c.ticketId, (commentCountMap.get(c.ticketId) ?? 0) + 1);
  }

  const filtered: Ticket[] =
    viewer.role === "user"
      ? ticketRows.filter((t) => t.requesterId === viewer.id)
      : ticketRows;

  return filtered.map((t) => {
    const reqUser = userMap.get(t.requesterId);
    const asgUser = t.assigneeId ? userMap.get(t.assigneeId) : undefined;
    const cat = t.categoryId ? catMap.get(t.categoryId) : undefined;

    const status =
      t.status === "in_progress" ||
      t.status === "resolved" ||
      t.status === "closed"
        ? t.status
        : "open";
    const priority =
      t.priority === "low" ||
      t.priority === "high" ||
      t.priority === "urgent"
        ? t.priority
        : "medium";

    return {
      id: t.id,
      ticketCode: t.ticketCode || `HD-${1000 + t.id}`,
      title: t.title || "សំណើជំនួយ",
      description: t.description || "",
      status,
      priority,
      categoryId: t.categoryId ?? null,
      requesterId: t.requesterId,
      assigneeId: t.assigneeId ?? null,
      location: t.location ?? null,
      resolvedAt: t.resolvedAt ? toIsoSafe(t.resolvedAt) : null,
      createdAt: toIsoSafe(t.createdAt),
      updatedAt: toIsoSafe(t.updatedAt),
      category: cat
        ? {
            id: cat.id,
            name: cat.name,
            color: cat.color || "#2563eb",
            slaHours: cat.slaHours ?? 24,
          }
        : null,
      requester: reqUser
        ? {
            id: reqUser.id,
            fullName: reqUser.fullName,
            username: reqUser.username,
            email: reqUser.email,
            department: reqUser.department,
            avatarColor: reqUser.avatarColor || "#2563eb",
            avatarUrl: reqUser.avatarUrl || null,
          }
        : {
            id: t.requesterId,
            fullName: "អ្នកប្រើប្រាស់",
            username: "unknown",
            email: "",
            department: "",
            avatarColor: "#64748b",
            avatarUrl: null,
          },
      assignee: asgUser
        ? {
            id: asgUser.id,
            fullName: asgUser.fullName,
            username: asgUser.username,
            email: asgUser.email,
            department: asgUser.department,
            avatarColor: asgUser.avatarColor || "#0891b2",
            avatarUrl: asgUser.avatarUrl || null,
          }
        : null,
      commentCount: commentCountMap.get(t.id) ?? 0,
    };
  });
}

export async function getTicketCommentsForViewer(
  ticketId: number,
  viewer: SafeUser
): Promise<EnrichedComment[]> {
  const [rows, allUsers] = await Promise.all([
    repoListCommentsByTicket(ticketId),
    repoListUsers(),
  ]);

  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  return rows
    .filter((c) => (viewer.role === "user" ? !c.isInternal : true))
    .map((c) => {
      const author = userMap.get(c.authorId);
      return {
        id: c.id,
        ticketId: c.ticketId,
        authorId: c.authorId,
        message: c.message || "",
        isInternal: Boolean(c.isInternal),
        createdAt: toIsoSafe(c.createdAt),
        author: author
          ? {
              id: author.id,
              fullName: author.fullName,
              username: author.username,
              role: author.role,
              avatarColor: author.avatarColor || "#2563eb",
              avatarUrl: author.avatarUrl || null,
            }
          : {
              id: c.authorId,
              fullName: "បុគ្គលិក",
              username: "staff",
              role: "user",
              avatarColor: "#64748b",
              avatarUrl: null,
            },
      };
    });
}
