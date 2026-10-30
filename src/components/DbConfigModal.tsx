"use client";

import React, { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { DatabaseIcon, XIcon } from "./Icons";

interface DbConfigModalProps {
  initialHost?: string;
  initialPort?: number;
  initialUser?: string;
  initialDatabase?: string;
  currentMode: "postgresql" | "local";
  fallbackReason?: string | null;
  onClose: () => void;
  onConnected: () => void;
}

export default function DbConfigModal({
  initialHost = "127.0.0.1",
  initialPort = 5432,
  initialUser = "postgres",
  initialDatabase = "helpdesk",
  currentMode,
  fallbackReason,
  onClose,
  onConnected,
}: DbConfigModalProps) {
  const [host, setHost] = useState(initialHost);
  const [port, setPort] = useState(String(initialPort));
  const [user, setUser] = useState(initialUser);
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState(initialDatabase);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { status, data } = await apiFetch<{
        ok: boolean;
        message?: string;
        error?: string;
      }>("/api/db-config", {
        method: "POST",
        body: JSON.stringify({
          host,
          port: Number(port) || 5432,
          user,
          password,
          database,
        }),
      });

      if (status >= 200 && status < 300 && data.ok) {
        setSuccess(data.message || "ភ្ជាប់ទៅ PostgreSQL បានជោគជ័យ");
        setTimeout(() => {
          onConnected();
          onClose();
        }, 650);
      } else {
        setError(data.error || "មិនអាចភ្ជាប់ទៅ PostgreSQL បានទេ។");
      }
    } catch {
      setError("មានបញ្ហាក្នុងការទាក់ទង Server។");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <DatabaseIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                ការកំណត់ការភ្ជាប់ PostgreSQL
              </h2>
              <p className="text-xs text-slate-500">
                ស្ថានភាព៖{" "}
                {currentMode === "postgresql" ? (
                  <span className="text-emerald-700 font-medium">
                    បានភ្ជាប់ PostgreSQL ({initialDatabase})
                  </span>
                ) : (
                  <span className="text-slate-700 font-medium">
                    កំពុងប្រើ Local Storage (.helpdesk-data)
                  </span>
                )}
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
          {currentMode === "local" && fallbackReason && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
              មូលហេតុ៖{" "}
              <code className="font-mono bg-amber-100 px-1 rounded">
                {fallbackReason}
              </code>
              ។ សូមបញ្ចូលពាក្យសម្ងាត់ PostgreSQL លើម៉ាស៊ីនអ្នកដើម្បីភ្ជាប់ផ្ទាល់។
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              {success}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Host
              </label>
              <input
                type="text"
                required
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Port
              </label>
              <input
                type="number"
                required
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                User
              </label>
              <input
                type="text"
                required
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Database
              </label>
              <input
                type="text"
                required
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ពាក្យសម្ងាត់ PostgreSQL
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ពាក្យសម្ងាត់របស់ postgres..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
            >
              បិទ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer disabled:opacity-60"
            >
              {saving ? "កំពុងភ្ជាប់..." : "រក្សាទុក និងភ្ជាប់"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
