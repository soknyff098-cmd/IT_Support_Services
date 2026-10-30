import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { getDrizzleDb } from "./index";
import { ensureDatabaseReady } from "./init";
import {
  categories,
  ticketComments,
  tickets,
  users,
  type Category,
  type Ticket,
  type TicketComment,
  type User,
} from "./schema";
import {
  hydrateCategory,
  hydrateComment,
  hydrateTicket,
  hydrateUser,
  mutateLocalStore,
  readLocalStore,
} from "./local-store";

export async function repoCountUsers(): Promise<number> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    const res = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    return res[0]?.count ?? 0;
  }
  const store = await readLocalStore();
  return store.users.length;
}

export async function repoFindUserById(id: number): Promise<User | null> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows[0] ?? null;
  }
  const store = await readLocalStore();
  const found = store.users.find((u) => u.id === id);
  return found ? hydrateUser(found) : null;
}

export async function repoFindUserByIdentifier(
  identifier: string
): Promise<User | null> {
  const lowered = identifier.trim().toLowerCase();
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    const rows = await db
      .select()
      .from(users)
      .where(
        sql`LOWER(${users.email}) = ${lowered} OR LOWER(${users.username}) = ${lowered}`
      )
      .limit(1);
    return rows[0] ?? null;
  }
  const store = await readLocalStore();
  const found = store.users.find(
    (u) =>
      u.email.toLowerCase() === lowered || u.username.toLowerCase() === lowered
  );
  return found ? hydrateUser(found) : null;
}

export async function repoFindDuplicateUser(
  email: string,
  username: string,
  excludeUserId?: number
): Promise<{ id: number; email: string; username: string } | null> {
  const eLow = email.trim().toLowerCase();
  const uLow = username.trim().toLowerCase();
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    const matchExpr = sql`(LOWER(${users.email}) = ${eLow} OR LOWER(${users.username}) = ${uLow})`;
    const whereClause =
      excludeUserId !== undefined
        ? and(ne(users.id, excludeUserId), matchExpr)
        : matchExpr;

    const rows = await db
      .select({ id: users.id, email: users.email, username: users.username })
      .from(users)
      .where(whereClause)
      .limit(1);
    return rows[0] ?? null;
  }
  const store = await readLocalStore();
  const found = store.users.find(
    (u) =>
      (excludeUserId === undefined || u.id !== excludeUserId) &&
      (u.email.toLowerCase() === eLow || u.username.toLowerCase() === uLow)
  );
  return found
    ? { id: found.id, email: found.email, username: found.username }
    : null;
}

export async function repoListUsers(): Promise<User[]> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    return db.select().from(users).orderBy(asc(users.id));
  }
  const store = await readLocalStore();
  return [...store.users].sort((a, b) => a.id - b.id).map(hydrateUser);
}

export async function repoCreateUser(input: {
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: string;
  department: string;
  avatarColor: string;
  avatarUrl?: string | null;
  isActive: boolean;
}): Promise<User> {
  const state = await ensureDatabaseReady();
  const normalized = {
    ...input,
    avatarUrl: input.avatarUrl ?? null,
  };
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    const inserted = await db.insert(users).values(normalized).returning();
    return inserted[0];
  }
  return mutateLocalStore((store) => {
    const nextId =
      store.users.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    const raw = {
      id: nextId,
      ...normalized,
      createdAt: new Date().toISOString(),
    };
    store.users.push(raw);
    return hydrateUser(raw);
  });
}

export async function repoUpdateUser(
  id: number,
  updates: Partial<{
    username: string;
    email: string;
    fullName: string;
    department: string;
    role: string;
    avatarColor: string;
    avatarUrl: string | null;
    isActive: boolean;
    passwordHash: string;
  }>
): Promise<User | null> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    const updated = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return updated[0] ?? null;
  }
  return mutateLocalStore((store) => {
    const target = store.users.find((u) => u.id === id);
    if (!target) return null;
    if (updates.username !== undefined) target.username = updates.username;
    if (updates.email !== undefined) target.email = updates.email;
    if (updates.fullName !== undefined) target.fullName = updates.fullName;
    if (updates.department !== undefined)
      target.department = updates.department;
    if (updates.role !== undefined) target.role = updates.role;
    if (updates.avatarColor !== undefined)
      target.avatarColor = updates.avatarColor;
    if (updates.avatarUrl !== undefined)
      target.avatarUrl = updates.avatarUrl;
    if (updates.isActive !== undefined) target.isActive = updates.isActive;
    if (updates.passwordHash !== undefined)
      target.passwordHash = updates.passwordHash;
    return hydrateUser(target);
  });
}

export async function repoDeleteUser(id: number): Promise<boolean> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    const deleted = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return deleted.length > 0;
  }
  return mutateLocalStore((store) => {
    const before = store.users.length;
    store.users = store.users.filter((u) => u.id !== id);
    if (store.users.length === before) return false;

    const deletedTicketIds = new Set(
      store.tickets.filter((t) => t.requesterId === id).map((t) => t.id)
    );
    store.tickets = store.tickets
      .filter((t) => t.requesterId !== id)
      .map((t) => (t.assigneeId === id ? { ...t, assigneeId: null } : t));
    store.ticketComments = store.ticketComments.filter(
      (c) => c.authorId !== id && !deletedTicketIds.has(c.ticketId)
    );
    return true;
  });
}

export async function repoListCategories(): Promise<Category[]> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    return db.select().from(categories).orderBy(asc(categories.id));
  }
  const store = await readLocalStore();
  return [...store.categories].sort((a, b) => a.id - b.id).map(hydrateCategory);
}

export async function repoCreateCategory(input: {
  name: string;
  description: string | null;
  color: string;
  slaHours: number;
}): Promise<Category> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    const inserted = await db.insert(categories).values(input).returning();
    return inserted[0];
  }
  return mutateLocalStore((store) => {
    const nextId =
      store.categories.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    const raw = {
      id: nextId,
      ...input,
      createdAt: new Date().toISOString(),
    };
    store.categories.push(raw);
    return hydrateCategory(raw);
  });
}

export async function repoUpdateCategory(
  id: number,
  updates: Partial<{
    name: string;
    description: string | null;
    color: string;
    slaHours: number;
  }>
): Promise<Category | null> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    const updated = await db
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();
    return updated[0] ?? null;
  }
  return mutateLocalStore((store) => {
    const target = store.categories.find((c) => c.id === id);
    if (!target) return null;
    if (updates.name !== undefined) target.name = updates.name;
    if (updates.description !== undefined)
      target.description = updates.description;
    if (updates.color !== undefined) target.color = updates.color;
    if (updates.slaHours !== undefined) target.slaHours = updates.slaHours;
    return hydrateCategory(target);
  });
}

export async function repoDeleteCategory(id: number): Promise<void> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    await db.delete(categories).where(eq(categories.id, id));
    return;
  }
  await mutateLocalStore((store) => {
    store.categories = store.categories.filter((c) => c.id !== id);
    for (const t of store.tickets) {
      if (t.categoryId === id) {
        t.categoryId = null;
      }
    }
  });
}

export async function repoListTickets(singleId?: number): Promise<Ticket[]> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    if (singleId !== undefined) {
      return db.select().from(tickets).where(eq(tickets.id, singleId));
    }
    return db
      .select()
      .from(tickets)
      .orderBy(desc(tickets.updatedAt), desc(tickets.id));
  }
  const store = await readLocalStore();
  const list =
    singleId !== undefined
      ? store.tickets.filter((t) => t.id === singleId)
      : [...store.tickets].sort((a, b) => {
          const timeDiff =
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          return timeDiff !== 0 ? timeDiff : b.id - a.id;
        });
  return list.map(hydrateTicket);
}

export async function repoFindTicketById(id: number): Promise<Ticket | null> {
  const rows = await repoListTickets(id);
  return rows[0] ?? null;
}

export async function repoCreateTicket(input: {
  title: string;
  description: string;
  priority: string;
  categoryId: number | null;
  requesterId: number;
  assigneeId: number | null;
  location: string | null;
}): Promise<Ticket> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    const maxRes = await db
      .select({ maxId: sql<number>`COALESCE(MAX(${tickets.id}), 0)::int` })
      .from(tickets);
    const nextNum = 1001 + (maxRes[0]?.maxId ?? 0);
    const ticketCode = `HD-${nextNum}`;
    const inserted = await db
      .insert(tickets)
      .values({
        ticketCode,
        title: input.title,
        description: input.description,
        status: "open",
        priority: input.priority,
        categoryId: input.categoryId,
        requesterId: input.requesterId,
        assigneeId: input.assigneeId,
        location: input.location,
      })
      .returning();
    return inserted[0];
  }
  return mutateLocalStore((store) => {
    const maxId = store.tickets.reduce(
      (max, item) => Math.max(max, item.id),
      0
    );
    const nextId = maxId + 1;
    const nowIso = new Date().toISOString();
    const raw = {
      id: nextId,
      ticketCode: `HD-${1000 + nextId}`,
      title: input.title,
      description: input.description,
      status: "open",
      priority: input.priority,
      categoryId: input.categoryId,
      requesterId: input.requesterId,
      assigneeId: input.assigneeId,
      location: input.location,
      resolvedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    store.tickets.push(raw);
    return hydrateTicket(raw);
  });
}

export async function repoUpdateTicket(
  id: number,
  updates: Partial<{
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
  }>
): Promise<void> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    await db.update(tickets).set(updates).where(eq(tickets.id, id));
    return;
  }
  await mutateLocalStore((store) => {
    const target = store.tickets.find((t) => t.id === id);
    if (!target) return;
    if (updates.title !== undefined) target.title = updates.title;
    if (updates.description !== undefined)
      target.description = updates.description;
    if (updates.status !== undefined) target.status = updates.status;
    if (updates.priority !== undefined) target.priority = updates.priority;
    if (updates.categoryId !== undefined)
      target.categoryId = updates.categoryId;
    if (updates.requesterId !== undefined)
      target.requesterId = updates.requesterId;
    if (updates.assigneeId !== undefined)
      target.assigneeId = updates.assigneeId;
    if (updates.location !== undefined) target.location = updates.location;
    if (updates.resolvedAt !== undefined) {
      target.resolvedAt = updates.resolvedAt
        ? updates.resolvedAt.toISOString()
        : null;
    }
    target.updatedAt = (updates.updatedAt ?? new Date()).toISOString();
  });
}

export async function repoDeleteTicket(id: number): Promise<void> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    await db.delete(tickets).where(eq(tickets.id, id));
    return;
  }
  await mutateLocalStore((store) => {
    store.tickets = store.tickets.filter((t) => t.id !== id);
    store.ticketComments = store.ticketComments.filter(
      (c) => c.ticketId !== id
    );
  });
}

export async function repoListAllComments(): Promise<TicketComment[]> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    return db.select().from(ticketComments);
  }
  const store = await readLocalStore();
  return store.ticketComments.map(hydrateComment);
}

export async function repoListCommentsByTicket(
  ticketId: number
): Promise<TicketComment[]> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    return db
      .select()
      .from(ticketComments)
      .where(eq(ticketComments.ticketId, ticketId))
      .orderBy(asc(ticketComments.createdAt), asc(ticketComments.id));
  }
  const store = await readLocalStore();
  return store.ticketComments
    .filter((c) => c.ticketId === ticketId)
    .sort((a, b) => {
      const diff =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return diff !== 0 ? diff : a.id - b.id;
    })
    .map(hydrateComment);
}

export async function repoFindCommentById(
  commentId: number
): Promise<TicketComment | null> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    const rows = await db
      .select()
      .from(ticketComments)
      .where(eq(ticketComments.id, commentId))
      .limit(1);
    return rows[0] ?? null;
  }
  const store = await readLocalStore();
  const found = store.ticketComments.find((c) => c.id === commentId);
  return found ? hydrateComment(found) : null;
}

export async function repoCreateComment(input: {
  ticketId: number;
  authorId: number;
  message: string;
  isInternal: boolean;
}): Promise<void> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    await db.insert(ticketComments).values(input);
    await db
      .update(tickets)
      .set({ updatedAt: new Date() })
      .where(eq(tickets.id, input.ticketId));
    return;
  }
  await mutateLocalStore((store) => {
    const nextId =
      store.ticketComments.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    const nowIso = new Date().toISOString();
    store.ticketComments.push({
      id: nextId,
      ticketId: input.ticketId,
      authorId: input.authorId,
      message: input.message,
      isInternal: input.isInternal,
      createdAt: nowIso,
    });
    const t = store.tickets.find((item) => item.id === input.ticketId);
    if (t) {
      t.updatedAt = nowIso;
    }
  });
}

export async function repoUpdateComment(
  commentId: number,
  updates: Partial<{ message: string; isInternal: boolean }>
): Promise<void> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    await db
      .update(ticketComments)
      .set(updates)
      .where(eq(ticketComments.id, commentId));
    return;
  }
  await mutateLocalStore((store) => {
    const target = store.ticketComments.find((c) => c.id === commentId);
    if (!target) return;
    if (updates.message !== undefined) target.message = updates.message;
    if (updates.isInternal !== undefined)
      target.isInternal = updates.isInternal;
  });
}

export async function repoDeleteComment(commentId: number): Promise<void> {
  const state = await ensureDatabaseReady();
  if (state.mode === "postgresql") {
    const db = getDrizzleDb();
    await db.delete(ticketComments).where(eq(ticketComments.id, commentId));
    return;
  }
  await mutateLocalStore((store) => {
    store.ticketComments = store.ticketComments.filter(
      (c) => c.id !== commentId
    );
  });
}
