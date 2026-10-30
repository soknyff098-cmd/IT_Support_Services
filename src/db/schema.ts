import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  role: varchar("role", { length: 32 }).notNull().default("user"), // "admin" | "agent" | "user"
  department: varchar("department", { length: 120 }).notNull().default("ទូទៅ (General)"),
  avatarColor: varchar("avatar_color", { length: 32 }).notNull().default("#2563eb"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 32 }).notNull().default("#2563eb"),
  slaHours: integer("sla_hours").notNull().default(24),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  ticketCode: varchar("ticket_code", { length: 32 }).notNull().unique(),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("open"), // "open" | "in_progress" | "resolved" | "closed"
  priority: varchar("priority", { length: 32 }).notNull().default("medium"), // "low" | "medium" | "high" | "urgent"
  categoryId: integer("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  requesterId: integer("requester_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  assigneeId: integer("assignee_id").references(() => users.id, {
    onDelete: "set null",
  }),
  location: varchar("location", { length: 160 }),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ticketComments = pgTable("ticket_comments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  isInternal: boolean("is_internal").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type TicketComment = typeof ticketComments.$inferSelect;
