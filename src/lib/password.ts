import crypto from "node:crypto";

const KHMER_DIGITS = "០១២៣៤៥៦៧៨៩";

export function normalizeKhmerDigits(value: string): string {
  let out = "";
  for (const ch of value) {
    const idx = KHMER_DIGITS.indexOf(ch);
    out += idx >= 0 ? String(idx) : ch;
  }
  return out;
}

export function hashPassword(password: string): string {
  const normalized = password.trim();
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(normalized, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

function checkSingleCandidate(candidate: string, storedHash: string): boolean {
  if (!storedHash) return false;

  if (storedHash.startsWith("scrypt:")) {
    const parts = storedHash.split(":");
    if (parts.length !== 3) return false;
    const [, salt, expectedHex] = parts;
    const derived = crypto.scryptSync(candidate, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }

  if (storedHash.startsWith("sha256:")) {
    const expectedHex = storedHash.slice("sha256:".length);
    const actualHex = crypto.createHash("sha256").update(candidate).digest("hex");
    return actualHex === expectedHex;
  }

  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const actualHex = crypto.createHash("sha256").update(candidate).digest("hex");
    if (actualHex.toLowerCase() === storedHash.toLowerCase()) return true;
  }

  // Fallback if an administrator manually inserted/updated plain password in PostgreSQL (pgAdmin)
  return candidate === storedHash;
}

export function verifyPassword(inputPassword: string, storedHash: string): boolean {
  const raw = inputPassword;
  const trimmed = inputPassword.trim();
  const asciiDigits = normalizeKhmerDigits(trimmed);

  if (checkSingleCandidate(raw, storedHash)) return true;
  if (trimmed !== raw && checkSingleCandidate(trimmed, storedHash)) return true;
  if (asciiDigits !== trimmed && checkSingleCandidate(asciiDigits, storedHash)) {
    return true;
  }
  return false;
}
