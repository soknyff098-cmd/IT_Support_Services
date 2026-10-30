import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@/db/schema";
import { repoFindUserById } from "@/db/repository";

export const AUTH_COOKIE_NAME = "helpdesk_token";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SafeUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: "admin" | "agent" | "user";
  department: string;
  avatarColor: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export function sanitizeAvatarUrl(
  raw: unknown
): { valid: true; value: string | null | undefined } | { valid: false; error: string } {
  if (raw === undefined) return { valid: true, value: undefined };
  if (raw === null || raw === "") return { valid: true, value: null };
  if (typeof raw !== "string") return { valid: false, error: "ទម្រង់រូបភាពមិនត្រឹមត្រូវទេ។" };

  const value = raw.trim();
  if (!value) return { valid: true, value: null };
  const invalid = { valid: false as const, error: "សូមប្រើរូបភាព JPG, PNG, WebP, GIF ឬតំណភ្ជាប់រូបភាពដែលត្រឹមត្រូវ។" };

  if (/^data:/i.test(value)) {
    // The browser resizes uploads before saving; a hard server-side cap also protects storage.
    if (value.length > 350_000) {
      return { valid: false, error: "ទំហំរូបភាពធំពេក សូមជ្រើសរើសរូបភាពតូចជាងនេះ។" };
    }
    const match = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([a-z0-9+/]+={0,2})$/i.exec(value);
    if (!match || match[2].length % 4 !== 0) return invalid;
    const bytes = Buffer.from(match[2], "base64");
    const mime = match[1].toLowerCase();
    const signatureOk =
      (mime === "png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      ((mime === "jpg" || mime === "jpeg") && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
      (mime === "gif" && (bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a")) ||
      (mime === "webp" && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP");
    return signatureOk ? { valid: true, value } : invalid;
  }

  if (value.length > 2048) return invalid;
  try {
    const parsed = new URL(value);
    if ((parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname && !parsed.username && !parsed.password) {
      return { valid: true, value: parsed.href };
    }
  } catch {
    // Not an absolute HTTP(S) URL.
  }
  return invalid;
}

export function toSafeUser(user: User): SafeUser {
  const role =
    user.role === "admin" || user.role === "agent" ? user.role : "user";
  let createdAtStr: string;
  if (user.createdAt instanceof Date && !Number.isNaN(user.createdAt.getTime())) {
    createdAtStr = user.createdAt.toISOString();
  } else if (user.createdAt) {
    const parsed = new Date(String(user.createdAt));
    createdAtStr = Number.isNaN(parsed.getTime())
      ? new Date().toISOString()
      : parsed.toISOString();
  } else {
    createdAtStr = new Date().toISOString();
  }

  return {
    id: user.id,
    username: user.username || `user_${user.id}`,
    email: user.email || `user_${user.id}@helpdesk.com`,
    fullName: user.fullName || user.username || `User #${user.id}`,
    role,
    department: user.department || "ទូទៅ (General)",
    avatarColor: user.avatarColor || "#2563eb",
    avatarUrl: user.avatarUrl || null,
    isActive: user.isActive !== false,
    createdAt: createdAtStr,
  };
}

function getSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    "helpdesk-secret-key-2026-khmer-portal-fallback"
  );
}

interface TokenPayload {
  uid: number;
  role: string;
  exp: number;
  credentialVersion: string;
}

function credentialVersion(passwordHash: string): string {
  return crypto.createHmac("sha256", getSecret())
    .update("helpdesk-credential-version\0")
    .update(passwordHash)
    .digest("base64url");
}

export function signAuthToken(userId: number, role: string, passwordHash: string): string {
  const payload: TokenPayload = {
    uid: userId,
    role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    credentialVersion: credentialVersion(passwordHash),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
  if (!token || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;

  const expectedSig = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as TokenPayload;
    if (
      typeof parsed.uid !== "number" ||
      typeof parsed.exp !== "number" ||
      typeof parsed.credentialVersion !== "string" ||
      parsed.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isHttpsRequest(req: NextRequest): boolean {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    if (forwardedProto.split(",")[0].trim().toLowerCase() === "https") {
      return true;
    }
  }
  const origin = req.headers.get("origin");
  if (origin?.toLowerCase().startsWith("https://")) {
    return true;
  }
  const referer = req.headers.get("referer");
  if (referer?.toLowerCase().startsWith("https://")) {
    return true;
  }
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  if (host.includes(".e2b.app")) {
    return true;
  }
  return req.nextUrl.protocol === "https:";
}

export function attachAuthCookie(
  res: NextResponse,
  req: NextRequest,
  token: string
): void {
  const https = isHttpsRequest(req);
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
    secure: https,
    sameSite: https ? "none" : "lax",
    ...(https ? { partitioned: true } : {}),
  });
}

export function clearAuthCookie(res: NextResponse, req: NextRequest): void {
  const https = isHttpsRequest(req);
  res.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
    secure: https,
    sameSite: https ? "none" : "lax",
    ...(https ? { partitioned: true } : {}),
  });
}

export async function getCurrentUser(
  req: NextRequest
): Promise<SafeUser | null> {
  const candidateTokens: string[] = [];

  // 1. Custom proxy-proof header
  const customHeader = req.headers.get("x-helpdesk-token")?.trim();
  if (customHeader) {
    candidateTokens.push(customHeader);
  }

  // 2. Query parameter fallback (_hd_token)
  const queryToken = req.nextUrl.searchParams.get("_hd_token")?.trim();
  if (queryToken) {
    candidateTokens.push(queryToken);
  }

  // 3. Standard Authorization: Bearer <token>
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) candidateTokens.push(bearer);
  }

  // 4. HttpOnly Cookie
  const cookieToken = req.cookies.get(AUTH_COOKIE_NAME)?.value?.trim();
  if (cookieToken) {
    candidateTokens.push(cookieToken);
  }

  for (const rawToken of candidateTokens) {
    const payload = verifyAuthToken(rawToken);
    if (!payload) continue;

    const user = await repoFindUserById(payload.uid);
    if (user && user.isActive !== false) {
      const expected = Buffer.from(credentialVersion(user.passwordHash));
      const actual = Buffer.from(payload.credentialVersion);
      if (expected.length === actual.length && crypto.timingSafeEqual(expected, actual)) {
        return toSafeUser(user);
      }
    }
  }

  return null;
}
