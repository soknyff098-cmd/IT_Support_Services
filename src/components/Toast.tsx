"use client";

import React from "react";
import { AlertCircleIcon, CheckIcon, XIcon } from "./Icons";

export interface ToastItem {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-white border border-slate-200 shadow-lg text-xs sm:text-sm text-slate-900"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 ${
                t.type === "success"
                  ? "bg-emerald-50 text-emerald-600"
                  : t.type === "error"
                  ? "bg-rose-50 text-rose-600"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {t.type === "success" ? (
                <CheckIcon className="w-3.5 h-3.5" />
              ) : (
                <AlertCircleIcon className="w-3.5 h-3.5" />
              )}
            </span>
            <span className="font-medium leading-snug">{t.message}</span>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer shrink-0"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ConfirmModal({
  title,
  description,
  confirmLabel = "យល់ព្រមលុប",
  danger = true,
  loading = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-5 space-y-2.5">
          <div className="flex items-center gap-3">
            <div
              className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                danger
                  ? "bg-rose-50 text-rose-600 border border-rose-200/70"
                  : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
            >
              <AlertCircleIcon className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900">
              {title}
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {description}
          </p>
        </div>
        <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
          >
            បោះបង់
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`px-3.5 py-1.5 rounded-lg text-white text-xs font-medium cursor-pointer disabled:opacity-60 ${
              danger
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            {loading ? "កំពុងដំណើរការ..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
