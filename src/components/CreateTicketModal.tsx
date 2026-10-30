"use client";

import React, { useState } from "react";
import type { Category } from "@/db/schema";
import type { SafeUser } from "@/lib/auth";
import type { EnrichedTicket } from "@/lib/tickets";
import { apiFetch } from "@/lib/api-client";
import { TicketIcon, XIcon } from "./Icons";

interface CreateTicketModalProps {
  currentUser: SafeUser;
  categories: Category[];
  staffUsers: SafeUser[];
  onClose: () => void;
  onCreated: (ticket: EnrichedTicket) => void;
}

export default function CreateTicketModal({
  currentUser,
  categories,
  staffUsers,
  onClose,
  onCreated,
}: CreateTicketModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [categoryId, setCategoryId] = useState<string>(
    categories[0] ? String(categories[0].id) : ""
  );
  const [location, setLocation] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [requesterId, setRequesterId] = useState<string>(String(currentUser.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStaff = currentUser.role === "admin" || currentUser.role === "agent";
  const agents = staffUsers.filter(
    (u) => (u.role === "admin" || u.role === "agent") && u.isActive
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { status, data } = await apiFetch<{
        ok: boolean;
        ticket?: EnrichedTicket;
        error?: string;
      }>("/api/tickets", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          priority,
          categoryId: categoryId ? Number(categoryId) : null,
          location,
          ...(isStaff && assigneeId ? { assigneeId: Number(assigneeId) } : {}),
          ...(isStaff && requesterId
            ? { requesterId: Number(requesterId) }
            : {}),
        }),
      });

      if (status >= 200 && status < 300 && data.ok && data.ticket) {
        onCreated(data.ticket);
      } else {
        setError(data.error || "មិនអាចបង្កើតសំណើថ្មីបានទេ។");
      }
    } catch {
      setError("មានបញ្ហាបណ្ដាញ មិនអាចផ្ញើទិន្នន័យបានទេ។");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px] p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-xl overflow-hidden my-auto">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <TicketIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                បង្កើតសំណើជំនួយថ្មី
              </h2>
              <p className="text-xs text-slate-500">
                បំពេញព័ត៌មានបញ្ហាដើម្បីដាក់ជូនក្រុមការងារបច្ចេកទេស
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ចំណងជើងបញ្ហា *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ឧ. ភ្ជាប់ Wi-Fi ជាន់ទី ២ មិនបាន"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ប្រភេទបញ្ហា
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-slate-900"
              >
                <option value="">-- ទូទៅ --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                កម្រិតអាទិភាព
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-slate-900"
              >
                <option value="low">ទាប</option>
                <option value="medium">មធ្យម</option>
                <option value="high">ខ្ពស់</option>
                <option value="urgent">បន្ទាន់</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ទីតាំង / បន្ទប់ការិយាល័យ
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="ឧ. ជាន់ទី ២ - គណនេយ្យ"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            {isStaff && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ចាត់តាំងអ្នកទទួលបន្ទុក
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                >
                  <option value="">-- មិនទាន់ចាត់តាំង --</option>
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {isStaff && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                អ្នកស្នើសុំជំនួយ
              </label>
              <select
                value={requesterId}
                onChange={(e) => setRequesterId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-slate-900"
              >
                {staffUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} (@{u.username})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ការពិពណ៌នាលម្អិត *
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="សូមរៀបរាប់ពីអាការៈបញ្ហា ឬកូដ Error ដែលជួបប្រទះ..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900 leading-relaxed"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
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
              {saving ? "កំពុងរក្សាទុក..." : "ដាក់ស្នើសំណើ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
