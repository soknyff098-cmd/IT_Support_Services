"use client";

import React, { useEffect, useState } from "react";
import type { Category } from "@/db/schema";
import type { SafeUser } from "@/lib/auth";
import type { EnrichedComment, EnrichedTicket } from "@/lib/tickets";
import { apiFetch } from "@/lib/api-client";
import {
  formatDateTime,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
} from "@/lib/constants";
import { ConfirmModal } from "./Toast";
import { UserAvatar } from "./UserAvatar";
import {
  LockIcon,
  MessageSquareIcon,
  PencilIcon,
  TrashIcon,
  XIcon,
} from "./Icons";

interface TicketDetailModalProps {
  ticketId: number;
  currentUser: SafeUser;
  categories: Category[];
  staffUsers: SafeUser[];
  onClose: () => void;
  onUpdated: (ticket: EnrichedTicket) => void;
  onDeleted: (ticketId: number) => void;
  onNotify: (type: "success" | "error" | "info", msg: string) => void;
}

export default function TicketDetailModal({
  ticketId,
  currentUser,
  categories,
  staffUsers,
  onClose,
  onUpdated,
  onDeleted,
  onNotify,
}: TicketDetailModalProps) {
  const [ticket, setTicket] = useState<EnrichedTicket | null>(null);
  const [comments, setComments] = useState<EnrichedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingField, setUpdatingField] = useState(false);

  const [isEditingTicket, setIsEditingTicket] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editRequesterId, setEditRequesterId] = useState<string>("");

  const [replyText, setReplyText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [editingCommentInternal, setEditingCommentInternal] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(
    null
  );

  const [confirmDeleteTicket, setConfirmDeleteTicket] = useState(false);
  const [deletingTicketLoading, setDeletingTicketLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const isStaff = currentUser.role === "admin" || currentUser.role === "agent";
  const agents = staffUsers.filter(
    (u) => (u.role === "admin" || u.role === "agent") && u.isActive
  );

  useEffect(() => {
    let active = true;
    apiFetch<{
      ok: boolean;
      ticket?: EnrichedTicket;
      comments?: EnrichedComment[];
      error?: string;
    }>(`/api/tickets/${ticketId}`)
      .then(({ status, data }) => {
        if (!active) return;
        if (status >= 200 && status < 300 && data.ok && data.ticket) {
          setTicket(data.ticket);
          setComments(data.comments ?? []);
          setEditTitle(data.ticket.title);
          setEditDescription(data.ticket.description);
          setEditLocation(data.ticket.location ?? "");
          setEditRequesterId(String(data.ticket.requesterId));
        } else {
          setError(data.error || "មិនអាចទាញយកទិន្នន័យសំណើនេះបានទេ។");
        }
      })
      .catch(() => {
        if (active) setError("មានបញ្ហាក្នុងការទាញយកទិន្នន័យ។");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ticketId]);

  async function patchTicket(
    payload: Record<string, unknown>,
    toastMsg?: string
  ) {
    if (!ticket) return false;
    setUpdatingField(true);
    setError(null);
    try {
      const { status, data } = await apiFetch<{
        ok: boolean;
        ticket?: EnrichedTicket;
        error?: string;
      }>(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      if (status >= 200 && status < 300 && data.ok && data.ticket) {
        setTicket(data.ticket);
        setEditTitle(data.ticket.title);
        setEditDescription(data.ticket.description);
        setEditLocation(data.ticket.location ?? "");
        setEditRequesterId(String(data.ticket.requesterId));
        onUpdated(data.ticket);
        if (toastMsg) onNotify("success", toastMsg);
        return true;
      } else {
        setError(data.error || "មិនអាចកែប្រែសំណើបានទេ។");
        return false;
      }
    } catch {
      setError("មានបញ្ហាបណ្ដាញពេលកែប្រែទិន្នន័យ។");
      return false;
    } finally {
      setUpdatingField(false);
    }
  }

  async function handleSaveTicketContent(e: React.FormEvent) {
    e.preventDefault();
    const ok = await patchTicket(
      {
        title: editTitle,
        description: editDescription,
        location: editLocation,
        ...(isStaff && editRequesterId
          ? { requesterId: Number(editRequesterId) }
          : {}),
      },
      "បានរក្សាទុកការកែសម្រួលសំណើរួចរាល់"
    );
    if (ok) setIsEditingTicket(false);
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || !replyText.trim()) return;
    setSendingReply(true);
    setError(null);

    try {
      const { status, data } = await apiFetch<{
        ok: boolean;
        comments?: EnrichedComment[];
        error?: string;
      }>(`/api/tickets/${ticket.id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          message: replyText,
          isInternal: isStaff ? isInternal : false,
        }),
      });

      if (status >= 200 && status < 300 && data.ok && data.comments) {
        setComments(data.comments);
        setReplyText("");
        setIsInternal(false);
        const updatedTicket: EnrichedTicket = {
          ...ticket,
          commentCount: data.comments.length,
          updatedAt: new Date().toISOString(),
        };
        setTicket(updatedTicket);
        onUpdated(updatedTicket);
        onNotify("success", "បានផ្ញើមតិឆ្លើយតបរួចរាល់");
      } else {
        setError(data.error || "មិនអាចផ្ញើមតិឆ្លើយតបបានទេ។");
      }
    } catch {
      setError("មានបញ្ហាបណ្ដាញពេលផ្ញើមតិឆ្លើយតប។");
    } finally {
      setSendingReply(false);
    }
  }

  async function handleSaveEditedComment(commentId: number) {
    if (!ticket || !editingCommentText.trim()) return;
    const { status, data } = await apiFetch<{
      ok: boolean;
      comments?: EnrichedComment[];
      error?: string;
    }>(`/api/tickets/${ticket.id}/comments/${commentId}`, {
      method: "PATCH",
      body: JSON.stringify({
        message: editingCommentText,
        isInternal: editingCommentInternal,
      }),
    });

    if (status >= 200 && status < 300 && data.ok && data.comments) {
      setComments(data.comments);
      setEditingCommentId(null);
      onNotify("success", "បានកែសម្រួលមតិឆ្លើយតបរួចរាល់");
    } else {
      onNotify("error", data.error || "មិនអាចកែមតិឆ្លើយតបបានទេ។");
    }
  }

  async function handleConfirmDeleteComment() {
    if (!ticket || deletingCommentId === null) return;
    const { status, data } = await apiFetch<{
      ok: boolean;
      comments?: EnrichedComment[];
      error?: string;
    }>(`/api/tickets/${ticket.id}/comments/${deletingCommentId}`, {
      method: "DELETE",
    });

    if (status >= 200 && status < 300 && data.ok && data.comments) {
      setComments(data.comments);
      setDeletingCommentId(null);
      const updatedTicket: EnrichedTicket = {
        ...ticket,
        commentCount: data.comments.length,
      };
      setTicket(updatedTicket);
      onUpdated(updatedTicket);
      onNotify("success", "បានលុបមតិឆ្លើយតបរួចរាល់");
    } else {
      onNotify("error", data.error || "មិនអាចលុបមតិបានទេ។");
    }
  }

  async function executeDeleteTicket() {
    if (!ticket) return;
    setDeletingTicketLoading(true);
    try {
      const { status, data } = await apiFetch<{ ok: boolean; error?: string }>(
        `/api/tickets/${ticket.id}`,
        { method: "DELETE" }
      );
      if (status >= 200 && status < 300 && data.ok) {
        onNotify("success", `បានលុបសំណើ ${ticket.ticketCode} រួចរាល់`);
        onDeleted(ticket.id);
      } else {
        setError(data.error || "មិនអាចលុបសំណើបានទេ។");
        setConfirmDeleteTicket(false);
      }
    } finally {
      setDeletingTicketLoading(false);
    }
  }

  const canEditTicket =
    ticket && (isStaff || ticket.requesterId === currentUser.id);
  const canDeleteTicket =
    ticket &&
    (currentUser.role === "admin" ||
      (ticket.requesterId === currentUser.id && ticket.status === "open"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px] p-3 sm:p-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
              {ticket?.ticketCode ?? `#${ticketId}`}
            </span>
            {ticket && (
              <>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-md border ${
                    STATUS_CONFIG[ticket.status].badgeClass
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      STATUS_CONFIG[ticket.status].dotClass
                    }`}
                  />
                  {STATUS_CONFIG[ticket.status].label}
                </span>
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-md border ${
                    PRIORITY_CONFIG[ticket.priority].badgeClass
                  }`}
                >
                  {PRIORITY_CONFIG[ticket.priority].label}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canEditTicket && (
              <button
                type="button"
                onClick={() => setIsEditingTicket((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  isEditingTicket
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <PencilIcon className="w-3.5 h-3.5" />
                <span>{isEditingTicket ? "បិទការកែប្រែ" : "កែប្រែសំណើ"}</span>
              </button>
            )}

            {canDeleteTicket && (
              <button
                type="button"
                onClick={() => setConfirmDeleteTicket(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 cursor-pointer"
                title="លុបសំណើ"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                <span>លុប</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-14 text-center text-slate-500 text-sm">
            កំពុងទាញយកព័ត៌មានលម្អិត...
          </div>
        ) : !ticket ? (
          <div className="p-14 text-center text-rose-600 text-sm">
            {error || "រកមិនឃើញទិន្នន័យសំណើនេះទេ"}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12">
            {/* Left Main Content & Conversation */}
            <div className="lg:col-span-8 p-5 sm:p-6 space-y-6 border-b lg:border-b-0 lg:border-r border-slate-200">
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {error}
                </div>
              )}

              {isEditingTicket ? (
                <form
                  onSubmit={handleSaveTicketContent}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4"
                >
                  <div className="text-xs font-semibold text-slate-700">
                    កែសម្រួលមាតិកាសំណើ
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      ចំណងជើងបញ្ហា *
                    </label>
                    <input
                      type="text"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        ទីតាំង / បន្ទប់ការិយាល័យ
                      </label>
                      <input
                        type="text"
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        placeholder="ឧ. ជាន់ទី ២ - គណនេយ្យ"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                      />
                    </div>

                    {isStaff && (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          អ្នកស្នើសុំ
                        </label>
                        <select
                          value={editRequesterId}
                          onChange={(e) => setEditRequesterId(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                        >
                          {staffUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.fullName} (@{u.username})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      ការពិពណ៌នាលម្អិត *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingTicket(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 cursor-pointer"
                    >
                      បោះបង់
                    </button>
                    <button
                      type="submit"
                      disabled={updatingField}
                      className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer"
                    >
                      {updatingField ? "កំពុងរក្សាទុក..." : "រក្សាទុក"}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 leading-snug mb-2">
                      {ticket.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <UserAvatar name={ticket.requester.fullName} avatarColor={ticket.requester.avatarColor} avatarUrl={ticket.requester.avatarUrl} size="xs" />
                        <span>
                          ស្នើដោយ{" "}
                          <strong className="text-slate-800 font-medium">
                            {ticket.requester.fullName}
                          </strong>{" "}
                          ({ticket.requester.department})
                        </span>
                      </span>
                      <span>•</span>
                      <span>{formatDateTime(ticket.createdAt)}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {ticket.description}
                  </div>
                </>
              )}

              {/* Conversation Thread */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <MessageSquareIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>ការសន្ទនា និងកំណត់ត្រា ({comments.length})</span>
                </div>

                {comments.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    មិនទាន់មានមតិឆ្លើយតបនៅឡើយទេ
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {comments.map((c) => {
                      const canModifyComment =
                        currentUser.role === "admin" ||
                        c.authorId === currentUser.id;
                      const isBeingEdited = editingCommentId === c.id;

                      return (
                        <div
                          key={c.id}
                          className={`p-3.5 rounded-xl border text-sm ${
                            c.isInternal
                              ? "bg-amber-50/50 border-amber-200"
                              : "bg-white border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <UserAvatar name={c.author.fullName} avatarColor={c.author.avatarColor} avatarUrl={c.author.avatarUrl} size="sm" />
                              <span className="font-medium text-slate-900 text-xs">
                                {c.author.fullName}
                              </span>
                              {c.isInternal && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                                  <LockIcon className="w-3 h-3" />
                                  <span>កំណត់ត្រាផ្ទៃក្នុង IT</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-400">
                                {formatDateTime(c.createdAt)}
                              </span>
                              {canModifyComment && !isBeingEdited && (
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCommentId(c.id);
                                      setEditingCommentText(c.message);
                                      setEditingCommentInternal(c.isInternal);
                                    }}
                                    className="p-1 text-slate-400 hover:text-slate-800 rounded cursor-pointer"
                                    title="កែមតិ"
                                  >
                                    <PencilIcon className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingCommentId(c.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                    title="លុបមតិ"
                                  >
                                    <TrashIcon className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {isBeingEdited ? (
                            <div className="pl-8 space-y-2">
                              <textarea
                                rows={3}
                                value={editingCommentText}
                                onChange={(e) =>
                                  setEditingCommentText(e.target.value)
                                }
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
                              />
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                {isStaff ? (
                                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editingCommentInternal}
                                      onChange={(e) =>
                                        setEditingCommentInternal(
                                          e.target.checked
                                        )
                                      }
                                    />
                                    <span>កំណត់ត្រាផ្ទៃក្នុង IT</span>
                                  </label>
                                ) : (
                                  <span />
                                )}
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingCommentId(null)}
                                    className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-600 cursor-pointer"
                                  >
                                    បោះបង់
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleSaveEditedComment(c.id)
                                    }
                                    className="px-3 py-1 rounded-md bg-slate-900 text-white text-xs font-medium cursor-pointer"
                                  >
                                    រក្សាទុក
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed pl-8 text-xs sm:text-sm">
                              {c.message}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Comment Box */}
                <form onSubmit={handleSendReply} className="space-y-2.5 pt-1">
                  <textarea
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="សរសេរការឆ្លើយតប ឬព័ត៌មានបន្ថែម..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-slate-900 leading-relaxed"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {isStaff ? (
                      <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                          className="rounded border-slate-300 text-slate-900"
                        />
                        <LockIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>កំណត់ត្រាផ្ទៃក្នុង (សម្រាប់ក្រុម IT)</span>
                      </label>
                    ) : (
                      <span />
                    )}

                    <button
                      type="submit"
                      disabled={sendingReply || !replyText.trim()}
                      className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer disabled:opacity-50"
                    >
                      {sendingReply ? "កំពុងផ្ញើ..." : "ផ្ញើការឆ្លើយតប"}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Sidebar Workflow Controls */}
            <div className="lg:col-span-4 p-5 sm:p-6 bg-slate-50/60 space-y-4 text-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                ព័ត៌មានគ្រប់គ្រង
              </h3>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  ស្ថានភាព
                </label>
                {isStaff ? (
                  <select
                    disabled={updatingField}
                    value={ticket.status}
                    onChange={(e) =>
                      void patchTicket(
                        { status: e.target.value },
                        "បានប្ដូរស្ថានភាពសំណើ"
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs sm:text-sm"
                  >
                    <option value="open">រង់ចាំដោះស្រាយ</option>
                    <option value="in_progress">កំពុងដំណើរការ</option>
                    <option value="resolved">ដោះស្រាយរួច</option>
                    <option value="closed">បិទបញ្ចប់</option>
                  </select>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-md border ${
                        STATUS_CONFIG[ticket.status].badgeClass
                      }`}
                    >
                      {STATUS_CONFIG[ticket.status].label}
                    </span>
                    {ticket.status !== "closed" ? (
                      <button
                        type="button"
                        disabled={updatingField}
                        onClick={() =>
                          void patchTicket(
                            { status: "closed" },
                            "បានបិទបញ្ចប់សំណើ"
                          )
                        }
                        className="text-xs font-medium px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                      >
                        បិទបញ្ចប់
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={updatingField}
                        onClick={() =>
                          void patchTicket(
                            { status: "open" },
                            "បានបើកសំណើឡើងវិញ"
                          )
                        }
                        className="text-xs font-medium px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                      >
                        បើកឡើងវិញ
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  កម្រិតអាទិភាព
                </label>
                {canEditTicket ? (
                  <select
                    disabled={updatingField}
                    value={ticket.priority}
                    onChange={(e) =>
                      void patchTicket(
                        { priority: e.target.value },
                        "បានប្ដូរកម្រិតអាទិភាព"
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs sm:text-sm"
                  >
                    <option value="low">ទាប</option>
                    <option value="medium">មធ្យម</option>
                    <option value="high">ខ្ពស់</option>
                    <option value="urgent">បន្ទាន់</option>
                  </select>
                ) : (
                  <div className="text-slate-800 text-xs font-medium">
                    {PRIORITY_CONFIG[ticket.priority].label}
                  </div>
                )}
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  អ្នកទទួលបន្ទុក
                </label>
                {isStaff ? (
                  <select
                    disabled={updatingField}
                    value={ticket.assigneeId ?? ""}
                    onChange={(e) =>
                      void patchTicket(
                        {
                          assigneeId: e.target.value
                            ? Number(e.target.value)
                            : null,
                        },
                        "បានកែប្រែអ្នកទទួលបន្ទុក"
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs sm:text-sm"
                  >
                    <option value="">-- មិនទាន់ចាត់តាំង --</option>
                    {agents.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.fullName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-slate-800 text-xs font-medium">
                    {ticket.assignee
                      ? ticket.assignee.fullName
                      : "រង់ចាំចាត់តាំង"}
                  </div>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  ប្រភេទបញ្ហា
                </label>
                {canEditTicket ? (
                  <select
                    disabled={updatingField}
                    value={ticket.categoryId ?? ""}
                    onChange={(e) =>
                      void patchTicket(
                        {
                          categoryId: e.target.value
                            ? Number(e.target.value)
                            : null,
                        },
                        "បានប្ដូរប្រភេទបញ្ហា"
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs sm:text-sm"
                  >
                    <option value="">-- មិនកំណត់ --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-slate-800 text-xs">
                    {ticket.category?.name ?? "ទូទៅ"}
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="pt-4 border-t border-slate-200 space-y-2 text-xs text-slate-600">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">ទីតាំង</span>
                  <span className="font-medium text-slate-800 text-right">
                    {ticket.location || "—"}
                  </span>
                </div>
                {ticket.category && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">គោលដៅ SLA</span>
                    <span className="font-medium text-slate-800">
                      {ticket.category.slaHours} ម៉ោង
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">កែប្រែចុងក្រោយ</span>
                  <span className="text-slate-800">
                    {formatDateTime(ticket.updatedAt)}
                  </span>
                </div>
                {ticket.resolvedAt && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">ដោះស្រាយរួច</span>
                    <span className="font-medium text-emerald-700">
                      {formatDateTime(ticket.resolvedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {confirmDeleteTicket && ticket && (
        <ConfirmModal
          title={`លុបសំណើ ${ticket.ticketCode}?`}
          description={`តើអ្នកពិតជាចង់លុបសំណើ "${ticket.title}" ចេញពីប្រព័ន្ធមែនទេ?`}
          confirmLabel="យល់ព្រមលុប"
          loading={deletingTicketLoading}
          onCancel={() => setConfirmDeleteTicket(false)}
          onConfirm={() => void executeDeleteTicket()}
        />
      )}

      {deletingCommentId !== null && (
        <ConfirmModal
          title="លុបមតិឆ្លើយតប?"
          description="តើអ្នកពិតជាចង់លុបមតិឆ្លើយតបនេះចេញពីការសន្ទនាមែនទេ?"
          confirmLabel="យល់ព្រមលុប"
          onCancel={() => setDeletingCommentId(null)}
          onConfirm={() => void handleConfirmDeleteComment()}
        />
      )}
    </div>
  );
}
