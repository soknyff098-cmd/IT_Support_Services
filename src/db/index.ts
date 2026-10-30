import "dotenv/config";
import fsSync from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export const DEFAULT_DATABASE_URL =
  "postgresql://postgres:123456@127.0.0.1:5432/helpdesk";

const CONFIG_FILE = path.join(
  process.cwd(),
  ".helpdesk-data",
  "db-config.json"
);

export function getConfiguredDatabaseUrl(): string {
  try {
    if (fsSync.existsSync(CONFIG_FILE)) {
      const parsed = JSON.parse(fsSync.readFileSync(CONFIG_FILE, "utf8")) as {
        url?: string;
      };
      if (parsed.url?.trim()) {
        return parsed.url.trim();
      }
    }
  } catch {
    // Ignore read errors
  }
  return process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
}

declare global {
  var __helpdeskPgPool: Pool | undefined;
  var __helpdeskDrizzleDb: NodePgDatabase<typeof schema> | undefined;
}

export function getPgPool(): Pool {
  if (!globalThis.__helpdeskPgPool) {
    globalThis.__helpdeskPgPool = new Pool({
      connectionString: getConfiguredDatabaseUrl(),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 3_000,
    });
  }
  return globalThis.__helpdeskPgPool;
}

export function setPgPoolWithUrl(connectionString: string): Pool {
  const nextPool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 4_000,
  });
  const oldPool = globalThis.__helpdeskPgPool;
  globalThis.__helpdeskPgPool = nextPool;
  globalThis.__helpdeskDrizzleDb = drizzle(nextPool, { schema });
  if (oldPool) {
    void oldPool.end().catch(() => null);
  }
  return nextPool;
}

export function getDrizzleDb(): NodePgDatabase<typeof schema> {
  if (!globalThis.__helpdeskDrizzleDb) {
    globalThis.__helpdeskDrizzleDb = drizzle(getPgPool(), { schema });
  }
  return globalThis.__helpdeskDrizzleDb;
}
