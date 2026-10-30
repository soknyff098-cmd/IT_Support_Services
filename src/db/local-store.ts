import fs from "node:fs/promises";
import path from "node:path";
import type {
  Category,
  Ticket,
  TicketComment,
  User,
} from "./schema";
import { ACCOUNT_SETUP_MIGRATION, SEED_USERS, createInitialSeedDataset } from "./seed-data";

export interface RawLocalData {
  appliedMigrations?: string[];
  users: Array<{
    id: number;
    username: string;
    email: string;
    passwordHash: string;
    fullName: string;
    role: string;
    department: string;
    avatarColor: string;
    avatarUrl?: string | null;
    isActive: boolean;
    createdAt: string;
  }>;
  categories: Array<{
    id: number;
    name: string;
    description: string | null;
    color: string;
    slaHours: number;
    createdAt: string;
  }>;
  tickets: Array<{
    id: number;
    ticketCode: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    categoryId: number | null;
    requesterId: number;
    assigneeId: number | null;
    location: string | null;
    resolvedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  ticketComments: Array<{
    id: number;
    ticketId: number;
    authorId: number;
    message: string;
    isInternal: boolean;
    createdAt: string;
  }>;
}

const DATA_DIR = path.join(process.cwd(), ".helpdesk-data");
const DB_FILE = path.join(DATA_DIR, "database.json");

declare global {
  var __helpdeskLocalCache: RawLocalData | undefined;
  var __helpdeskWriteLock: Promise<void> | undefined;
}

export async function readLocalStore(): Promise<RawLocalData> {
  if (globalThis.__helpdeskLocalCache) {
    return globalThis.__helpdeskLocalCache;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  let existing: RawLocalData | null = null;
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as RawLocalData;
    if (!parsed || !Array.isArray(parsed.users)) {
      throw new Error("ទិន្នន័យ Local មិនត្រឹមត្រូវទេ។ ឯកសារដើមមិនត្រូវបានជំនួសទេ។");
    }
    existing = parsed;
  } catch (error) {
    // Only a missing file is a fresh install. Never overwrite an unreadable or corrupt store.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  if (existing) {
    const migrations = Array.isArray(existing.appliedMigrations) ? existing.appliedMigrations : [];
    if (!migrations.includes(ACCOUNT_SETUP_MIGRATION)) {
      for (const account of SEED_USERS) {
        const user = existing.users.find((item) => item.username === account.username &&
          item.fullName === account.legacyFullName && item.role === account.role);
        if (user) {
          user.fullName = account.fullName;
          user.passwordHash = account.initialPasswordHash;
        }
      }
      existing.appliedMigrations = [...migrations, ACCOUNT_SETUP_MIGRATION];
      // Keep the original file intact if writing the one-time migration fails.
      const tempPath = `${DB_FILE}.${process.pid}.tmp`;
      try {
        await fs.writeFile(tempPath, JSON.stringify(existing, null, 2), "utf8");
        await fs.rename(tempPath, DB_FILE);
      } catch (error) {
        await fs.unlink(tempPath).catch(() => undefined);
        throw error;
      }
    }
    globalThis.__helpdeskLocalCache = existing;
    return existing;
  }

  const seeded = createInitialSeedDataset();
  globalThis.__helpdeskLocalCache = seeded;
  await fs.writeFile(DB_FILE, JSON.stringify(seeded, null, 2), "utf8");
  return seeded;
}

export async function mutateLocalStore<T>(
  mutator: (data: RawLocalData) => T | Promise<T>
): Promise<T> {
  const prevLock = globalThis.__helpdeskWriteLock ?? Promise.resolve();
  let release!: () => void;
  globalThis.__helpdeskWriteLock = new Promise<void>((res) => {
    release = res;
  });

  await prevLock;
  try {
    const data = await readLocalStore();
    const result = await mutator(data);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), "utf8");
    return result;
  } finally {
    release();
  }
}

export function hydrateUser(u: RawLocalData["users"][number]): User {
  return {
    ...u,
    avatarUrl: u.avatarUrl ?? null,
    createdAt: new Date(u.createdAt),
  };
}

export function hydrateCategory(
  c: RawLocalData["categories"][number]
): Category {
  return {
    ...c,
    createdAt: new Date(c.createdAt),
  };
}

export function hydrateTicket(t: RawLocalData["tickets"][number]): Ticket {
  return {
    ...t,
    resolvedAt: t.resolvedAt ? new Date(t.resolvedAt) : null,
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt),
  };
}

export function hydrateComment(
  c: RawLocalData["ticketComments"][number]
): TicketComment {
  return {
    ...c,
    createdAt: new Date(c.createdAt),
  };
}
