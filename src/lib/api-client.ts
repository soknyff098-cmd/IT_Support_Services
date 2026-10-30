const STORAGE_KEY = "helpdesk_auth_token";

declare global {
  interface Window {
    __HELPDESK_AUTH_TOKEN__?: string | null;
  }
}

let memoryToken: string | null = null;

export function getClientToken(): string | null {
  if (typeof window !== "undefined" && window.__HELPDESK_AUTH_TOKEN__) {
    memoryToken = window.__HELPDESK_AUTH_TOKEN__;
    return window.__HELPDESK_AUTH_TOKEN__;
  }
  if (memoryToken) return memoryToken;
  if (typeof window === "undefined") return null;

  try {
    const fromSession = window.sessionStorage.getItem(STORAGE_KEY);
    if (fromSession) {
      memoryToken = fromSession;
      window.__HELPDESK_AUTH_TOKEN__ = fromSession;
      return fromSession;
    }
  } catch {
    // Ignore restricted sessionStorage
  }

  try {
    const fromLocal = window.localStorage.getItem(STORAGE_KEY);
    if (fromLocal) {
      memoryToken = fromLocal;
      window.__HELPDESK_AUTH_TOKEN__ = fromLocal;
      return fromLocal;
    }
  } catch {
    // Ignore restricted localStorage
  }

  return null;
}

export function setClientToken(token: string | null): void {
  memoryToken = token;
  if (typeof window === "undefined") return;
  window.__HELPDESK_AUTH_TOKEN__ = token;

  try {
    if (token) {
      window.sessionStorage.setItem(STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }

  try {
    if (token) {
      window.localStorage.setItem(STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; data: T }> {
  const token = getClientToken();

  // Append _hd_token query param as proxy-proof fallback
  let requestUrl = path;
  if (token && path.startsWith("/api/")) {
    const sep = path.includes("?") ? "&" : "?";
    requestUrl = `${path}${sep}_hd_token=${encodeURIComponent(token)}`;
  }

  const headerRecord: Record<string, string> = {};
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((v, k) => {
        headerRecord[k] = v;
      });
    } else if (Array.isArray(options.headers)) {
      for (const [k, v] of options.headers) {
        headerRecord[k] = v;
      }
    } else {
      Object.assign(headerRecord, options.headers);
    }
  }

  if (options.body && !headerRecord["Content-Type"] && !headerRecord["content-type"]) {
    headerRecord["Content-Type"] = "application/json";
  }

  if (token) {
    headerRecord["X-Helpdesk-Token"] = token;
    if (!headerRecord["Authorization"] && !headerRecord["authorization"]) {
      headerRecord["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(requestUrl, {
    ...options,
    headers: headerRecord,
    credentials: "include",
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as T;
  return { status: response.status, data };
}
