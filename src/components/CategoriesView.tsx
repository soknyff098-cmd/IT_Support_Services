"use client";

import React, { useState } from "react";
import type { Category } from "@/db/schema";
import type { SafeUser } from "@/lib/auth";
import type { EnrichedTicket } from "@/lib/tickets";
import { apiFetch } from "@/lib/api-client";
import { ConfirmModal } from "./Toast";
import { ClockIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from "./Icons";

interface CategoriesViewProps {
  currentUser: SafeUser;
  categories: Category[];
  tickets: EnrichedTicket[];
  onRefresh: () => Promise<void>;
  onNotify: (type: "success" | "error" | "info", msg: string) => void;
}

const COLORS = [
  "#2563eb",
  "#4f46e5",
  "#0891b2",
  "#059669",
  "#7c3aed",
  "#d97706",
  "#dc2626",
  "#475569",
];

const SLA_PRESETS = [2, 4, 8, 12, 24, 48];

export default function CategoriesView({
  currentUser,
  categories,
  tickets,
  onRefresh,
  onNotify,
}: CategoriesViewProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [deletingCat, setDeletingCat] = useState<Category | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const canManage =
    currentUser.role === "admin" || currentUser.role === "agent";

  async function confirmDelete() {
    if (!deletingCat) return;
    setDeletingLoading(true);
    try {
      const { status, data } = await apiFetch<{ ok: boolean; error?: string }>(
        `/api/categories/${deletingCat.id}`,
        { method: "DELETE" }
      );
      if (status >= 200 && status < 300 && data.ok) {
        onNotify("success", `បានលុបប្រភេទ "${deletingCat.name}" រួចរាល់`);
        setDeletingCat(null);
        await onRefresh();
      } else {
        onNotify("error", data.error || "មិនអាចលុបប្រភេទបញ្ហានេះបានទេ។");
      }
    } finally {
      setDeletingLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            ប្រភេទបញ្ហា និងគោលដៅពេលវេលា SLA
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            កំណត់ប្រភេទសំណើជំនួយ និងរយៈពេលកំណត់ដោះស្រាយសម្រាប់ក្រុមបច្ចេកទេស
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>បន្ថែមប្រភេទថ្មី</span>
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <div className="surface-card p-12 text-center text-slate-500 text-sm">
          មិនទាន់មានប្រភេទបញ្ហានៅឡើយទេ
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const catTickets = tickets.filter((t) => t.categoryId === cat.id);
            const total = catTickets.length;
            const resolved = catTickets.filter(
              (t) => t.status === "resolved" || t.status === "closed"
            ).length;
            const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;

            return (
              <div
                key={cat.id}
                className="surface-card p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        style={{ backgroundColor: cat.color }}
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                      />
                      <h3 className="font-semibold text-slate-900 text-sm leading-snug">
                        {cat.name}
                      </h3>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingCat(cat)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                          title="កែប្រែ"
                        >
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                        {currentUser.role === "admin" && (
                          <button
                            type="button"
                            onClick={() => setDeletingCat(cat)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="លុប"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    {cat.description || "គ្មានការពិពណ៌នាបន្ថែម"}
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>អត្រាដោះស្រាយរួច</span>
                      <span className="font-medium text-slate-700 tabular-nums">
                        {resolved}/{total} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        style={{
                          width: `${pct}%`,
                          backgroundColor: cat.color,
                        }}
                        className="h-full rounded-full transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>គោលដៅ SLA៖ {cat.slaHours} ម៉ោង</span>
                    </span>
                    <span className="text-slate-500 font-medium tabular-nums">
                      {total} សំណើ
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CategoryEditorModal
          mode="create"
          onClose={() => setShowCreateModal(false)}
          onSaved={async () => {
            setShowCreateModal(false);
            onNotify("success", "បានបន្ថែមប្រភេទបញ្ហាថ្មីរួចរាល់");
            await onRefresh();
          }}
        />
      )}

      {editingCat && (
        <CategoryEditorModal
          mode="edit"
          target={editingCat}
          onClose={() => setEditingCat(null)}
          onSaved={async () => {
            setEditingCat(null);
            onNotify("success", "បានកែសម្រួលប្រភេទបញ្ហារួចរាល់");
            await onRefresh();
          }}
        />
      )}

      {deletingCat && (
        <ConfirmModal
          title={`លុបប្រភេទ "${deletingCat.name}"?`}
          description="តើអ្នកពិតជាចង់លុបប្រភេទបញ្ហានេះមែនទេ? សំណើដែលស្ថិតក្នុងប្រភេទនេះនឹងមិនបាត់បង់ទេ។"
          confirmLabel="យល់ព្រមលុប"
          loading={deletingLoading}
          onCancel={() => setDeletingCat(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}

function CategoryEditorModal({
  mode,
  target,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  target?: Category;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(target?.name ?? "");
  const [description, setDescription] = useState(target?.description ?? "");
  const [slaHours, setSlaHours] = useState(String(target?.slaHours ?? 12));
  const [color, setColor] = useState(target?.color ?? COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url =
        mode === "create" ? "/api/categories" : `/api/categories/${target?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const { status, data } = await apiFetch<{ ok: boolean; error?: string }>(
        url,
        {
          method,
          body: JSON.stringify({
            name,
            description,
            color,
            slaHours: Math.max(1, Number(slaHours) || 24),
          }),
        }
      );

      if (status >= 200 && status < 300 && data.ok) {
        await onSaved();
      } else {
        setError(data.error || "មិនអាចរក្សាទុកទិន្នន័យបានទេ។");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              style={{ backgroundColor: color }}
              className="h-3 w-3 rounded-full"
            />
            <h3 className="text-sm font-semibold text-slate-900">
              {mode === "create" ? "បន្ថែមប្រភេទបញ្ហាថ្មី" : "កែសម្រួលប្រភេទបញ្ហា"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ឈ្មោះប្រភេទបញ្ហា *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ឧ. ប្រព័ន្ធបណ្ដាញ និងអ៊ីនធឺណិត"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ការពិពណ៌នា
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="បញ្ជាក់ពីវិសាលភាពបញ្ហា..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              គោលដៅពេលវេលាដោះស្រាយ SLA (ម៉ោង)
            </label>
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              {SLA_PRESETS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setSlaHours(String(h))}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition cursor-pointer ${
                    Number(slaHours) === h
                      ? "bg-slate-900 border-slate-900 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {h} ម៉ោង
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              max={720}
              required
              value={slaHours}
              onChange={(e) => setSlaHours(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              ពណ៌សម្គាល់
            </label>
            <div className="flex items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`h-6 w-6 rounded-full cursor-pointer transition ${
                    color === c
                      ? "ring-2 ring-offset-2 ring-slate-900"
                      : "opacity-75 hover:opacity-100"
                  }`}
                />
              ))}
            </div>
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
              disabled={saving}
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
