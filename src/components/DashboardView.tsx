"use client";

import React, { useMemo, useState } from "react";
import type { SafeUser } from "@/lib/auth";
import type { EnrichedTicket } from "@/lib/tickets";
import { PRIORITY_CONFIG } from "@/lib/constants";
import { getTicketDueAt, isTicketOverdue } from "@/lib/dashboard";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  InboxIcon,
  PlusIcon,
  TicketIcon,
} from "./Icons";
import { UserAvatar } from "./UserAvatar";

export type DashboardFilter = "all" | "completed" | "in_progress" | "overdue";
type ListFilter = "all" | "open" | "in_progress" | "completed";

interface DashboardViewProps {
  currentUser: SafeUser;
  tickets: EnrichedTicket[];
  users: SafeUser[];
  now: number;
  onCreate: () => void;
  onManageUsers: () => void;
  onOpenTicket: (id: number) => void;
  onShowTickets: (filter: DashboardFilter) => void;
}

const WEEKDAYS = ["អា", "ច", "អ", "ព", "ព្រ", "សុ", "ស"];
const MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDate(value: string | number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function dueDate(value: number): string {
  const date = new Date(value);
  return `${shortDate(value)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function displayName(fullName: string): string {
  return fullName.replace(/\s*\([^)]*\)\s*$/, "").trim() || fullName;
}

export default function DashboardView({ currentUser, tickets, users, now, onCreate, onManageUsers, onOpenTicket, onShowTickets }: DashboardViewProps) {
  const [listFilter, setListFilter] = useState<ListFilter>("all");

  const summary = useMemo(() => {
    const completed = tickets.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed").length;
    const inProgress = tickets.filter((ticket) => ticket.status === "in_progress").length;
    const overdue = tickets.filter((ticket) => isTicketOverdue(ticket, now)).length;
    return { total: tickets.length, completed, inProgress, overdue };
  }, [tickets, now]);

  const visibleTickets = useMemo(() => tickets.filter((ticket) => {
    if (listFilter === "completed") return ticket.status === "resolved" || ticket.status === "closed";
    return listFilter === "all" || ticket.status === listFilter;
  }).slice(0, 5), [tickets, listFilter]);

  const metrics: {
    label: string;
    value: number;
    detail: string;
    filter: DashboardFilter;
    tone: string;
    icon: React.ReactNode;
  }[] = [
    { label: "សំណើសរុប", value: summary.total, detail: "សំណើទាំងអស់", filter: "all", tone: "purple", icon: <InboxIcon className="w-6 h-6" /> },
    { label: "ដោះស្រាយរួច", value: summary.completed, detail: "រួចរាល់ និងបានបិទ", filter: "completed", tone: "green", icon: <CheckCircleIcon className="w-6 h-6" /> },
    { label: "កំពុងដំណើរការ", value: summary.inProgress, detail: "កំពុងតាមដាន", filter: "in_progress", tone: "amber", icon: <ClockIcon className="w-6 h-6" /> },
    { label: "លើសពេល SLA", value: summary.overdue, detail: "ត្រូវការពិនិត្យ", filter: "overdue", tone: "rose", icon: <AlertCircleIcon className="w-6 h-6" /> },
  ];

  return (
    <div className="dashboard-layout">
      <div className="dashboard-primary">
        <div className="dashboard-welcome">
          <div className="min-w-0">
            <p className="dashboard-eyebrow">ផ្ទាំងគ្រប់គ្រង</p>
            <h2>សួស្ដី, {displayName(currentUser.fullName)}</h2>
            <p className="dashboard-subtitle">នេះជាទិដ្ឋភាពសំណើជំនួយ និងការងាររបស់អ្នកនៅថ្ងៃនេះ។</p>
          </div>
          <button type="button" onClick={onCreate} className="dashboard-primary-button">
            <PlusIcon className="w-4 h-4" />
            <span>បង្កើតសំណើថ្មី</span>
          </button>
        </div>

        <div className="dashboard-metrics" aria-label="សង្ខេបសំណើ">
          {metrics.map((metric) => (
            <button key={metric.filter} type="button" onClick={() => onShowTickets(metric.filter)} className={`dashboard-metric metric-${metric.tone}`}>
              <span className="dashboard-metric-icon" aria-hidden="true">{metric.icon}</span>
              <span className="dashboard-metric-copy">
                <span className="dashboard-metric-label">{metric.label}</span>
                <strong className="dashboard-metric-number">{metric.value}</strong>
                <span className="dashboard-metric-detail">{metric.detail}</span>
              </span>
            </button>
          ))}
        </div>

        <section className="dashboard-card dashboard-ticket-panel" aria-labelledby="recent-heading">
          <div className="dashboard-panel-heading">
            <div>
              <h3 id="recent-heading">សំណើជំនួយថ្មីៗ</h3>
              <p>តាមដានការងារដែលមានក្នុងប្រព័ន្ធ</p>
            </div>
            <button type="button" onClick={() => onShowTickets("all")} className="dashboard-text-link">
              មើលទាំងអស់ <ArrowRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="dashboard-list-tabs" aria-label="ច្រោះសំណើថ្មីៗ">
            {([
              { id: "all", label: "ទាំងអស់" },
              { id: "open", label: "រង់ចាំ" },
              { id: "in_progress", label: "កំពុងធ្វើ" },
              { id: "completed", label: "រួចរាល់" },
            ] as const).map((tab) => (
              <button key={tab.id} type="button" onClick={() => setListFilter(tab.id)} aria-pressed={listFilter === tab.id} className={listFilter === tab.id ? "is-active" : ""}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="dashboard-ticket-list">
            {visibleTickets.length === 0 ? (
              <div className="dashboard-empty">មិនមានសំណើក្នុងបញ្ជីនេះទេ។</div>
            ) : visibleTickets.map((ticket) => (
              <button key={ticket.id} type="button" className="dashboard-ticket-row" onClick={() => onOpenTicket(ticket.id)}>
                <span className={`dashboard-ticket-state ${ticket.status === "resolved" || ticket.status === "closed" ? "is-done" : ""}`} aria-hidden="true">
                  {ticket.status === "resolved" || ticket.status === "closed" ? <CheckCircleIcon className="w-4 h-4" /> : <span />}
                </span>
                <span className="dashboard-ticket-title-wrap">
                  <span className="dashboard-ticket-title" title={ticket.title}>{ticket.title}</span>
                  <span className="dashboard-ticket-meta">{ticket.ticketCode} <span>·</span> {displayName(ticket.requester.fullName)}</span>
                </span>
                <span className="dashboard-category" title={ticket.category?.name || "ទូទៅ"}>{ticket.category?.name || "ទូទៅ"}</span>
                <span className="dashboard-ticket-date">{shortDate(ticket.createdAt)}</span>
                <span className={`dashboard-priority priority-${ticket.priority}`}>{PRIORITY_CONFIG[ticket.priority].short}</span>
                <ArrowRightIcon className="dashboard-row-arrow w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </section>

        <div className="dashboard-chart-grid">
          <ActivityChart tickets={tickets} now={now} />
          <PriorityChart tickets={tickets} />
        </div>
      </div>

      <aside className="dashboard-aside" aria-label="ព័ត៌មានបន្ថែម">
        <CalendarCard now={now} />
        <ProgressCard completed={summary.completed} total={summary.total} />
        <UpcomingCard tickets={tickets} now={now} onOpenTicket={onOpenTicket} onShowAll={() => onShowTickets("all")} />
        <TeamWorkload users={users} tickets={tickets} isAdmin={currentUser.role === "admin"} onManageUsers={onManageUsers} />
      </aside>
    </div>
  );
}

function ActivityChart({ tickets, now }: { tickets: EnrichedTicket[]; now: number }) {
  const days = useMemo(() => {
    if (!now) return [];
    const today = new Date(now);
    const byDay = new Map<string, number>();
    for (const ticket of tickets) {
      const date = new Date(ticket.createdAt);
      if (!Number.isNaN(date.getTime())) {
        const key = localDateKey(date);
        byDay.set(key, (byDay.get(key) ?? 0) + 1);
      }
    }
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index);
      return { key: localDateKey(date), label: WEEKDAYS[date.getDay()], date: shortDate(date.getTime()), count: byDay.get(localDateKey(date)) ?? 0 };
    });
  }, [tickets, now]);

  const max = Math.ceil(Math.max(4, ...days.map((day) => day.count)) / 2) * 2;
  const points = days.map((day, index) => ({ x: 12 + index * 49.3, y: 106 - (day.count / max) * 82, ...day }));
  const line = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const middleX = (previous.x + point.x) / 2;
    return `${path} C ${middleX} ${previous.y}, ${middleX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
  const area = points.length ? `${line} L ${points[points.length - 1].x} 114 L ${points[0].x} 114 Z` : "";
  const total = days.reduce((sum, day) => sum + day.count, 0);

  return (
    <section className="dashboard-card dashboard-chart-card" aria-labelledby="activity-heading">
      <div className="dashboard-panel-heading">
        <div><h3 id="activity-heading">ទិដ្ឋភាពសំណើ</h3><p>សំណើដែលបានបង្កើតក្នុង ៧ ថ្ងៃ</p></div>
        <span className="dashboard-period">៧ ថ្ងៃ</span>
      </div>
      <div className="dashboard-line-chart">
        <div className="dashboard-y-labels" aria-hidden="true"><span>{max}</span><span>{Math.round(max / 2)}</span><span>0</span></div>
        <svg viewBox="0 0 320 120" preserveAspectRatio="none" role="img" aria-label={`មានសំណើ ${total} ក្នុងរយៈពេល ៧ ថ្ងៃចុងក្រោយ`}>
          <defs><linearGradient id="activity-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8b7bec" stopOpacity="0.24" /><stop offset="100%" stopColor="#8b7bec" stopOpacity="0.02" /></linearGradient></defs>
          {[24, 65, 106].map((y) => <line key={y} x1="12" x2="308" y1={y} y2={y} stroke="#efedf5" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          {area && <path d={area} fill="url(#activity-fill)" />}
          {line && <path d={line} fill="none" stroke="#8371e6" strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
          {points.map((point) => <circle key={point.key} cx={point.x} cy={point.y} r="3" fill="#8371e6" stroke="#fff" strokeWidth="1.3"><title>{point.date}: {point.count} សំណើ</title></circle>)}
        </svg>
      </div>
      <div className="dashboard-x-labels" aria-hidden="true">{days.map((day) => <span key={day.key}>{day.label}</span>)}</div>
    </section>
  );
}

function PriorityChart({ tickets }: { tickets: EnrichedTicket[] }) {
  const groups = [
    { label: "បន្ទាន់", count: tickets.filter((t) => t.priority === "urgent").length, color: "#dc7f9c" },
    { label: "ខ្ពស់", count: tickets.filter((t) => t.priority === "high").length, color: "#edacbc" },
    { label: "មធ្យម", count: tickets.filter((t) => t.priority === "medium").length, color: "#e8bd6c" },
    { label: "ទាប", count: tickets.filter((t) => t.priority === "low").length, color: "#86c9ad" },
  ];
  let start = 0;
  const segments = groups.map((group) => {
    const from = start;
    start += tickets.length ? (group.count / tickets.length) * 100 : 0;
    return `${group.color} ${from}% ${start}%`;
  });
  const background = tickets.length ? `conic-gradient(${segments.join(", ")})` : "#efedf6";

  return (
    <section className="dashboard-card dashboard-chart-card" aria-labelledby="priority-heading">
      <div className="dashboard-panel-heading"><div><h3 id="priority-heading">សំណើតាមអាទិភាព</h3><p>ទិន្នន័យសំណើសរុប</p></div></div>
      <div className="dashboard-priority-chart">
        <div className="dashboard-donut" style={{ background }} role="img" aria-label={`សំណើសរុប ${tickets.length}`}>
          <div className="dashboard-donut-center"><strong>{tickets.length}</strong><span>សំណើ</span></div>
        </div>
        <div className="dashboard-legend">
          {groups.map((group) => (
            <div className="dashboard-legend-row" key={group.label}>
              <span className="dashboard-legend-name"><i style={{ backgroundColor: group.color }} />{group.label}</span>
              <span className="dashboard-legend-value">{group.count} <small>({tickets.length ? Math.round(group.count / tickets.length * 100) : 0}%)</small></span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CalendarCard({ now }: { now: number }) {
  const [monthOffset, setMonthOffset] = useState(0);
  if (!now) return <section className="dashboard-card dashboard-calendar" aria-label="ប្រតិទិន" />;
  const today = new Date(now);
  const month = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = month.getDay();
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const prevCount = new Date(year, monthIndex, 0).getDate();
  const cells = Math.ceil((first + count) / 7) * 7;
  const title = `ខែ${MONTHS[monthIndex]} ${year}`;

  return (
    <section className="dashboard-card dashboard-calendar" aria-labelledby="calendar-heading">
      <div className="dashboard-panel-heading">
        <h3 id="calendar-heading">ប្រតិទិន</h3>
        <div className="dashboard-calendar-controls">
          <button type="button" onClick={() => setMonthOffset((value) => value - 1)} aria-label="ខែមុន"><ArrowLeftIcon className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => setMonthOffset((value) => value + 1)} aria-label="ខែបន្ទាប់"><ArrowRightIcon className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="dashboard-calendar-month"><span>{title}</span>{monthOffset !== 0 && <button type="button" onClick={() => setMonthOffset(0)}>ថ្ងៃនេះ</button>}</div>
      <table className="dashboard-calendar-table">
        <caption className="sr-only">ប្រតិទិន {title}</caption>
        <thead><tr>{WEEKDAYS.map((day, i) => <th key={`${day}-${i}`} scope="col">{day}</th>)}</tr></thead>
        <tbody>{Array.from({ length: cells / 7 }, (_, week) => (
          <tr key={week}>{Array.from({ length: 7 }, (_, weekday) => {
            const index = week * 7 + weekday;
            const number = index - first + 1;
            const outside = number < 1 || number > count;
            const shown = number < 1 ? prevCount + number : number > count ? number - count : number;
            const isToday = !outside && year === today.getFullYear() && monthIndex === today.getMonth() && number === today.getDate();
            return <td key={index} aria-current={isToday ? "date" : undefined} className={`${outside ? "is-outside" : ""} ${isToday ? "is-today" : ""}`}><span>{shown}</span></td>;
          })}</tr>
        ))}</tbody>
      </table>
    </section>
  );
}

function ProgressCard({ completed, total }: { completed: number; total: number }) {
  const percent = total ? Math.round(completed / total * 100) : 0;
  return (
    <section className="dashboard-card dashboard-progress" aria-labelledby="progress-heading">
      <div className="dashboard-panel-heading"><h3 id="progress-heading">វឌ្ឍនភាព</h3></div>
      <div className="dashboard-progress-label"><span>សំណើដែលរួចរាល់</span><strong>{percent}%</strong></div>
      <div className="dashboard-progress-track" role="progressbar" aria-label="សំណើដែលរួចរាល់" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
      <p>{completed} ក្នុងចំណោម {total} សំណើ</p>
    </section>
  );
}

function UpcomingCard({ tickets, now, onOpenTicket, onShowAll }: { tickets: EnrichedTicket[]; now: number; onOpenTicket: (id: number) => void; onShowAll: () => void }) {
  const pending = tickets.filter((ticket) => ticket.status === "open" || ticket.status === "in_progress")
    .sort((a, b) => (getTicketDueAt(a) ?? Number.MAX_SAFE_INTEGER) - (getTicketDueAt(b) ?? Number.MAX_SAFE_INTEGER) || Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 3);
  return (
    <section className="dashboard-card dashboard-upcoming" aria-labelledby="upcoming-heading">
      <div className="dashboard-panel-heading"><div><h3 id="upcoming-heading">សំណើត្រូវតាមដាន</h3><p>តាមពេលកំណត់ SLA</p></div></div>
      <div className="dashboard-upcoming-list">
        {pending.length === 0 ? <div className="dashboard-upcoming-empty">គ្មានសំណើកំពុងរង់ចាំទេ។</div> : pending.map((ticket, index) => {
          const due = getTicketDueAt(ticket);
          const overdue = isTicketOverdue(ticket, now);
          return (
            <button key={ticket.id} type="button" onClick={() => onOpenTicket(ticket.id)} className="dashboard-upcoming-row">
              <span className={`dashboard-upcoming-icon tone-${index}`} aria-hidden="true">{overdue ? <AlertCircleIcon className="w-4 h-4" /> : <TicketIcon className="w-4 h-4" />}</span>
              <span className="dashboard-upcoming-copy"><strong title={ticket.title}>{ticket.title}</strong><span title={due ? dueDate(due) : ""}>{due ? `${overdue ? "លើស SLA" : "ផុតកំណត់"} · ${dueDate(due)}` : `${ticket.ticketCode} · មិនមាន SLA`}</span></span>
              <span className={`dashboard-priority priority-${ticket.priority}`}>{PRIORITY_CONFIG[ticket.priority].short}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="dashboard-upcoming-link" onClick={onShowAll}>មើលសំណើទាំងអស់ <ArrowRightIcon className="w-4 h-4" /></button>
    </section>
  );
}

function TeamWorkload({ users, tickets, isAdmin, onManageUsers }: { users: SafeUser[]; tickets: EnrichedTicket[]; isAdmin: boolean; onManageUsers: () => void }) {
  const counts = new Map<number, { active: number; completed: number }>();
  for (const ticket of tickets) {
    if (!ticket.assigneeId) continue;
    const count = counts.get(ticket.assigneeId) ?? { active: 0, completed: 0 };
    if (ticket.status === "open" || ticket.status === "in_progress") count.active += 1;
    else count.completed += 1;
    counts.set(ticket.assigneeId, count);
  }
  const team = users.filter((user) => user.role === "admin" || user.role === "agent");
  return (
    <details className="dashboard-card dashboard-team">
      <summary><span>ក្រុមការងារបច្ចេកទេស</span><ChevronDownIcon className="w-4 h-4" /></summary>
      <div className="dashboard-team-body">
        <p>ផ្អែកលើសំណើដែលអ្នកអាចមើលបាន</p>
        <div className="dashboard-team-list">
          {team.length === 0 ? <div className="dashboard-team-empty">មិនមានសមាជិកក្រុមការងារទេ។</div> : team.map((user) => {
            const count = counts.get(user.id) ?? { active: 0, completed: 0 };
            return (
              <div className="dashboard-team-row" key={user.id}>
                <UserAvatar name={user.fullName} avatarColor={user.avatarColor} avatarUrl={user.avatarUrl} size="sm" />
                <div className="dashboard-team-copy">
                  <strong title={user.fullName}>{user.fullName}</strong>
                  <span>{count.active} កំពុងតាមដាន · {count.completed} រួច{!user.isActive ? " · បានផ្អាក" : ""}</span>
                </div>
              </div>
            );
          })}
        </div>
        {isAdmin && <button type="button" onClick={onManageUsers} className="dashboard-upcoming-link">គ្រប់គ្រងអ្នកប្រើប្រាស់ <ArrowRightIcon className="w-4 h-4" /></button>}
      </div>
    </details>
  );
}
