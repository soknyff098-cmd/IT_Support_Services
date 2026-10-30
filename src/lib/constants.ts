export const STATUS_CONFIG = {
  open: {
    label: "រង់ចាំដោះស្រាយ",
    en: "Open",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200/80",
    dotClass: "bg-amber-500",
  },
  in_progress: {
    label: "កំពុងដំណើរការ",
    en: "In Progress",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200/80",
    dotClass: "bg-blue-600",
  },
  resolved: {
    label: "ដោះស្រាយរួច",
    en: "Resolved",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    dotClass: "bg-emerald-500",
  },
  closed: {
    label: "បិទបញ្ចប់",
    en: "Closed",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    dotClass: "bg-slate-400",
  },
} as const;

export const PRIORITY_CONFIG = {
  low: {
    label: "ទាប",
    short: "ទាប",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    dotClass: "bg-slate-400",
  },
  medium: {
    label: "មធ្យម",
    short: "មធ្យម",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    dotClass: "bg-blue-500",
  },
  high: {
    label: "ខ្ពស់",
    short: "ខ្ពស់",
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200/80",
    dotClass: "bg-orange-500",
  },
  urgent: {
    label: "បន្ទាន់",
    short: "បន្ទាន់",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200/80",
    dotClass: "bg-rose-500",
  },
} as const;

export const ROLE_CONFIG = {
  admin: {
    label: "Admin",
    khLabel: "អ្នកគ្រប់គ្រង",
    badgeClass: "bg-slate-900 text-white border-slate-900",
  },
  agent: {
    label: "IT Agent",
    khLabel: "បុគ្គលិកបច្ចេកទេស",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  user: {
    label: "User",
    khLabel: "បុគ្គលិកទូទៅ",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
  },
} as const;

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getInitials(name: string): string {
  const cleaned = name.replace(/\(.*?\)/g, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (cleaned.slice(0, 2) || "HD").toUpperCase();
}
