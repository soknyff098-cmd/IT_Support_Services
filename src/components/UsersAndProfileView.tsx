"use client";

import React, { useMemo, useState } from "react";
import type { SafeUser } from "@/lib/auth";
import type { EnrichedTicket } from "@/lib/tickets";
import { apiFetch, setClientToken } from "@/lib/api-client";
import { formatDateTime, ROLE_CONFIG } from "@/lib/constants";
import { ConfirmModal } from "./Toast";
import { AvatarPicker, UserAvatar } from "./UserAvatar";
import {
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from "./Icons";

interface UsersAndProfileViewProps {
  mode: "users" | "profile";
  currentUser: SafeUser;
  usersList: SafeUser[];
  tickets: EnrichedTicket[];
  onUserUpdated: (updatedSelf?: SafeUser) => Promise<void>;
  onNotify: (type: "success" | "error" | "info", msg: string) => void;
}

const AVATAR_COLORS = [
  "#0f172a",
  "#2563eb",
  "#4f46e5",
  "#0891b2",
  "#059669",
  "#7c3aed",
  "#d97706",
  "#e11d48",
];

const DEPT_PRESETS = [
  "ព័ត៌មានវិទ្យា (IT)",
  "ក្រុមបច្ចេកទេស",
  "បណ្ដាញ និងសុវត្ថិភាព",
  "គណនេយ្យ និងហិរញ្ញវត្ថុ",
  "ធនធានមនុស្ស (HR)",
  "រដ្ឋបាល",
  "ទីផ្សារ",
];

export default function UsersAndProfileView({
  mode,
  currentUser,
  usersList,
  tickets,
  onUserUpdated,
  onNotify,
}: UsersAndProfileViewProps) {
  const isAdmin = currentUser.role === "admin";

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<
    "all" | "admin" | "agent" | "user"
  >("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "suspended"
  >("all");

  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<SafeUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [selfName, setSelfName] = useState(currentUser.fullName);
  const [selfUsername, setSelfUsername] = useState(currentUser.username);
  const [selfEmail, setSelfEmail] = useState(currentUser.email);
  const [selfDept, setSelfDept] = useState(currentUser.department);
  const [selfColor, setSelfColor] = useState(currentUser.avatarColor);
  const [selfAvatarUrl, setSelfAvatarUrl] = useState<string | null>(currentUser.avatarUrl ?? null);
  const [selfAvatarBusy, setSelfAvatarBusy] = useState(false);
  const [selfNewPass, setSelfNewPass] = useState("");
  const [showSelfPass, setShowSelfPass] = useState(false);
  const [savingSelf, setSavingSelf] = useState(false);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return usersList.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter === "active" && !u.isActive) return false;
      if (statusFilter === "suspended" && u.isActive) return false;
      if (q) {
        const hay =
          `${u.fullName} ${u.username} ${u.email} ${u.department}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [usersList, search, roleFilter, statusFilter]);

  const counts = useMemo(() => {
    return {
      total: usersList.length,
      admins: usersList.filter((u) => u.role === "admin").length,
      agents: usersList.filter((u) => u.role === "agent").length,
      active: usersList.filter((u) => u.isActive).length,
    };
  }, [usersList]);

  async function handleSaveSelf(e: React.FormEvent) {
    e.preventDefault();
    if (selfAvatarBusy || savingSelf) return;
    setSavingSelf(true);
    try {
      const { status, data } = await apiFetch<{
        ok: boolean;
        user?: SafeUser;
        token?: string;
        error?: string;
      }>(`/api/users/${currentUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: selfName,
          username: selfUsername,
          email: selfEmail,
          department: selfDept,
          avatarColor: selfColor,
          avatarUrl: selfAvatarUrl,
          ...(selfNewPass.trim() ? { newPassword: selfNewPass.trim() } : {}),
        }),
      });

      if (status >= 200 && status < 300 && data.ok && data.user) {
        if (data.token) setClientToken(data.token);
        setSelfNewPass("");
        onNotify("success", "បានរក្សាទុកព័ត៌មានគណនីផ្ទាល់ខ្លួន");
        await onUserUpdated(data.user);
      } else {
        onNotify("error", data.error || "មិនអាចរក្សាទុកព័ត៌មានបានទេ។");
      }
    } catch {
      onNotify("error", "មានបញ្ហាបណ្ដាញ មិនអាចរក្សាទុកព័ត៌មានបានទេ។");
    } finally {
      setSavingSelf(false);
    }
  }

  async function confirmDeleteUser() {
    if (!deletingUser) return;
    setDeleteLoading(true);
    try {
      const { status, data } = await apiFetch<{ ok: boolean; error?: string }>(
        `/api/users/${deletingUser.id}`,
        { method: "DELETE" }
      );
      if (status >= 200 && status < 300 && data.ok) {
        onNotify("success", `បានលុបគណនី "${deletingUser.fullName}" រួចរាល់`);
        setDeletingUser(null);
        await onUserUpdated();
      } else {
        onNotify("error", data.error || "មិនអាចលុបគណនីនេះបានទេ។");
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  function exportUsersCsv() {
    const header = [
      "ID",
      "Full Name",
      "Username",
      "Email",
      "Role",
      "Department",
      "Status",
      "Created At",
    ];
    const rows = filteredUsers.map((u) => [
      u.id,
      `"${u.fullName.replace(/"/g, '""')}"`,
      u.username,
      u.email,
      u.role,
      `"${u.department.replace(/"/g, '""')}"`,
      u.isActive ? "Active" : "Suspended",
      u.createdAt,
    ]);
    const csv =
      "\uFEFF" +
      [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `helpdesk-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify("info", "បានទាញយកឯកសារ CSV រួចរាល់");
  }

  if (mode === "profile" || !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            គណនីផ្ទាល់ខ្លួន
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            គ្រប់គ្រងព័ត៌មានផ្ទាល់ខ្លួន និងពាក្យសម្ងាត់សុវត្ថិភាពរបស់អ្នក
          </p>
        </div>

        <div className="surface-card overflow-hidden">
          <div className="profile-cover h-20 sm:h-24" aria-hidden="true" />
          <div className="px-5 sm:px-6 pb-6 space-y-6">
          <div className="relative flex items-end gap-4 -mt-8 pb-5 border-b border-slate-100">
            <div className="rounded-[20px] border-4 border-white shadow-sm shrink-0">
              <UserAvatar
                name={selfName || currentUser.fullName}
                avatarColor={selfColor}
                avatarUrl={selfAvatarUrl}
                size="2xl"
              />
            </div>
            <div className="min-w-0 pb-1">
              <h3 className="text-base font-semibold text-slate-900 break-words">
                {selfName || currentUser.fullName}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                    ROLE_CONFIG[currentUser.role].badgeClass
                  }`}
                >
                  {ROLE_CONFIG[currentUser.role].label}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  @{currentUser.username}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveSelf} className="space-y-5">
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">រូបភាពគណនី</h4>
              <AvatarPicker
                fullName={selfName || currentUser.fullName}
                avatarColor={selfColor}
                avatarUrl={selfAvatarUrl}
                colors={AVATAR_COLORS}
                onChangeColor={setSelfColor}
                onChangeAvatarUrl={setSelfAvatarUrl}
                onProcessingChange={setSelfAvatarBusy}
              />
              <p className="mt-2 text-xs text-slate-500">ចុច «រក្សាទុកព័ត៌មាន» ដើម្បីអនុវត្តការផ្លាស់ប្ដូរ។</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ឈ្មោះពេញ *
                </label>
                <input
                  type="text"
                  required
                  value={selfName}
                  onChange={(e) => setSelfName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  value={selfUsername}
                  onChange={(e) => setSelfUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  អ៊ីមែល *
                </label>
                <input
                  type="email"
                  required
                  value={selfEmail}
                  onChange={(e) => setSelfEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ផ្នែកការងារ
                </label>
                <input
                  type="text"
                  value={selfDept}
                  onChange={(e) => setSelfDept(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700">
                  ប្ដូរពាក្យសម្ងាត់ថ្មី (ទុកទទេបើមិនចង់ប្ដូរ)
                </label>
                <button
                  type="button"
                  onClick={() => setShowSelfPass((p) => !p)}
                  className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  {showSelfPass ? "លាក់" : "បង្ហាញ"}
                </button>
              </div>
              <input
                type={showSelfPass ? "text" : "password"}
                value={selfNewPass}
                onChange={(e) => setSelfNewPass(e.target.value)}
                placeholder="វាយពាក្យសម្ងាត់ថ្មីយ៉ាងតិច ៤ តួអក្សរ..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingSelf || selfAvatarBusy}
                className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-medium cursor-pointer disabled:opacity-60"
              >
                {savingSelf ? "កំពុងរក្សាទុក..." : "រក្សាទុកព័ត៌មាន"}
              </button>
            </div>
          </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            គ្រប់គ្រងអ្នកប្រើប្រាស់
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            បង្កើតគណនីថ្មី កែប្រែព័ត៌មាន កំណត់សិទ្ធិប្រើប្រាស់ ឬលុបគណនីបុគ្គលិក
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportUsersCsv}
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
            <span>បន្ថែមអ្នកប្រើប្រាស់</span>
          </button>
        </div>
      </div>

      {/* Uniform Clean Summary Strip */}
      <div className="kpi-grid">
        <div className="surface-card p-4">
          <div className="text-xs text-slate-500">គណនីសរុប</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
            {counts.total}
          </div>
        </div>
        <div className="surface-card p-4">
          <div className="text-xs text-slate-500">អ្នកគ្រប់គ្រង (Admin)</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
            {counts.admins}
          </div>
        </div>
        <div className="surface-card p-4">
          <div className="text-xs text-slate-500">បច្ចេកទេស (IT Agent)</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
            {counts.agents}
          </div>
        </div>
        <div className="surface-card p-4">
          <div className="text-xs text-slate-500">កំពុងដំណើរការ</div>
          <div className="text-2xl font-semibold text-emerald-600 mt-1 tabular-nums">
            {counts.active}
          </div>
        </div>
      </div>

      {/* Filter & Table Card */}
      <div className="surface-card overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ស្វែងរកឈ្មោះ, username, អ៊ីមែល..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200/70">
              {(
                [
                  { id: "all", label: "ទាំងអស់" },
                  { id: "admin", label: "Admin" },
                  { id: "agent", label: "Agent" },
                  { id: "user", label: "User" },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoleFilter(r.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                    roleFilter === r.id
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "all" | "active" | "suspended"
                )
              }
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700"
            >
              <option value="all">គ្រប់ស្ថានភាព</option>
              <option value="active">ដំណើរការ</option>
              <option value="suspended">ផ្អាក</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">ឈ្មោះបុគ្គលិក</th>
                <th className="py-3 px-4">គណនី & អ៊ីមែល</th>
                <th className="py-3 px-4">ផ្នែកការងារ</th>
                <th className="py-3 px-4">តួនាទី</th>
                <th className="py-3 px-4">សំណើ</th>
                <th className="py-3 px-4">ស្ថានភាព</th>
                <th className="py-3 px-4 text-right">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-slate-500 text-sm"
                  >
                    រកមិនឃើញទិន្នន័យអ្នកប្រើប្រាស់ទេ
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const requestedCount = tickets.filter(
                    (t) => t.requesterId === u.id
                  ).length;
                  const assignedCount = tickets.filter(
                    (t) => t.assigneeId === u.id
                  ).length;

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/80 transition"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={u.fullName}
                            avatarColor={u.avatarColor}
                            avatarUrl={u.avatarUrl}
                            size="md"
                          />
                          <div>
                            <div className="font-medium text-slate-900 flex items-center gap-1.5">
                              <span>{u.fullName}</span>
                              {u.id === currentUser.id && (
                                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                  អ្នក
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {formatDateTime(u.createdAt)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs">
                        <div className="text-slate-800">@{u.username}</div>
                        <div className="text-slate-500">{u.email}</div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-700">
                        {u.department}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                            ROLE_CONFIG[u.role].badgeClass
                          }`}
                        >
                          {ROLE_CONFIG[u.role].label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600 tabular-nums">
                        <span>ស្នើ {requestedCount}</span>
                        {(u.role === "admin" || u.role === "agent") && (
                          <span className="text-slate-400">
                            {" "}
                            • កាន់ {assignedCount}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              u.isActive ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          <span>{u.isActive ? "ដំណើរការ" : "ផ្អាក"}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingUser(u)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-medium transition cursor-pointer"
                          >
                            <PencilIcon className="w-3.5 h-3.5" />
                            <span>កែប្រែ</span>
                          </button>

                          {u.id !== currentUser.id && (
                            <button
                              type="button"
                              onClick={() => setDeletingUser(u)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="លុបគណនី"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <UserEditorModal
          mode="create"
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
          onSaved={async () => {
            setShowCreateModal(false);
            onNotify("success", "បានបង្កើតគណនីថ្មីរួចរាល់");
            await onUserUpdated();
          }}
        />
      )}

      {editingUser && (
        <UserEditorModal
          mode="edit"
          targetUser={editingUser}
          currentUser={currentUser}
          onClose={() => setEditingUser(null)}
          onSaved={async (savedUser) => {
            setEditingUser(null);
            onNotify(
              "success",
              `បានកែសម្រួលព័ត៌មាន "${savedUser.fullName}" រួចរាល់`
            );
            await onUserUpdated(
              savedUser.id === currentUser.id ? savedUser : undefined
            );
          }}
        />
      )}

      {deletingUser && (
        <ConfirmModal
          title={`លុបគណនី "${deletingUser.fullName}"?`}
          description={`តើអ្នកពិតជាចង់លុបគណនី @${deletingUser.username} (${deletingUser.email}) ចេញពីប្រព័ន្ធមែនទេ?`}
          confirmLabel="យល់ព្រមលុប"
          loading={deleteLoading}
          onCancel={() => setDeletingUser(null)}
          onConfirm={() => void confirmDeleteUser()}
        />
      )}
    </div>
  );
}

function UserEditorModal({
  mode,
  targetUser,
  currentUser,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  targetUser?: SafeUser;
  currentUser: SafeUser;
  onClose: () => void;
  onSaved: (user: SafeUser) => Promise<void>;
}) {
  const [fullName, setFullName] = useState(targetUser?.fullName ?? "");
  const [username, setUsername] = useState(targetUser?.username ?? "");
  const [email, setEmail] = useState(targetUser?.email ?? "");
  const [department, setDepartment] = useState(
    targetUser?.department ?? "ក្រុមបច្ចេកទេស"
  );
  const [role, setRole] = useState<"admin" | "agent" | "user">(
    targetUser?.role ?? "user"
  );
  const [avatarColor, setAvatarColor] = useState(
    targetUser?.avatarColor ?? AVATAR_COLORS[0]
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(targetUser?.avatarUrl ?? null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [isActive, setIsActive] = useState(targetUser?.isActive ?? true);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditingSelf = mode === "edit" && targetUser?.id === currentUser.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || avatarBusy) return;
    setSaving(true);
    setError(null);

    try {
      if (mode === "create") {
        const { status, data } = await apiFetch<{
          ok: boolean;
          user?: SafeUser;
          error?: string;
        }>("/api/users", {
          method: "POST",
          body: JSON.stringify({
            fullName,
            username,
            email,
            department,
            role,
            password,
            avatarColor,
            avatarUrl,
          }),
        });

        if (status >= 200 && status < 300 && data.ok && data.user) {
          await onSaved(data.user);
        } else {
          setError(data.error || "មិនអាចបង្កើតគណនីបានទេ។");
        }
      } else if (targetUser) {
        const { status, data } = await apiFetch<{
          ok: boolean;
          user?: SafeUser;
          token?: string;
          error?: string;
        }>(`/api/users/${targetUser.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            fullName,
            username,
            email,
            department,
            role,
            avatarColor,
            avatarUrl,
            isActive,
            ...(password.trim() ? { newPassword: password.trim() } : {}),
          }),
        });

        if (status >= 200 && status < 300 && data.ok && data.user) {
          if (data.token) setClientToken(data.token);
          await onSaved(data.user);
        } else {
          setError(data.error || "មិនអាចកែសម្រួលគណនីបានទេ។");
        }
      }
    } catch {
      setError("មានបញ្ហាបណ្ដាញ មិនអាចរក្សាទុកទិន្នន័យបានទេ។");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px] p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-xl overflow-hidden my-auto">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <UserAvatar
              name={fullName || "U"}
              avatarColor={avatarColor}
              avatarUrl={avatarUrl}
              size="lg"
            />
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                {mode === "create"
                  ? "បន្ថែមអ្នកប្រើប្រាស់ថ្មី"
                  : "កែសម្រួលព័ត៌មានអ្នកប្រើប្រាស់"}
              </h3>
              <p className="text-xs text-slate-500">
                {mode === "create"
                  ? "កំណត់ឈ្មោះ អ៊ីមែល ផ្នែក និងសិទ្ធិប្រើប្រាស់"
                  : `គណនី @${targetUser?.username}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-5 space-y-4 max-h-[80vh] overflow-y-auto"
        >
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <AvatarPicker
            compact
            fullName={fullName || "គណនីថ្មី"}
            avatarColor={avatarColor}
            avatarUrl={avatarUrl}
            colors={AVATAR_COLORS}
            onChangeColor={setAvatarColor}
            onChangeAvatarUrl={setAvatarUrl}
            onProcessingChange={setAvatarBusy}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ឈ្មោះពេញ *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="បញ្ចូលឈ្មោះពេញ"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Username *
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                អ៊ីមែល *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ផ្នែកការងារ
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="ក្រុមបច្ចេកទេស"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {DEPT_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDepartment(d)}
                className={`px-2 py-0.5 rounded-md text-[11px] border transition cursor-pointer ${
                  department === d
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              តួនាទី និងសិទ្ធិប្រើប្រាស់
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  {
                    id: "user",
                    title: "User",
                    desc: "បុគ្គលិកទូទៅ",
                  },
                  {
                    id: "agent",
                    title: "IT Agent",
                    desc: "ដោះស្រាយសំណើទាំងអស់",
                  },
                  {
                    id: "admin",
                    title: "Admin",
                    desc: "សិទ្ធិពេញលេញគ្រប់មុខងារ",
                  },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                    role === r.id
                      ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-900">
                    {r.title}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {r.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-1">
            {mode === "edit" && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  ស្ថានភាពគណនី
                </label>
                <button
                  type="button"
                  disabled={isEditingSelf}
                  onClick={() => setIsActive((prev) => !prev)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer disabled:opacity-50 ${
                    isActive
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-rose-50 border-rose-200 text-rose-700"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isActive ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  />
                  <span>
                    {isActive ? "កំពុងដំណើរការ" : "ផ្អាកជាបណ្ដោះអាសន្ន"}
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-700">
                {mode === "create"
                  ? "ពាក្យសម្ងាត់ដំបូង *"
                  : "កំណត់ពាក្យសម្ងាត់ថ្មី (ទុកទទេបើមិនប្ដូរ)"}
              </label>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                >
                  {showPass ? "លាក់" : "បង្ហាញ"}
                </button>
              </div>
            </div>
            <input
              type={showPass ? "text" : "password"}
              required={mode === "create"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === "create"
                  ? "បញ្ចូលពាក្យសម្ងាត់..."
                  : "វាយពាក្យសម្ងាត់ថ្មីប្រសិនបើចង់ប្ដូរ..."
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
            >
              បោះបង់
            </button>
            <button
              type="submit"
              disabled={saving || avatarBusy}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer disabled:opacity-60"
            >
              {saving ? "កំពុងរក្សាទុក..." : "រក្សាទុក"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
