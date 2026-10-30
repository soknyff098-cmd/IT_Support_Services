"use client";

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Category } from "@/db/schema";
import type { SafeUser } from "@/lib/auth";
import type { EnrichedTicket } from "@/lib/tickets";
import { apiFetch, setClientToken } from "@/lib/api-client";
import { getClockMinute, getServerClockMinute, isTicketOverdue, subscribeToClock } from "@/lib/dashboard";
import {
  formatDateTime,
  PRIORITY_CONFIG,
  ROLE_CONFIG,
  STATUS_CONFIG,
} from "@/lib/constants";
import AuthScreen from "./AuthScreen";
import DashboardView, { type DashboardFilter } from "./DashboardView";
import CreateTicketModal from "./CreateTicketModal";
import TicketDetailModal from "./TicketDetailModal";
import CategoriesView from "./CategoriesView";
import UsersAndProfileView from "./UsersAndProfileView";
import { UserAvatar } from "./UserAvatar";
import DbConfigModal from "./DbConfigModal";
import { ConfirmModal, ToastContainer, type ToastItem } from "./Toast";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  DatabaseIcon,
  DownloadIcon,
  KanbanIcon,
  LayoutDashboardIcon,
  LogoMarkIcon,
  LogOutIcon,
  MapPinIcon,
  MenuIcon,
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  TagIcon,
  TicketIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from "./Icons";

type ActiveTab =
  | "dashboard"
  | "tickets"
  | "kanban"
  | "categories"
  | "users"
  | "profile";

interface DbHealthState {
  mode: "postgresql" | "local";
  database: string;
  host: string;
  port: number;
  user: string;
  fallbackReason: string | null;
}

export default function HelpdeskApp() {
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<SafeUser | null>(null);
  const [switchPassword, setSwitchPassword] = useState("");
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const [tickets, setTickets] = useState<EnrichedTicket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [usersList, setUsersList] = useState<SafeUser[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);

  const [dbState, setDbState] = useState<DbHealthState>({
    mode: "postgresql",
    database: "helpdesk",
    host: "127.0.0.1",
    port: 5432,
    user: "postgres",
    fallbackReason: null,
  });
  const [showDbModal, setShowDbModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [onlyAssignedToMe, setOnlyAssignedToMe] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const now = useSyncExternalStore(subscribeToClock, getClockMinute, getServerClockMinute) * 60_000;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [deletingTicket, setDeletingTicket] = useState<EnrichedTicket | null>(
    null
  );
  const [deletingTicketBusy, setDeletingTicketBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback(
    (type: "success" | "error" | "info", message: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 3600);
    },
    []
  );

  const fetchAllWorkspaceData = useCallback(async () => {
    const [ticketsRes, catsRes, usersRes, healthRes] = await Promise.all([
      apiFetch<{ ok: boolean; tickets?: EnrichedTicket[]; error?: string }>(
        "/api/tickets"
      ),
      apiFetch<{ ok: boolean; categories?: Category[]; error?: string }>(
        "/api/categories"
      ),
      apiFetch<{ ok: boolean; users?: SafeUser[]; error?: string }>(
        "/api/users"
      ),
      apiFetch<{
        ok: boolean;
        mode?: "postgresql" | "local";
        database?: string;
        host?: string;
        port?: number;
        user?: string;
        fallbackReason?: string | null;
      }>("/api/health"),
    ]);

    return { ticketsRes, catsRes, usersRes, healthRes };
  }, []);

  const loadWorkspaceData = useCallback(async () => {
    setLoadingData(true);
    try {
      const { ticketsRes, catsRes, usersRes, healthRes } =
        await fetchAllWorkspaceData();
      if (ticketsRes.data.ok && ticketsRes.data.tickets) {
        setTickets(ticketsRes.data.tickets);
      } else if (ticketsRes.data.error) {
        notify("error", ticketsRes.data.error);
      }
      if (catsRes.data.ok && catsRes.data.categories) {
        setCategories(catsRes.data.categories);
      }
      if (usersRes.data.ok && usersRes.data.users) {
        const freshUsers = usersRes.data.users;
        setUsersList(freshUsers);
        setCurrentUser((previous) => {
          if (!previous) return previous;
          const fresh = freshUsers.find((user) => user.id === previous.id);
          if (!fresh) return previous;
          return previous.fullName === fresh.fullName &&
            previous.username === fresh.username &&
            previous.email === fresh.email &&
            previous.department === fresh.department &&
            previous.role === fresh.role &&
            previous.isActive === fresh.isActive &&
            previous.avatarColor === fresh.avatarColor &&
            previous.avatarUrl === fresh.avatarUrl
            ? previous
            : fresh;
        });
      }
      if (healthRes.data.ok) {
        setDbState({
          mode: healthRes.data.mode ?? "postgresql",
          database: healthRes.data.database ?? "helpdesk",
          host: healthRes.data.host ?? "127.0.0.1",
          port: healthRes.data.port ?? 5432,
          user: healthRes.data.user ?? "postgres",
          fallbackReason: healthRes.data.fallbackReason ?? null,
        });
      }
    } finally {
      setLoadingData(false);
    }
  }, [fetchAllWorkspaceData, notify]);

  useEffect(() => {
    let active = true;
    apiFetch<{ ok: boolean; user?: SafeUser | null }>("/api/auth/me")
      .then(({ status, data }) => {
        if (!active) return;
        if (status >= 200 && status < 300 && data.ok && data.user) {
          setCurrentUser(data.user);
        } else {
          if (status === 401) setClientToken(null);
          setCurrentUser(null);
        }
      })
      .catch(() => {
        if (active) setCurrentUser(null);
      })
      .finally(() => {
        if (active) setCheckingAuth(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    fetchAllWorkspaceData()
      .then(({ ticketsRes, catsRes, usersRes, healthRes }) => {
        if (!active) return;
        if (ticketsRes.data.ok && ticketsRes.data.tickets) {
          setTickets(ticketsRes.data.tickets);
        }
        if (catsRes.data.ok && catsRes.data.categories) {
          setCategories(catsRes.data.categories);
        }
        if (usersRes.data.ok && usersRes.data.users) {
          setUsersList(usersRes.data.users);
        }
        if (healthRes.data.ok) {
          setDbState({
            mode: healthRes.data.mode ?? "postgresql",
            database: healthRes.data.database ?? "helpdesk",
            host: healthRes.data.host ?? "127.0.0.1",
            port: healthRes.data.port ?? 5432,
            user: healthRes.data.user ?? "postgres",
            fallbackReason: healthRes.data.fallbackReason ?? null,
          });
        }
      })
      .catch(() => {
        if (active) notify("error", "មិនអាចទាញយកទិន្នន័យបានទេ សូមសាកល្បងផ្ទុកឡើងវិញ។");
      })
      .finally(() => {
        if (active) setWorkspaceLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [currentUser, fetchAllWorkspaceData, notify]);

  async function handleLogout() {
    setRoleMenuOpen(false);
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    setClientToken(null);
    setCurrentUser(null);
    setWorkspaceLoaded(false);
    setTickets([]);
    setCategories([]);
    setUsersList([]);
    setOnlyOverdue(false);
    setStatusFilter("all");
    setSelectedTicketId(null);
    setShowCreateModal(false);
    setActiveTab("dashboard");
  }

  function openAccountSwitch(targetUser: SafeUser) {
    setRoleMenuOpen(false);
    if (targetUser.id === currentUser?.id) return;
    setSwitchPassword("");
    setSwitchError(null);
    setSwitchTarget(targetUser);
  }

  async function confirmAccountSwitch(event: React.FormEvent) {
    event.preventDefault();
    if (!switchTarget || switching) return;
    setSwitching(true);
    setSwitchError(null);
    try {
      const { status, data } = await apiFetch<{
        ok: boolean;
        token?: string;
        user?: SafeUser;
        error?: string;
      }>("/api/auth/switch", {
        method: "POST",
        body: JSON.stringify({ userId: switchTarget.id, password: switchPassword }),
      });

      if (status >= 200 && status < 300 && data.ok && data.user) {
        if (data.token) setClientToken(data.token);
        setWorkspaceLoaded(false);
        setOnlyOverdue(false);
        setStatusFilter("all");
        setCurrentUser(data.user);
        setSwitchTarget(null);
        setSwitchPassword("");
        if (data.user.role !== "admin" && activeTab === "users") {
          setActiveTab("dashboard");
        }
        notify("success", `បានប្ដូរទៅគណនី ${data.user.fullName}`);
      } else {
        setSwitchError(data.error || "មិនអាចប្ដូរគណនីបានទេ។");
      }
    } catch {
      setSwitchError("មានបញ្ហាបណ្ដាញ មិនអាចប្ដូរគណនីបានទេ។");
    } finally {
      setSwitching(false);
    }
  }

  async function quickPatchTicket(
    ticketId: number,
    payload: Record<string, unknown>,
    successMsg: string
  ) {
    const { status, data } = await apiFetch<{
      ok: boolean;
      ticket?: EnrichedTicket;
      error?: string;
    }>(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    if (status >= 200 && status < 300 && data.ok && data.ticket) {
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? data.ticket! : t))
      );
      notify("success", successMsg);
    } else {
      notify("error", data.error || "មិនអាចកែប្រែសំណើបានទេ។");
    }
  }

  async function confirmDeleteTicketFromRow() {
    if (!deletingTicket) return;
    setDeletingTicketBusy(true);
    try {
      const { status, data } = await apiFetch<{ ok: boolean; error?: string }>(
        `/api/tickets/${deletingTicket.id}`,
        { method: "DELETE" }
      );
      if (status >= 200 && status < 300 && data.ok) {
        setTickets((prev) => prev.filter((t) => t.id !== deletingTicket.id));
        notify("success", `បានលុបសំណើ ${deletingTicket.ticketCode}`);
        setDeletingTicket(null);
      } else {
        notify("error", data.error || "មិនអាចលុបសំណើបានទេ។");
      }
    } finally {
      setDeletingTicketBusy(false);
    }
  }

  const stats = useMemo(() => ({
    open: tickets.filter((ticket) => ticket.status === "open").length,
    inProgress: tickets.filter((ticket) => ticket.status === "in_progress").length,
  }), [tickets]);

  function showDashboardTickets(filter: DashboardFilter) {
    setSearchQuery("");
    setPriorityFilter("all");
    setCategoryFilter("all");
    setOnlyAssignedToMe(false);
    setOnlyOverdue(filter === "overdue");
    setStatusFilter(filter === "completed" || filter === "in_progress" ? filter : "all");
    setActiveTab("tickets");
  }

  const currentUserId = currentUser?.id ?? null;

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter === "completed" && t.status !== "resolved" && t.status !== "closed") return false;
      if (statusFilter !== "all" && statusFilter !== "completed" && t.status !== statusFilter) return false;
      if (onlyOverdue && !isTicketOverdue(t, now)) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter)
        return false;
      if (
        categoryFilter !== "all" &&
        String(t.categoryId ?? "") !== categoryFilter
      ) {
        return false;
      }
      if (
        onlyAssignedToMe &&
        currentUserId !== null &&
        t.assigneeId !== currentUserId
      ) {
        return false;
      }
      if (q) {
        const hay = [
          t.ticketCode,
          t.title,
          t.description,
          t.requester.fullName,
          t.assignee?.fullName ?? "",
          t.location ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    tickets,
    searchQuery,
    statusFilter,
    priorityFilter,
    categoryFilter,
    onlyAssignedToMe,
    onlyOverdue,
    now,
    currentUserId,
  ]);

  // Board search stays available, without inheriting invisible ticket-list filters.
  const kanbanTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tickets;
    return tickets.filter((ticket) => [ticket.ticketCode, ticket.title, ticket.description,
      ticket.requester.fullName, ticket.assignee?.fullName ?? "", ticket.location ?? ""]
      .join(" ").toLowerCase().includes(query));
  }, [tickets, searchQuery]);

  function exportTicketsCsv() {
    const header = [
      "Ticket Code",
      "Title",
      "Status",
      "Priority",
      "Category",
      "Requester",
      "Assignee",
      "Location",
      "Created At",
    ];
    const rows = filteredTickets.map((t) => [
      t.ticketCode,
      `"${t.title.replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      `"${(t.category?.name ?? "").replace(/"/g, '""')}"`,
      `"${t.requester.fullName.replace(/"/g, '""')}"`,
      `"${(t.assignee?.fullName ?? "").replace(/"/g, '""')}"`,
      `"${(t.location ?? "").replace(/"/g, '""')}"`,
      t.createdAt,
    ]);
    const csv =
      "\uFEFF" +
      [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `helpdesk-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify("info", "បានទាញយកឯកសារ CSV រួចរាល់");
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-slate-600 text-sm">
          <div className="h-4 w-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
          <span>កំពុងផ្ទុកប្រព័ន្ធ...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthScreen
        onAuthenticated={(user) => {
          setWorkspaceLoaded(false);
          setCurrentUser(user);
        }}
      />
    );
  }

  const isStaff = currentUser.role === "admin" || currentUser.role === "agent";
  const isAdmin = currentUser.role === "admin";
  const activeAgents = usersList.filter(
    (u) => (u.role === "admin" || u.role === "agent") && u.isActive
  );

  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: "dashboard",
      label: "ផ្ទាំងគ្រប់គ្រង",
      icon: <LayoutDashboardIcon className="w-4 h-4" />,
    },
    {
      id: "tickets",
      label: "សំណើជំនួយ",
      icon: <TicketIcon className="w-4 h-4" />,
      badge: tickets.length,
    },
    {
      id: "kanban",
      label: "ក្ដារការងារ",
      icon: <KanbanIcon className="w-4 h-4" />,
      badge: stats.open + stats.inProgress,
    },
    {
      id: "categories",
      label: "ប្រភេទ & SLA",
      icon: <TagIcon className="w-4 h-4" />,
      badge: categories.length,
    },
    ...(isAdmin
      ? [
          {
            id: "users" as ActiveTab,
            label: "អ្នកប្រើប្រាស់",
            icon: <UsersIcon className="w-4 h-4" />,
            badge: usersList.length,
          },
        ]
      : []),
    {
      id: "profile",
      label: "គណនីផ្ទាល់ខ្លួន",
      icon: <UserIcon className="w-4 h-4" />,
    },
  ];

  const pageTitles: Record<ActiveTab, string> = {
    dashboard: "ផ្ទាំងគ្រប់គ្រង",
    tickets: "សំណើជំនួយទាំងអស់",
    kanban: "ក្ដារការងារ Kanban",
    categories: "ប្រភេទបញ្ហា និង SLA",
    users: "គ្រប់គ្រងអ្នកប្រើប្រាស់",
    profile: "គណនីផ្ទាល់ខ្លួន",
  };


  return (
    <div className="app-shell">
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="app-backdrop"
        />
      )}

      {/* Clean Light Neutral Sidebar */}
      <aside className={`app-sidebar ${mobileMenuOpen ? "is-open" : ""}`}>
        <div className="p-4 space-y-5">
          {/* Brand */}
          <div className="flex items-center justify-between px-1.5">
            <div className="flex items-center gap-2.5">
              <div className="app-brand-icon h-10 w-10 rounded-xl text-white flex items-center justify-center shrink-0">
                <LogoMarkIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-violet-800 leading-tight">
                  Helpdesk
                </div>
                <div className="text-[11px] text-slate-400">
                  IT Service Desk
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="app-hide-desktop p-1 rounded-md text-slate-400 hover:text-slate-800 cursor-pointer"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Action */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setShowCreateModal(true);
            }}
            className="app-sidebar-action w-full py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>បង្កើតសំណើថ្មី</span>
          </button>

          {/* Navigation */}
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={`app-nav-item w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-[13px] transition cursor-pointer ${active ? "is-active font-semibold" : "font-medium"}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="app-nav-icon"
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[11px] tabular-nums ${
                        active
                          ? "text-slate-900 font-semibold"
                          : "text-slate-400"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Clean Sidebar User Footer */}
        <div className="p-3 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("profile");
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-2.5 min-w-0 flex-1 p-1.5 rounded-lg hover:bg-slate-50 text-left cursor-pointer"
          >
            <UserAvatar name={currentUser.fullName} avatarColor={currentUser.avatarColor} avatarUrl={currentUser.avatarUrl} size="md" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-slate-900 truncate">
                {currentUser.fullName}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {ROLE_CONFIG[currentUser.role].label}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => void handleLogout()}
            title="ចាកចេញពីប្រព័ន្ធ"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
          >
            <LogOutIcon className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="app-main-col">
        {/* Clean Sticky Header */}
        <header className="app-topbar">
          <div className="px-4 sm:px-6 lg:px-7 h-[68px] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="app-hide-desktop p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
                title="ម៉ឺនុយ"
              >
                <MenuIcon className="w-4 h-4" />
              </button>
              <div className="flex md:hidden items-center gap-2 text-sm min-w-0">
                <span className="hidden sm:inline text-slate-400">Helpdesk</span>
                <span className="hidden sm:inline text-slate-300">/</span>
                <h1 className="font-semibold text-slate-900 truncate">
                  {pageTitles[activeTab]}
                </h1>
              </div>
              {/* Compact Search */}
              <div className="hidden md:block relative w-64 lg:w-[340px]">
                <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (
                      activeTab !== "tickets" &&
                      activeTab !== "kanban" &&
                      e.target.value.trim()
                    ) {
                      setStatusFilter("all");
                      setPriorityFilter("all");
                      setCategoryFilter("all");
                      setOnlyAssignedToMe(false);
                      setOnlyOverdue(false);
                      setActiveTab("tickets");
                    }
                  }}
                  placeholder="ស្វែងរកសំណើ..."
                  aria-label="ស្វែងរកសំណើ"
                  className="app-header-search w-full pl-9 pr-3 py-2.5 rounded-xl text-xs text-slate-900 focus:outline-none"
                />
              </div>

            </div>

            <div className="flex items-center gap-2">
              {/* DB Connection Pill */}
              <button
                type="button"
                onClick={() => setShowDbModal(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 cursor-pointer"
                title="ការកំណត់ PostgreSQL"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>
                  {dbState.mode === "postgresql" ? "PostgreSQL" : "Local"}
                </span>
              </button>

              {/* Refresh */}
              <button
                type="button"
                onClick={() => void loadWorkspaceData()}
                disabled={loadingData}
                title="ផ្ទុកទិន្នន័យឡើងវិញ"
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 cursor-pointer disabled:opacity-50"
              >
                <RefreshIcon
                  className={`w-3.5 h-3.5 ${loadingData ? "animate-spin" : ""}`}
                />
              </button>

              {/* Clean Account & Role Switcher */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRoleMenuOpen((prev) => !prev)}
                  aria-label="បើកម៉ឺនុយគណនី"
                  aria-expanded={roleMenuOpen}
                  className="app-account-button inline-flex items-center gap-2 pl-1 pr-2 py-1 text-xs font-medium text-slate-800 cursor-pointer"
                >
                  <UserAvatar name={currentUser.fullName} avatarColor={currentUser.avatarColor} avatarUrl={currentUser.avatarUrl} size="lg" />
                  <span className="hidden sm:flex flex-col items-start min-w-0 max-w-36">
                    <span className="font-semibold truncate max-w-full">{currentUser.fullName}</span>
                    <span className="text-[11px] font-normal text-slate-400">{ROLE_CONFIG[currentUser.role].label}</span>
                  </span>
                  <ChevronDownIcon className="w-3 h-3 text-slate-400" />
                </button>

                {roleMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setRoleMenuOpen(false)}
                    />
                    <div
                      style={{ width: 272 }}
                      className="absolute right-0 mt-1.5 rounded-xl bg-white border border-slate-200 shadow-lg z-50 p-1.5 text-xs"
                    >
                      <div className="px-2.5 py-2 border-b border-slate-100">
                        <div className="font-semibold text-slate-900 truncate">
                          {currentUser.fullName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          @{currentUser.username} •{" "}
                          {ROLE_CONFIG[currentUser.role].label}
                        </div>
                      </div>

                      <div className="px-2.5 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        ប្ដូរគណនីរហ័ស
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-0.5">
                        {(usersList.filter((u) => u.isActive).length > 0
                          ? usersList.filter((u) => u.isActive)
                          : [currentUser]
                        ).map((u) => {
                          const isCurrent = u.id === currentUser.id;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => openAccountSwitch(u)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 transition cursor-pointer ${
                                isCurrent
                                  ? "bg-slate-100 text-slate-900"
                                  : "hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <UserAvatar name={u.fullName} avatarColor={u.avatarColor} avatarUrl={u.avatarUrl} size="sm" />
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-900 truncate">
                                    {u.fullName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    {ROLE_CONFIG[u.role].label} • @{u.username}
                                  </div>
                                </div>
                              </div>
                              {isCurrent && (
                                <CheckIcon className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="border-t border-slate-100 pt-1 mt-1 space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setRoleMenuOpen(false);
                            setActiveTab("profile");
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                        >
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>គណនីផ្ទាល់ខ្លួន</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRoleMenuOpen(false);
                            setShowDbModal(true);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                        >
                          <DatabaseIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>កំណត់ PostgreSQL</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleLogout()}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 font-medium flex items-center gap-2 cursor-pointer"
                        >
                          <LogOutIcon className="w-3.5 h-3.5" />
                          <span>ចាកចេញពីប្រព័ន្ធ</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Clean Underline Navigation Strip on < 1024px */}
          <div className="app-mobile-tabs">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs border-b-2 whitespace-nowrap transition cursor-pointer shrink-0 ${
                    active
                      ? "border-slate-900 text-slate-900 font-semibold"
                      : "border-transparent text-slate-500 hover:text-slate-800 font-medium"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      ({item.badge})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto" data-view={activeTab} aria-busy={!workspaceLoaded}>
          {!workspaceLoaded ? (
            <div className="surface-card p-8 flex items-center gap-3 text-sm text-slate-500">
              <span className="h-4 w-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" aria-hidden="true" />
              <span>កំពុងផ្ទុកទិន្នន័យ...</span>
            </div>
          ) : (<>
          {activeTab === "dashboard" && (
            <DashboardView
              currentUser={currentUser}
              tickets={tickets}
              users={usersList}
              now={now}
              onCreate={() => setShowCreateModal(true)}
              onManageUsers={() => setActiveTab("users")}
              onOpenTicket={(id) => setSelectedTicketId(id)}
              onShowTickets={showDashboardTickets}
            />
          )}

          {activeTab === "tickets" && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    សំណើជំនួយទាំងអស់
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ស្វែងរក ច្រោះមើល និងកែសម្រួលស្ថានភាពសំណើជំនួយដោយផ្ទាល់
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportTicketsCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>បង្កើតសំណើថ្មី</span>
                  </button>
                </div>
              </div>

              <div className="surface-card overflow-hidden">
                {/* Clean Toolbar */}
                <div className="p-4 border-b border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                    <div className="md:col-span-5 relative">
                      <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ស្វែងរកលេខកូដ, ចំណងជើង, អ្នកស្នើ..."
                        className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-700"
                      >
                        <option value="all">គ្រប់កម្រិតអាទិភាព</option>
                        <option value="urgent">បន្ទាន់</option>
                        <option value="high">ខ្ពស់</option>
                        <option value="medium">មធ្យម</option>
                        <option value="low">ទាប</option>
                      </select>
                    </div>

                    <div className="md:col-span-4">
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-700"
                      >
                        <option value="all">គ្រប់ប្រភេទបញ្ហា</option>
                        {categories.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex flex-wrap p-0.5 rounded-lg bg-slate-100 border border-slate-200/70">
                      {[
                        { id: "all", label: "ទាំងអស់" },
                        { id: "open", label: "រង់ចាំ" },
                        { id: "in_progress", label: "កំពុងធ្វើ" },
                        { id: "completed", label: "រួចរាល់ទាំងអស់" },
                        { id: "resolved", label: "ដោះស្រាយរួច" },
                        { id: "closed", label: "បិទ" },
                      ].map((pill) => (
                        <button
                          key={pill.id}
                          type="button"
                          onClick={() => setStatusFilter(pill.id)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                            statusFilter === pill.id
                              ? "bg-white text-slate-900 shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {pill.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3">
                      {isStaff && (
                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={onlyAssignedToMe}
                            onChange={(e) =>
                              setOnlyAssignedToMe(e.target.checked)
                            }
                            className="rounded border-slate-300 text-slate-900"
                          />
                          <span>ចាត់តាំងមកខ្ញុំ</span>
                        </label>
                      )}

                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                        <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} className="rounded border-slate-300 text-violet-700" />
                        <span>លើសពេល SLA</span>
                      </label>

                      {(searchQuery ||
                        statusFilter !== "all" ||
                        priorityFilter !== "all" ||
                        categoryFilter !== "all" ||
                        onlyAssignedToMe ||
                        onlyOverdue) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery("");
                            setStatusFilter("all");
                            setPriorityFilter("all");
                            setCategoryFilter("all");
                            setOnlyAssignedToMe(false);
                            setOnlyOverdue(false);
                          }}
                          className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
                        >
                          សម្អាតតម្រង
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <TicketListTable
                  tickets={filteredTickets}
                  isStaff={isStaff}
                  isAdmin={isAdmin}
                  activeAgents={activeAgents}
                  onSelect={(id) => setSelectedTicketId(id)}
                  onQuickPatch={quickPatchTicket}
                  onRequestDelete={(t) => setDeletingTicket(t)}
                />
              </div>
            </div>
          )}

          {activeTab === "kanban" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    ក្ដារការងារ Kanban
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    តាមដាន និងប្ដូរដំណាក់កាលការងារតាមជួរនីមួយៗ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  <span>បង្កើតសំណើថ្មី</span>
                </button>
              </div>

              <KanbanBoardView
                tickets={kanbanTickets}
                isStaff={isStaff}
                onSelect={(id) => setSelectedTicketId(id)}
                onMoveStatus={(id, nextStatus) =>
                  quickPatchTicket(
                    id,
                    { status: nextStatus },
                    `បានប្ដូរស្ថានភាពទៅជា "${STATUS_CONFIG[nextStatus].label}"`
                  )
                }
              />
            </div>
          )}

          {activeTab === "categories" && (
            <CategoriesView
              currentUser={currentUser}
              categories={categories}
              tickets={tickets}
              onRefresh={loadWorkspaceData}
              onNotify={notify}
            />
          )}

          {(activeTab === "users" || activeTab === "profile") && (
            <UsersAndProfileView
              key={`${activeTab}-${currentUser.id}-${currentUser.fullName}-${currentUser.username}-${currentUser.email}-${currentUser.department}-${currentUser.avatarColor}-${currentUser.avatarUrl ?? ""}`}
              mode={activeTab === "users" ? "users" : "profile"}
              currentUser={currentUser}
              usersList={usersList}
              tickets={tickets}
              onNotify={notify}
              onUserUpdated={async (updatedSelf) => {
                if (updatedSelf) {
                  setCurrentUser(updatedSelf);
                }
                await loadWorkspaceData();
              }}
            />
          )}
          </>)}
        </main>
      </div>

      {/* Modals */}
      {switchTarget && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px] p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="switch-account-title" className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm overflow-hidden">
            <form onSubmit={confirmAccountSwitch}>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <UserAvatar name={switchTarget.fullName} avatarColor={switchTarget.avatarColor} avatarUrl={switchTarget.avatarUrl} size="lg" />
                  <div className="min-w-0">
                    <h3 id="switch-account-title" className="text-sm font-semibold text-slate-900">ប្ដូរគណនី</h3>
                    <p className="text-xs text-slate-500 truncate">{switchTarget.fullName} · @{switchTarget.username}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600">សូមបញ្ចូលពាក្យសម្ងាត់របស់គណនីដែលអ្នកចង់ប្ដូរ។</p>
                {switchError && <p role="alert" className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">{switchError}</p>}
                <div>
                  <label htmlFor="switch-password" className="block text-xs font-medium text-slate-700 mb-1">ពាក្យសម្ងាត់</label>
                  <input id="switch-password" type="password" autoComplete="current-password" autoFocus required value={switchPassword} onChange={(e) => setSwitchPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-slate-900" />
                </div>
              </div>
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button type="button" disabled={switching} onClick={() => { setSwitchTarget(null); setSwitchPassword(""); }} className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer">បោះបង់</button>
                <button type="submit" disabled={switching || !switchPassword.trim()} className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer disabled:opacity-60">{switching ? "កំពុងផ្ទៀងផ្ទាត់..." : "ប្ដូរគណនី"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showCreateModal && (
        <CreateTicketModal
          currentUser={currentUser}
          categories={categories}
          staffUsers={usersList}
          onClose={() => setShowCreateModal(false)}
          onCreated={(created) => {
            setTickets((prev) => [created, ...prev]);
            setShowCreateModal(false);
            setSelectedTicketId(created.id);
            notify("success", `បានបង្កើតសំណើ ${created.ticketCode}`);
          }}
        />
      )}

      {selectedTicketId !== null && (
        <TicketDetailModal
          ticketId={selectedTicketId}
          currentUser={currentUser}
          categories={categories}
          staffUsers={usersList}
          onClose={() => setSelectedTicketId(null)}
          onUpdated={(updated) => {
            setTickets((prev) =>
              prev.map((item) => (item.id === updated.id ? updated : item))
            );
          }}
          onDeleted={(deletedId) => {
            setTickets((prev) => prev.filter((item) => item.id !== deletedId));
            setSelectedTicketId(null);
          }}
          onNotify={notify}
        />
      )}

      {deletingTicket && (
        <ConfirmModal
          title={`លុបសំណើ ${deletingTicket.ticketCode}?`}
          description={`តើអ្នកពិតជាចង់លុបសំណើ "${deletingTicket.title}" ចេញពីប្រព័ន្ធមែនទេ?`}
          confirmLabel="យល់ព្រមលុប"
          loading={deletingTicketBusy}
          onCancel={() => setDeletingTicket(null)}
          onConfirm={() => void confirmDeleteTicketFromRow()}
        />
      )}

      {showDbModal && (
        <DbConfigModal
          initialHost={dbState.host}
          initialPort={dbState.port}
          initialUser={dbState.user}
          initialDatabase={dbState.database}
          currentMode={dbState.mode}
          fallbackReason={dbState.fallbackReason}
          onClose={() => setShowDbModal(false)}
          onConnected={() => {
            notify("success", "ភ្ជាប់ទៅ PostgreSQL បានជោគជ័យ");
            void loadWorkspaceData();
          }}
        />
      )}

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((prev) => prev.filter((item) => item.id !== id))
        }
      />
    </div>
  );
}

function TicketListTable({
  tickets,
  isStaff,
  isAdmin,
  activeAgents,
  compact = false,
  onSelect,
  onQuickPatch,
  onRequestDelete,
}: {
  tickets: EnrichedTicket[];
  isStaff: boolean;
  isAdmin: boolean;
  activeAgents: SafeUser[];
  compact?: boolean;
  onSelect: (ticketId: number) => void;
  onQuickPatch: (
    ticketId: number,
    payload: Record<string, unknown>,
    successMsg: string
  ) => Promise<void>;
  onRequestDelete: (ticket: EnrichedTicket) => void;
}) {
  if (tickets.length === 0) {
    return (
      <div className="p-12 text-center text-xs sm:text-sm text-slate-400">
        មិនមានសំណើជំនួយត្រូវនឹងការស្វែងរកទេ
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-medium text-slate-500">
            <th className="py-3 px-4">លេខកូដ</th>
            <th className="py-3 px-4">ចំណងជើងបញ្ហា</th>
            <th className="py-3 px-4">ស្ថានភាព</th>
            <th className="py-3 px-4">អាទិភាព</th>
            {!compact && <th className="py-3 px-4">អ្នកទទួលបន្ទុក</th>}
            <th className="py-3 px-4 text-right">សកម្មភាព</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tickets.map((t) => (
            <tr
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="hover:bg-slate-50/80 transition cursor-pointer"
            >
              <td className="py-3 px-4 whitespace-nowrap align-top">
                <span className="font-mono text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  {t.ticketCode}
                </span>
              </td>

              <td className="py-3 px-4 max-w-md align-top">
                <div className="font-medium text-slate-900 leading-snug line-clamp-1">
                  {t.title}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                  <span className="inline-flex items-center gap-1.5">
                    <UserAvatar name={t.requester.fullName} avatarColor={t.requester.avatarColor} avatarUrl={t.requester.avatarUrl} size="xs" />
                    <span>{t.requester.fullName}</span>
                  </span>
                  {t.category && (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-slate-300">•</span>
                      <span
                        style={{ backgroundColor: t.category.color }}
                        className="h-1.5 w-1.5 rounded-full"
                      />
                      <span>{t.category.name}</span>
                    </span>
                  )}
                  {t.location && !compact && (
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <span>•</span>
                      <MapPinIcon className="w-3 h-3" />
                      <span>{t.location}</span>
                    </span>
                  )}
                  {t.commentCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <span>•</span>
                      <MessageSquareIcon className="w-3 h-3" />
                      <span>{t.commentCount}</span>
                    </span>
                  )}
                  <span className="text-slate-400">
                    • {formatDateTime(t.updatedAt)}
                  </span>
                </div>
              </td>

              {/* Status */}
              <td
                className="py-3 px-4 whitespace-nowrap align-top"
                onClick={(e) => e.stopPropagation()}
              >
                {isStaff && !compact ? (
                  <select
                    value={t.status}
                    onChange={(e) => {
                      const next = e.target.value as
                        | "open"
                        | "in_progress"
                        | "resolved"
                        | "closed";
                      void onQuickPatch(
                        t.id,
                        { status: next },
                        `បានប្ដូរស្ថានភាព ${t.ticketCode}`
                      );
                    }}
                    className={`text-xs font-medium px-2 py-1 rounded-md border cursor-pointer ${
                      STATUS_CONFIG[t.status].badgeClass
                    }`}
                  >
                    <option value="open">រង់ចាំដោះស្រាយ</option>
                    <option value="in_progress">កំពុងដំណើរការ</option>
                    <option value="resolved">ដោះស្រាយរួច</option>
                    <option value="closed">បិទបញ្ចប់</option>
                  </select>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md border ${
                      STATUS_CONFIG[t.status].badgeClass
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        STATUS_CONFIG[t.status].dotClass
                      }`}
                    />
                    {STATUS_CONFIG[t.status].label}
                  </span>
                )}
              </td>

              {/* Priority */}
              <td
                className="py-3 px-4 whitespace-nowrap align-top"
                onClick={(e) => e.stopPropagation()}
              >
                {isStaff && !compact ? (
                  <select
                    value={t.priority}
                    onChange={(e) => {
                      const next = e.target.value as
                        | "low"
                        | "medium"
                        | "high"
                        | "urgent";
                      void onQuickPatch(
                        t.id,
                        { priority: next },
                        `បានប្ដូរអាទិភាព ${t.ticketCode}`
                      );
                    }}
                    className={`text-xs font-medium px-2 py-1 rounded-md border cursor-pointer ${
                      PRIORITY_CONFIG[t.priority].badgeClass
                    }`}
                  >
                    <option value="low">ទាប</option>
                    <option value="medium">មធ្យម</option>
                    <option value="high">ខ្ពស់</option>
                    <option value="urgent">បន្ទាន់</option>
                  </select>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md border ${
                      PRIORITY_CONFIG[t.priority].badgeClass
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        PRIORITY_CONFIG[t.priority].dotClass
                      }`}
                    />
                    {PRIORITY_CONFIG[t.priority].short}
                  </span>
                )}
              </td>

              {/* Assignee */}
              {!compact && (
                <td
                  className="py-3 px-4 whitespace-nowrap text-xs align-top"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isStaff ? (
                    <select
                      value={t.assigneeId ?? ""}
                      onChange={(e) => {
                        const val = e.target.value
                          ? Number(e.target.value)
                          : null;
                        void onQuickPatch(
                          t.id,
                          { assigneeId: val },
                          `បានកែប្រែអ្នកទទួលបន្ទុក ${t.ticketCode}`
                        );
                      }}
                      className="px-2 py-1 rounded-md border border-slate-200 bg-white text-xs text-slate-700 cursor-pointer"
                    >
                      <option value="">មិនទាន់ចាត់តាំង</option>
                      {activeAgents.map((ag) => (
                        <option key={ag.id} value={ag.id}>
                          {ag.fullName}
                        </option>
                      ))}
                    </select>
                  ) : t.assignee ? (
                    <span className="text-slate-700">{t.assignee.fullName}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              )}

              {/* Actions */}
              <td
                className="py-3 px-4 whitespace-nowrap text-right align-top"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelect(t.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer"
                  >
                    <PencilIcon className="w-3 h-3" />
                    <span>កែប្រែ</span>
                  </button>
                  {isAdmin && !compact && (
                    <button
                      type="button"
                      onClick={() => onRequestDelete(t)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="លុបសំណើ"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KanbanBoardView({
  tickets,
  isStaff,
  onSelect,
  onMoveStatus,
}: {
  tickets: EnrichedTicket[];
  isStaff: boolean;
  onSelect: (id: number) => void;
  onMoveStatus: (
    id: number,
    nextStatus: "open" | "in_progress" | "resolved" | "closed"
  ) => Promise<void>;
}) {
  const columns: {
    key: "open" | "in_progress" | "resolved" | "closed";
    title: string;
    dotClass: string;
  }[] = [
    { key: "open", title: "រង់ចាំដោះស្រាយ", dotClass: "bg-amber-500" },
    { key: "in_progress", title: "កំពុងដំណើរការ", dotClass: "bg-blue-600" },
    { key: "resolved", title: "ដោះស្រាយរួច", dotClass: "bg-emerald-500" },
    { key: "closed", title: "បិទបញ្ចប់", dotClass: "bg-slate-400" },
  ];

  const order: ("open" | "in_progress" | "resolved" | "closed")[] = [
    "open",
    "in_progress",
    "resolved",
    "closed",
  ];

  return (
    <div className="kanban-grid">
      {columns.map((col, colIdx) => {
        const colTickets = tickets.filter((t) => t.status === col.key);
        return (
          <div
            key={col.key}
            className="bg-slate-100/80 rounded-xl border border-slate-200/80 p-3 space-y-2.5"
          >
            <div className="flex items-center justify-between px-1 py-0.5">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${col.dotClass}`} />
                <h3 className="text-xs font-semibold text-slate-800">
                  {col.title}
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium tabular-nums">
                {colTickets.length}
              </span>
            </div>

            <div className="space-y-2 min-h-[100px]">
              {colTickets.length === 0 ? (
                <div className="p-6 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400">
                  គ្មានសំណើ
                </div>
              ) : (
                colTickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    className="bg-white rounded-lg border border-slate-200 hover:border-slate-300 p-3.5 shadow-2xs transition cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-medium text-slate-600">
                        {t.ticketCode}
                      </span>
                      <span
                        className={`text-[11px] font-medium px-1.5 py-0.2 rounded border ${
                          PRIORITY_CONFIG[t.priority].badgeClass
                        }`}
                      >
                        {PRIORITY_CONFIG[t.priority].short}
                      </span>
                    </div>

                    <div className="font-medium text-xs sm:text-sm text-slate-900 leading-snug line-clamp-2">
                      {t.title}
                    </div>

                    {t.category && (
                      <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span
                          style={{ backgroundColor: t.category.color }}
                          className="h-1.5 w-1.5 rounded-full"
                        />
                        <span className="truncate">{t.category.name}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <UserAvatar name={t.requester.fullName} avatarColor={t.requester.avatarColor} avatarUrl={t.requester.avatarUrl} size="xs" />
                        <span className="text-[11px] text-slate-500 truncate">
                          {t.requester.fullName}
                        </span>
                      </div>

                      {isStaff && (
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {colIdx > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                void onMoveStatus(t.id, order[colIdx - 1])
                              }
                              className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                              title="ជួរមុន"
                            >
                              <ArrowLeftIcon className="w-3 h-3" />
                            </button>
                          )}
                          {colIdx < order.length - 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                void onMoveStatus(t.id, order[colIdx + 1])
                              }
                              className="p-1 rounded border border-slate-200 hover:bg-slate-900 hover:border-slate-900 text-slate-600 hover:text-white cursor-pointer"
                              title="ជួរបន្ទាប់"
                            >
                              <ArrowRightIcon className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
