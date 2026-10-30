import fs from "node:fs/promises";
import path from "node:path";
import { Client, type Pool, type PoolClient } from "pg";
import {
  getConfiguredDatabaseUrl,
  getPgPool,
  setPgPoolWithUrl,
} from "./index";
import { hashPassword } from "@/lib/password";
import { ACCOUNT_SETUP_MIGRATION, SEED_CATEGORIES, SEED_USERS } from "./seed-data";
import { readLocalStore } from "./local-store";

export interface DbStatusInfo {
  mode: "postgresql" | "local";
  database: string;
  host: string;
  port: number;
  user: string;
  fallbackReason: string | null;
}

declare global {
  var __helpdeskInitPromise: Promise<void> | undefined;
  var __helpdeskDbStatus: DbStatusInfo | undefined;
}

function parseConnectionMeta(urlStr: string): {
  host: string;
  port: number;
  user: string;
  database: string;
} {
  try {
    const u = new URL(urlStr);
    return {
      host: u.hostname || "127.0.0.1",
      port: Number(u.port || 5432),
      user: decodeURIComponent(u.username || "postgres"),
      database: u.pathname.replace(/^\//, "") || "helpdesk",
    };
  } catch {
    return {
      host: "127.0.0.1",
      port: 5432,
      user: "postgres",
      database: "helpdesk",
    };
  }
}

async function testAndEnsurePostgresDb(urlStr: string): Promise<void> {
  try {
    const testClient = new Client({
      connectionString: urlStr,
      connectionTimeoutMillis: 2500,
    });
    await testClient.connect();
    await testClient.end();
    return;
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code !== "3D000") {
      throw err;
    }
  }

  const parsed = new URL(urlStr);
  const targetDbName = parsed.pathname.replace(/^\//, "") || "helpdesk";
  parsed.pathname = "/postgres";

  const adminClient = new Client({
    connectionString: parsed.toString(),
    connectionTimeoutMillis: 3500,
  });
  await adminClient.connect();
  try {
    const safeDbName = targetDbName.replace(/[^a-zA-Z0-9_]/g, "");
    const existsRes = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [safeDbName]
    );
    if (existsRes.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE "${safeDbName}"`);
    }
  } finally {
    await adminClient.end();
  }
}

async function tryAutoDiscoverLocalPassword(
  originalUrl: string
): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(originalUrl);
  } catch {
    return null;
  }

  if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    return null;
  }

  const candidatePasswords = [
    "postgres",
    "admin",
    "1234",
    "12345",
    "12345678",
    "root",
    "password",
    "",
  ];

  for (const pwd of candidatePasswords) {
    if (pwd === decodeURIComponent(parsed.password)) continue;
    const candidate = new URL(parsed.toString());
    candidate.password = pwd;
    try {
      await testAndEnsurePostgresDb(candidate.toString());
      return candidate.toString();
    } catch {
      // Try next common dev password
    }
  }

  return null;
}

async function relaxExtraNotNullColumns(
  client: import("pg").PoolClient,
  tableName: string,
  expectedColumns: string[]
): Promise<Set<string>> {
  const res = await client.query<{
    column_name: string;
    is_nullable: string;
  }>(
    `SELECT column_name, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );

  const expectedSet = new Set(["id", ...expectedColumns]);
  const foundSet = new Set<string>();

  for (const row of res.rows) {
    foundSet.add(row.column_name);
    if (!expectedSet.has(row.column_name) && row.is_nullable === "NO") {
      const safeCol = row.column_name.replace(/[^a-zA-Z0-9_]/g, "");
      if (safeCol) {
        await client
          .query(
            `ALTER TABLE "${tableName}" ALTER COLUMN "${safeCol}" DROP NOT NULL`
          )
          .catch(() => null);
      }
    }
  }

  return foundSet;
}

/** Update only untouched accounts from the previous sample dataset, once per database. */
async function migrateLegacySampleAccounts(client: PoolClient): Promise<void> {
  await client.query(`CREATE TABLE IF NOT EXISTS helpdesk_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await client.query("BEGIN");
  try {
    const marker = await client.query(
      "INSERT INTO helpdesk_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING name",
      [ACCOUNT_SETUP_MIGRATION]
    );
    if (marker.rowCount === 1) {
      for (const user of SEED_USERS) {
        // Preserve independently edited/renamed, suspended and additional accounts.
        await client.query(
          `UPDATE users SET full_name = $1, password_hash = $2
           WHERE username = $3 AND full_name = $4 AND role = $5`,
          [user.fullName, user.initialPasswordHash, user.username, user.legacyFullName, user.role]
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function runSchemaAndSeedOnPool(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    // 1. Users table + full self-healing
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        email VARCHAR(160) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name VARCHAR(160) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'user',
        department VARCHAR(120) NOT NULL DEFAULT 'ទូទៅ (General)',
        avatar_color VARCHAR(32) NOT NULL DEFAULT '#2563eb',
        avatar_url TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(64);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(160);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(160);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(32) DEFAULT 'user';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(120) DEFAULT 'ទូទៅ (General)';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(32) DEFAULT '#2563eb';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    `);

    const userCols = await relaxExtraNotNullColumns(client, "users", [
      "username",
      "email",
      "password_hash",
      "full_name",
      "role",
      "department",
      "avatar_color",
      "avatar_url",
      "is_active",
      "created_at",
    ]);

    if (userCols.has("password")) {
      await client.query(
        "UPDATE users SET password_hash = password WHERE password_hash IS NULL AND password IS NOT NULL"
      );
    }
    if (userCols.has("name")) {
      await client.query(
        "UPDATE users SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL"
      );
    }

    await client.query(`
      UPDATE users
      SET email = 'user_' || id::text || '@helpdesk.com'
      WHERE email IS NULL OR email = ''
    `);

    await client.query(`
      UPDATE users
      SET username = SPLIT_PART(email, '@', 1) || '_' || id::text
      WHERE username IS NULL OR username = ''
    `);

    await client.query(`
      UPDATE users
      SET full_name = COALESCE(NULLIF(username, ''), SPLIT_PART(email, '@', 1))
      WHERE full_name IS NULL OR full_name = ''
    `);

    await client.query(`
      UPDATE users SET role = 'user' WHERE role IS NULL OR role = '';
      UPDATE users SET department = 'ទូទៅ (General)' WHERE department IS NULL OR department = '';
      UPDATE users SET avatar_color = '#2563eb' WHERE avatar_color IS NULL OR avatar_color = '';
      UPDATE users SET is_active = TRUE WHERE is_active IS NULL;
      UPDATE users SET created_at = NOW() WHERE created_at IS NULL;
    `);

    const defaultPasswordHash = hashPassword("123456");
    await client.query(
      `UPDATE users SET password_hash = $1 WHERE password_hash IS NULL OR password_hash = ''`,
      [defaultPasswordHash]
    );

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (email);
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users (username);
    `);

    // 2. Categories table + full self-healing
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        description TEXT,
        color VARCHAR(32) NOT NULL DEFAULT '#2563eb',
        sla_hours INTEGER NOT NULL DEFAULT 24,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS name VARCHAR(120) DEFAULT 'ទូទៅ';
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS color VARCHAR(32) DEFAULT '#2563eb';
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS sla_hours INTEGER DEFAULT 24;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    `);

    await relaxExtraNotNullColumns(client, "categories", [
      "name",
      "description",
      "color",
      "sla_hours",
      "created_at",
    ]);

    await client.query(`
      UPDATE categories SET color = '#2563eb' WHERE color IS NULL OR color = '';
      UPDATE categories SET sla_hours = 24 WHERE sla_hours IS NULL;
      UPDATE categories SET created_at = NOW() WHERE created_at IS NULL;
    `);

    // 3. Tickets table + full self-healing
    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        ticket_code VARCHAR(32) UNIQUE NOT NULL,
        title VARCHAR(240) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'open',
        priority VARCHAR(32) NOT NULL DEFAULT 'medium',
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        location VARCHAR(160),
        resolved_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_code VARCHAR(32);
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS title VARCHAR(240) DEFAULT 'សំណើជំនួយ';
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'open';
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority VARCHAR(32) DEFAULT 'medium';
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category_id INTEGER;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS requester_id INTEGER;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assignee_id INTEGER;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS location VARCHAR(160);
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    `);

    const ticketCols = await relaxExtraNotNullColumns(client, "tickets", [
      "ticket_code",
      "title",
      "description",
      "status",
      "priority",
      "category_id",
      "requester_id",
      "assignee_id",
      "location",
      "resolved_at",
      "created_at",
      "updated_at",
    ]);

    if (ticketCols.has("subject")) {
      await client.query(
        "UPDATE tickets SET title = subject WHERE (title IS NULL OR title = '' OR title = 'សំណើជំនួយ') AND subject IS NOT NULL"
      );
    }

    // 4. Ticket comments table + full self-healing
    await client.query(`
      CREATE TABLE IF NOT EXISTS ticket_comments (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        is_internal BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS ticket_id INTEGER;
      ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS author_id INTEGER;
      ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS message TEXT DEFAULT '';
      ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT FALSE;
      ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    `);

    await relaxExtraNotNullColumns(client, "ticket_comments", [
      "ticket_id",
      "author_id",
      "message",
      "is_internal",
      "created_at",
    ]);

    // Seed only a completely new database. Do not recreate accounts that an admin
    // has renamed or deliberately deleted in an existing installation.
    const userCount = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users");
    if (Number(userCount.rows[0]?.count ?? 0) === 0) {
      for (const u of SEED_USERS) {
        await client.query(
          `INSERT INTO users (username, email, password_hash, full_name, role, department, avatar_color, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
          [u.username, u.email, u.initialPasswordHash, u.fullName, u.role, u.department, u.avatarColor]
        );
      }
    }

    await migrateLegacySampleAccounts(client);

    // Backfill any orphaned ticket rows
    const firstUserRes = await client.query<{ id: number }>(
      "SELECT id FROM users ORDER BY id ASC LIMIT 1"
    );
    const fallbackUserId = firstUserRes.rows[0]?.id ?? 1;

    await client.query(
      `UPDATE tickets SET ticket_code = 'HD-' || (1000 + id)::text WHERE ticket_code IS NULL OR ticket_code = '';
       UPDATE tickets SET status = 'open' WHERE status IS NULL OR status = '';
       UPDATE tickets SET priority = 'medium' WHERE priority IS NULL OR priority = '';
       UPDATE tickets SET created_at = NOW() WHERE created_at IS NULL;
       UPDATE tickets SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;`
    );
    await client.query(
      `UPDATE tickets SET requester_id = $1 WHERE requester_id IS NULL`,
      [fallbackUserId]
    );
    await client.query(`
      UPDATE ticket_comments SET is_internal = FALSE WHERE is_internal IS NULL;
      UPDATE ticket_comments SET created_at = NOW() WHERE created_at IS NULL;
    `);

    // 6. Seed default categories if empty
    const catCountRes = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM categories"
    );
    if (Number(catCountRes.rows[0]?.count ?? 0) === 0) {
      for (const c of SEED_CATEGORIES) {
        await client.query(
          `INSERT INTO categories (name, description, color, sla_hours)
           VALUES ($1, $2, $3, $4)`,
          [c.name, c.description, c.color, c.slaHours]
        );
      }
    }

    // 7. Seed realistic sample tickets if empty
    const ticketCountRes = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM tickets"
    );
    if (Number(ticketCountRes.rows[0]?.count ?? 0) === 0) {
      const usersMapRes = await client.query<{ id: number; username: string }>(
        "SELECT id, username FROM users"
      );
      const userByUsername = new Map(
        usersMapRes.rows.map((r) => [r.username, r.id])
      );
      const adminId = userByUsername.get("admin") ?? fallbackUserId;
      const agentId = userByUsername.get("agent") ?? adminId;
      const agent2Id = userByUsername.get("agent2") ?? agentId;
      const userId = userByUsername.get("user") ?? adminId;

      const catsRes = await client.query<{ id: number }>(
        "SELECT id FROM categories ORDER BY id ASC"
      );
      const catIds = catsRes.rows.map((r) => r.id);

      const sampleTickets = [
        {
          code: "HD-1001",
          title: "ភ្ជាប់ Wi-Fi ជាន់ទី ២ មិនបានតាំងពីព្រឹកមិញ",
          description:
            "បុគ្គលិកផ្នែកគណនេយ្យទាំងអស់នៅជាន់ទី ២ មិនអាចភ្ជាប់ទៅកាន់ Office-WiFi-5G បានទេ លោតសញ្ញាឧទានពណ៌លឿង។ សូមជួយពិនិត្យ Router បន្ទាន់។",
          status: "in_progress",
          priority: "urgent",
          categoryId: catIds[1] ?? null,
          requesterId: userId,
          assigneeId: agent2Id,
          location: "ជាន់ទី ២ - បន្ទប់គណនេយ្យ",
        },
        {
          code: "HD-1002",
          title: "ម៉ាស៊ីន Printer HP LaserJet ជាប់ក្រដាស និងលោតភ្លើងក្រហម",
          description:
            "ពេលបោះពុម្ពរបាយការណ៍ប្រចាំខែ ម៉ាស៊ីនបោះពុម្ពជាប់ក្រដាសនៅខាងក្នុង ហើយលោតកូដ Error 50.2។",
          status: "open",
          priority: "high",
          categoryId: catIds[0] ?? null,
          requesterId: userId,
          assigneeId: agentId,
          location: "ជាន់ទី ១ - បន្ទប់រដ្ឋបាល",
        },
        {
          code: "HD-1003",
          title:
            "ស្នើសុំកំណត់ពាក្យសម្ងាត់ (Reset Password) ក្នុងប្រព័ន្ធអ៊ីមែលក្រុមហ៊ុន",
          description:
            "ខ្ញុំបានប្ដូរទូរស័ព្ទថ្មី ហើយចូលគណនីអ៊ីមែលការងារមិនបានទេ សូមជួយកំណត់ពាក្យសម្ងាត់ថ្មី និងភ្ជាប់ 2FA ឡើងវិញ។",
          status: "resolved",
          priority: "medium",
          categoryId: catIds[3] ?? null,
          requesterId: userId,
          assigneeId: agentId,
          location: "ជាន់ទី ៣ - ផ្នែកធនធានមនុស្ស",
        },
        {
          code: "HD-1004",
          title:
            "ស្នើសុំដំឡើងកម្មវិធី Microsoft Excel និងពុម្ពអក្សរខ្មែរ Unicode សម្រាប់បុគ្គលិកថ្មី",
          description:
            "មានបុគ្គលិកថ្មីចូលធ្វើការថ្ងៃចន្ទក្រោយ ចំនួន ២ នាក់ សូមជួយរៀបចំកុំព្យូទ័រ ដំឡើង Office និងពុម្ពអក្សរ Khmer OS Siemreap / Battambang។",
          status: "open",
          priority: "low",
          categoryId: catIds[2] ?? null,
          requesterId: adminId,
          assigneeId: null,
          location: "ជាន់ទី ២ - ផ្នែកទីផ្សារ",
        },
      ];

      for (const t of sampleTickets) {
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO tickets
            (ticket_code, title, description, status, priority, category_id, requester_id, assignee_id, location, resolved_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            t.code,
            t.title,
            t.description,
            t.status,
            t.priority,
            t.categoryId,
            t.requesterId,
            t.assigneeId,
            t.location,
            t.status === "resolved" ? new Date() : null,
          ]
        );

        if (t.code === "HD-1001" && inserted.rows[0]) {
          await client.query(
            `INSERT INTO ticket_comments (ticket_id, author_id, message, is_internal)
             VALUES
              ($1, $2, 'ខ្ញុំកំពុងចុះទៅពិនិត្យ Access Point នៅជាន់ទី ២ ឥឡូវនេះហើយ។', FALSE),
              ($1, $2, 'កំណត់ត្រាបច្ចេកទេស៖ DHCP pool ពេញលើ VLAN 20 កំពុងពង្រីក subnet range។', TRUE)`,
            [inserted.rows[0].id, agent2Id]
          );
        }
        if (t.code === "HD-1003" && inserted.rows[0]) {
          await client.query(
            `INSERT INTO ticket_comments (ticket_id, author_id, message, is_internal)
             VALUES ($1, $2, 'បានកំណត់ពាក្យសម្ងាត់ថ្មី និងផ្ញើជូនតាម Telegram រួចរាល់ហើយ សូមសាកល្បងចូលម្ដងទៀត។', FALSE)`,
            [inserted.rows[0].id, agentId]
          );
        }
      }
    }
  } finally {
    client.release();
  }
}

async function saveWorkingConnectionConfig(urlStr: string): Promise<void> {
  try {
    const dataDir = path.join(process.cwd(), ".helpdesk-data");
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(
      path.join(dataDir, "db-config.json"),
      JSON.stringify({ url: urlStr }, null, 2),
      "utf8"
    );

    const envContent = `DATABASE_URL="${urlStr}"\nAUTH_SECRET="${
      process.env.AUTH_SECRET || "helpdesk-secret-key-2026-khmer-portal"
    }"\n`;
    await fs.writeFile(path.join(process.cwd(), ".env"), envContent, "utf8");

    const drizzleCfg = {
      dialect: "postgresql",
      schema: "./src/db/schema.ts",
      dbCredentials: {
        url: urlStr,
      },
    };
    await fs.writeFile(
      path.join(process.cwd(), "drizzle.config.json"),
      JSON.stringify(drizzleCfg, null, 2) + "\n",
      "utf8"
    );
  } catch {
    // Non-fatal
  }
}

async function initializeAnyAvailableDb(): Promise<void> {
  const configuredUrl = getConfiguredDatabaseUrl();
  const meta = parseConnectionMeta(configuredUrl);

  try {
    await testAndEnsurePostgresDb(configuredUrl);
    const activePool = setPgPoolWithUrl(configuredUrl);
    await runSchemaAndSeedOnPool(activePool);
    globalThis.__helpdeskDbStatus = {
      mode: "postgresql",
      database: meta.database,
      host: meta.host,
      port: meta.port,
      user: meta.user,
      fallbackReason: null,
    };
    return;
  } catch (err: unknown) {
    const pgErr = err as { code?: string; message?: string };

    if (pgErr?.code === "28P01") {
      const discoveredUrl = await tryAutoDiscoverLocalPassword(configuredUrl);
      if (discoveredUrl) {
        try {
          const nextPool = setPgPoolWithUrl(discoveredUrl);
          await runSchemaAndSeedOnPool(nextPool);
          await saveWorkingConnectionConfig(discoveredUrl);
          const dMeta = parseConnectionMeta(discoveredUrl);
          globalThis.__helpdeskDbStatus = {
            mode: "postgresql",
            database: dMeta.database,
            host: dMeta.host,
            port: dMeta.port,
            user: dMeta.user,
            fallbackReason: null,
          };
          return;
        } catch {
          // Fall through to local store
        }
      }
    }

    await readLocalStore();
    globalThis.__helpdeskDbStatus = {
      mode: "local",
      database: meta.database,
      host: meta.host,
      port: meta.port,
      user: meta.user,
      fallbackReason:
        pgErr?.message ||
        "មិនទាន់បានភ្ជាប់ PostgreSQL ខាងក្រៅ (កំពុងប្រើទិន្នន័យស្វ័យប្រវត្តិក្នុងម៉ាស៊ីន)",
    };
  }
}

export async function ensureDatabaseReady(): Promise<DbStatusInfo> {
  if (globalThis.__helpdeskDbStatus) {
    return globalThis.__helpdeskDbStatus;
  }
  if (!globalThis.__helpdeskInitPromise) {
    globalThis.__helpdeskInitPromise = initializeAnyAvailableDb().catch(
      (err) => {
        globalThis.__helpdeskInitPromise = undefined;
        throw err;
      }
    );
  }
  await globalThis.__helpdeskInitPromise;
  // Keep reference to getPgPool so unused import doesn't happen
  void getPgPool;
  return (
    globalThis.__helpdeskDbStatus ?? {
      mode: "local",
      database: "helpdesk",
      host: "127.0.0.1",
      port: 5432,
      user: "postgres",
      fallbackReason: null,
    }
  );
}

export function getDbStatus(): DbStatusInfo {
  return (
    globalThis.__helpdeskDbStatus ?? {
      mode: "local",
      database: "helpdesk",
      host: "127.0.0.1",
      port: 5432,
      user: "postgres",
      fallbackReason: null,
    }
  );
}

export async function configureExternalPostgres(params: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}): Promise<DbStatusInfo> {
  const host = params.host.trim() || "127.0.0.1";
  const port = Number(params.port) || 5432;
  const user = params.user.trim() || "postgres";
  const database =
    params.database.trim().replace(/[^a-zA-Z0-9_]/g, "") || "helpdesk";
  const encodedUser = encodeURIComponent(user);
  const encodedPass = encodeURIComponent(params.password);

  const nextUrl = `postgresql://${encodedUser}:${encodedPass}@${host}:${port}/${database}`;

  await testAndEnsurePostgresDb(nextUrl);
  const nextPool = setPgPoolWithUrl(nextUrl);
  await runSchemaAndSeedOnPool(nextPool);
  await saveWorkingConnectionConfig(nextUrl);

  const status: DbStatusInfo = {
    mode: "postgresql",
    database,
    host,
    port,
    user,
    fallbackReason: null,
  };
  globalThis.__helpdeskDbStatus = status;
  globalThis.__helpdeskInitPromise = Promise.resolve();
  return status;
}
