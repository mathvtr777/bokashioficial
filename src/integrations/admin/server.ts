import crypto from "node:crypto";
import {
  fetchBspayBalance,
  fetchBspayTransactions,
} from "../bspay/server";

const KDF_SALT = "bp_adm_v2_9f8e7d6c5b4a3f2e1d0c";
const KDF_ITERATIONS = 100_000;
const KDF_KEYLEN = 32;
const KDF_DIGEST = "sha256";

// Irreversible PBKDF2-SHA256 digests of the admin credentials (never stored in plaintext)
const ADMIN_LOGIN_DIGEST_HEX =
  "50ae1f07e1a20bea62572ffce7b933078cd8cd79bffc7488d11043e95e840b7c";
const ADMIN_PASS_DIGEST_HEX =
  "5bb6552a034cce78831b3a116d01c6f136ab20442b0b7aa140aafe6f2cdd8f0d";

// Runtime signing key derived deterministically so server restarts in dev don't drop active sessions
const SESSION_SIGNING_KEY = crypto
  .pbkdf2Sync(
    ADMIN_PASS_DIGEST_HEX,
    `${KDF_SALT}:session_hmac_key_v1`,
    10_000,
    32,
    "sha256"
  )
  .toString("hex");

export const ADMIN_COOKIE_NAME = "bp_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function verifyAdminCredentials(email: string, password: string): boolean {
  if (typeof email !== "string" || typeof password !== "string") {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  if (!normalizedEmail || !normalizedPassword) {
    return false;
  }

  const emailHash = crypto.pbkdf2Sync(
    normalizedEmail,
    `${KDF_SALT}:email`,
    KDF_ITERATIONS,
    KDF_KEYLEN,
    KDF_DIGEST
  );
  const passHash = crypto.pbkdf2Sync(
    normalizedPassword,
    `${KDF_SALT}:pass`,
    KDF_ITERATIONS,
    KDF_KEYLEN,
    KDF_DIGEST
  );

  const expectedEmailHash = Buffer.from(ADMIN_LOGIN_DIGEST_HEX, "hex");
  const expectedPassHash = Buffer.from(ADMIN_PASS_DIGEST_HEX, "hex");

  const emailMatch =
    emailHash.length === expectedEmailHash.length &&
    crypto.timingSafeEqual(emailHash, expectedEmailHash);
  const passMatch =
    passHash.length === expectedPassHash.length &&
    crypto.timingSafeEqual(passHash, expectedPassHash);

  return emailMatch && passMatch;
}

export function createAdminSessionToken(): string {
  const payload = {
    role: "bokashipay_superadmin",
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
    nonce: crypto.randomBytes(12).toString("hex"),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf-8").toString(
    "base64url"
  );
  const signature = crypto
    .createHmac("sha256", SESSION_SIGNING_KEY)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyAdminSessionToken(token: string | null | undefined): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [encoded, signature] = parts;
  if (!encoded || !signature) return false;

  const expectedSig = crypto
    .createHmac("sha256", SESSION_SIGNING_KEY)
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(signature, "utf-8");
  const expectedBuf = Buffer.from(expectedSig, "utf-8");

  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf-8")
    ) as { role?: string; exp?: number };

    if (payload.role !== "bokashipay_superadmin") return false;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function extractTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${ADMIN_COOKIE_NAME}=`)) {
      return decodeURIComponent(cookie.slice(ADMIN_COOKIE_NAME.length + 1));
    }
  }
  return null;
}

export function verifyAdminRequest(request: Request): boolean {
  const token = extractTokenFromRequest(request);
  return verifyAdminSessionToken(token);
}

export function buildAdminSessionCookie(token: string): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${ADMIN_COOKIE_NAME}=${encodeURIComponent(
    token
  )}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
}

export function buildClearAdminSessionCookie(): string {
  return `${ADMIN_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export async function fetchAdminOverview() {
  const [balanceResult, txResult] = await Promise.allSettled([
    fetchBspayBalance(),
    fetchBspayTransactions({ page: 1, pageSize: 100, scope: "admin" }),
  ]);

  const rawBalance =
    balanceResult.status === "fulfilled"
      ? (balanceResult.value as {
          balances?: Array<{ currency: string; available: string; allocation?: string }>;
        })
      : null;

  const balances = Array.isArray(rawBalance?.balances)
    ? rawBalance.balances
    : [];
  const transactions =
    txResult.status === "fulfilled" ? txResult.value.items : [];
  const bspayOnline =
    balanceResult.status === "fulfilled" || txResult.status === "fulfilled";

  return {
    bspayOnline,
    balances,
    transactions,
    syncedAt: new Date().toISOString(),
  };
}
