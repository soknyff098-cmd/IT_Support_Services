"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { SafeUser } from "@/lib/auth";
import { apiFetch, setClientToken } from "@/lib/api-client";
import { ROLE_CONFIG } from "@/lib/constants";
import DbConfigModal from "./DbConfigModal";
import { AvatarPicker, UserAvatar } from "./UserAvatar";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  DatabaseIcon,
  LogoMarkIcon,
} from "./Icons";

interface AuthScreenProps {
  onAuthenticated: (user: SafeUser) => void;
}

interface QuickUserItem {
  id: number;
  fullName: string;
  username: string;
  role: "admin" | "agent" | "user";
  avatarColor: string;
  avatarUrl: string | null;
}

interface HealthResponse {
  ok: boolean;
  connected?: boolean;
  mode?: "postgresql" | "local";
  database?: string;
  host?: string;
  port?: number;
  user?: string;
  fallbackReason?: string | null;
  quickUsers?: QuickUserItem[];
  error?: string;
}

interface AuthResponse {
  ok: boolean;
  token?: string;
  user?: SafeUser;
  error?: string;
}

const REG_COLORS = [
  "#2563eb",
  "#4f46e5",
  "#0891b2",
  "#059669",
  "#7c3aed",
  "#d97706",
];

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const loginPasswordRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regDepartment, setRegDepartment] = useState("ទូទៅ");
  const [regPassword, setRegPassword] = useState("");
  const [regAvatarColor, setRegAvatarColor] = useState(REG_COLORS[0]);
  const [regAvatarUrl, setRegAvatarUrl] = useState<string | null>(null);
  const [regAvatarBusy, setRegAvatarBusy] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDbModal, setShowDbModal] = useState(false);
  const [quickUsers, setQuickUsers] = useState<QuickUserItem[]>([]);
  const [dbHealth, setDbHealth] = useState<{
    connected: boolean;
    dbMode: "postgresql" | "local";
    host: string;
    port: number;
    user: string;
    database: string;
    fallbackReason: string | null;
    label: string;
  }>({
    connected: true,
    dbMode: "postgresql",
    host: "127.0.0.1",
    port: 5432,
    user: "postgres",
    database: "helpdesk",
    fallbackReason: null,
    label: "PostgreSQL • helpdesk",
  });

  const refreshHealth = useCallback(async () => {
    try {
      const { data } = await apiFetch<HealthResponse>("/api/health");
      if (data.ok && data.connected) {
        const activeMode = data.mode ?? "postgresql";
        setDbHealth({
          connected: true,
          dbMode: activeMode,
          host: data.host ?? "127.0.0.1",
          port: data.port ?? 5432,
          user: data.user ?? "postgres",
          database: data.database ?? "helpdesk",
          fallbackReason: data.fallbackReason ?? null,
          label:
            activeMode === "postgresql"
              ? `PostgreSQL • ${data.database ?? "helpdesk"}`
              : "Local Storage",
        });
        if (data.quickUsers) {
          setQuickUsers(data.quickUsers);
        }
      }
    } catch {
      // Ignore transient check error
    }
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<HealthResponse>("/api/health")
      .then(({ data }) => {
        if (!active) return;
        if (data.ok && data.connected) {
          const activeMode = data.mode ?? "postgresql";
          setDbHealth({
            connected: true,
            dbMode: activeMode,
            host: data.host ?? "127.0.0.1",
            port: data.port ?? 5432,
            user: data.user ?? "postgres",
            database: data.database ?? "helpdesk",
            fallbackReason: data.fallbackReason ?? null,
            label:
              activeMode === "postgresql"
                ? `PostgreSQL • ${data.database ?? "helpdesk"}`
                : "Local Storage",
          });
          if (data.quickUsers && data.quickUsers.length > 0) {
            setQuickUsers(data.quickUsers);
            setIdentifier((current) => current || data.quickUsers![0].username);
          }
        }
      })
      .catch(() => null);

    return () => {
      active = false;
    };
  }, []);

  async function performLogin(loginId: string, loginPass: string) {
    setError(null);
    setSubmitting(true);
    try {
      const { status, data } = await apiFetch<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: loginId,
          password: loginPass,
        }),
      });

      if (status >= 200 && status < 300 && data.ok && data.user) {
        if (data.token) {
          setClientToken(data.token);
        }
        onAuthenticated(data.user);
      } else {
        setError(
          data.error ||
            "មិនអាចចូលប្រើប្រាស់បានទេ សូមពិនិត្យឈ្មោះគណនី និងពាក្យសម្ងាត់ម្ដងទៀត។"
        );
      }
    } catch {
      setError("មានបញ្ហាបណ្ដាញ មិនអាចផ្ញើសំណើចូលគណនីបានទេ។");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    await performLogin(identifier, password);
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || regAvatarBusy) return;
    setError(null);
    setSubmitting(true);
    try {
      const { status, data } = await apiFetch<AuthResponse>(
        "/api/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            fullName,
            username: regUsername,
            email: regEmail,
            department: regDepartment,
            password: regPassword,
            avatarColor: regAvatarColor,
            avatarUrl: regAvatarUrl,
          }),
        }
      );

      if (status >= 200 && status < 300 && data.ok && data.user) {
        if (data.token) {
          setClientToken(data.token);
        }
        onAuthenticated(data.user);
      } else {
        setError(data.error || "មិនអាចបង្កើតគណនីថ្មីបានទេ។");
      }
    } catch {
      setError("មានបញ្ហាបណ្ដាញ មិនអាចបង្កើតគណនីបានទេ។");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-backdrop flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[460px] space-y-5">
        {/* Clean Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <div className="h-11 w-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm ring-4 ring-white/80">
            <LogoMarkIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight">
              ប្រព័ន្ធគ្រប់គ្រងសំណើជំនួយ IT Helpdesk
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              ចូលគណនីដើម្បីគ្រប់គ្រងសំណើ អ្នកប្រើប្រាស់ និងការងារបច្ចេកទេស
            </p>
          </div>
        </div>

        {/* Elevated Frosted Auth Panel */}
        <div className="surface-card p-6 sm:p-7 space-y-5">
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100/90 border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                mode === "login"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              ចូលប្រើប្រាស់
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                mode === "register"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              បង្កើតគណនីថ្មី
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === "login" ? (
            <>
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label htmlFor="login-identifier" className="block text-xs font-medium text-slate-700 mb-1.5">
                    អ៊ីមែល ឬ Username
                  </label>
                  <input
                    id="login-identifier"
                    type="text"
                    required
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="admin@helpdesk.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-slate-900"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="block text-xs font-medium text-slate-700">
                      ពាក្យសម្ងាត់
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      {showPassword ? "លាក់" : "បង្ហាញ"}
                    </button>
                  </div>
                  <input
                    id="login-password"
                    ref={loginPasswordRef}
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="បញ្ចូលពាក្យសម្ងាត់"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm shadow-xs transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <span>
                    {submitting ? "កំពុងផ្ទៀងផ្ទាត់..." : "ចូលប្រើប្រាស់"}
                  </span>
                  {!submitting && <ArrowRightIcon className="w-3.5 h-3.5" />}
                </button>
              </form>

              {quickUsers.length > 0 && (
                <div className="pt-4 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>ជ្រើសរើសគណនី រួចបញ្ចូលពាក្យសម្ងាត់</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto" aria-label="គណនីសម្រាប់ចូលរហ័ស">
                    {quickUsers.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        disabled={submitting}
                        onClick={() => {
                          setIdentifier(acc.username);
                          setPassword("");
                          setError(null);
                          loginPasswordRef.current?.focus();
                        }}
                        aria-pressed={identifier.trim().toLowerCase() === acc.username.toLowerCase()}
                        className={`px-2.5 py-2 rounded-xl border text-left transition cursor-pointer disabled:opacity-50 flex items-center gap-2.5 min-w-0 ${
                          identifier.trim().toLowerCase() === acc.username.toLowerCase()
                            ? "border-violet-300 bg-violet-50/60"
                            : "border-slate-200/90 bg-slate-50/50 hover:border-slate-300 hover:bg-white"
                        }`}
                      >
                        <UserAvatar
                          name={acc.fullName}
                          avatarColor={acc.avatarColor}
                          avatarUrl={acc.avatarUrl}
                          size="md"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-slate-900 truncate">
                            {acc.fullName}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {ROLE_CONFIG[acc.role].label} • @{acc.username}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <AvatarPicker
                compact
                fullName={fullName || "គណនីថ្មី"}
                avatarColor={regAvatarColor}
                avatarUrl={regAvatarUrl}
                colors={REG_COLORS}
                onChangeColor={setRegAvatarColor}
                onChangeAvatarUrl={setRegAvatarUrl}
                onProcessingChange={setRegAvatarBusy}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ឈ្មោះពេញ *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="សៅ មករា"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="makara"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  អ៊ីមែល *
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="makara@company.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ផ្នែកការងារ
                  </label>
                  <input
                    type="text"
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ពាក្យសម្ងាត់ *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="យ៉ាងតិច ៤ តួអក្សរ"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || regAvatarBusy}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm transition cursor-pointer disabled:opacity-60"
              >
                {submitting ? "កំពុងបង្កើតគណនី..." : "បង្កើតគណនី"}
              </button>
            </form>
          )}
        </div>

        {/* Subtle Database Status Pill */}
        <div className="surface-card px-4 py-2.5 flex items-center justify-between text-xs text-slate-500">
          <div className="inline-flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                dbHealth.connected ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span className="font-medium text-slate-700">{dbHealth.label}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowDbModal(true)}
            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
          >
            <DatabaseIcon className="w-3.5 h-3.5" />
            <span>កំណត់ PostgreSQL</span>
          </button>
        </div>
      </div>

      {showDbModal && (
        <DbConfigModal
          initialHost={dbHealth.host}
          initialPort={dbHealth.port}
          initialUser={dbHealth.user}
          initialDatabase={dbHealth.database}
          currentMode={dbHealth.dbMode}
          fallbackReason={dbHealth.fallbackReason}
          onClose={() => setShowDbModal(false)}
          onConnected={() => void refreshHealth()}
        />
      )}
    </div>
  );
}
