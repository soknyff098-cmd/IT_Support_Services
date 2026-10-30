import type { EnrichedTicket } from "./tickets";

/** SLA is measured from creation to the category's configured target. */
export function getTicketDueAt(ticket: EnrichedTicket): number | null {
  const created = Date.parse(ticket.createdAt);
  const hours = ticket.category?.slaHours;
  if (!Number.isFinite(created) || typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0) {
    return null;
  }
  return created + hours * 60 * 60 * 1000;
}

export function isTicketOverdue(ticket: EnrichedTicket, now: number): boolean {
  if (!now || ticket.status === "resolved" || ticket.status === "closed") return false;
  const deadline = getTicketDueAt(ticket);
  return deadline !== null && deadline < now;
}

// A stable primitive snapshot avoids server/client timezone hydration mismatches.
export function subscribeToClock(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(timer);
}

export function getClockMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

export function getServerClockMinute(): number {
  return 0;
}
