import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "orion_admin";
const SESSION_SECONDS = 60 * 60 * 8; // 8 hours

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error("ADMIN_PASSWORD is not set");
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Constant-time password check (compares SHA-256 digests). */
export function verifyPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function createSession(): Promise<void> {
  const expires = Date.now() + SESSION_SECONDS * 1000;
  const payload = String(expires);
  const store = await cookies();
  store.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// ---------------------------------------------------------------------------
// Judge sessions (separate cookie; the "judge:" prefix means an admin cookie can
// never be replayed as a judge cookie or the other way round).
// ---------------------------------------------------------------------------
const JUDGE_COOKIE = "orion_judge";

export async function createJudgeSession(judgeId: number): Promise<void> {
  const expires = Date.now() + SESSION_SECONDS * 1000;
  const payload = `${judgeId}:${expires}`;
  const store = await cookies();
  store.set(JUDGE_COOKIE, `${payload}.${sign(`judge:${payload}`)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function destroyJudgeSession(): Promise<void> {
  const store = await cookies();
  store.delete(JUDGE_COOKIE);
}

/** Returns the signed-in judge's id, or null. */
export async function readJudgeSession(): Promise<number | null> {
  if (!process.env.ADMIN_PASSWORD) return null;
  const token = (await cookies()).get(JUDGE_COOKIE)?.value;
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (!safeEqual(signature, sign(`judge:${payload}`))) return null;
  const [id, expires] = payload.split(":");
  if (!(Number(expires) > Date.now())) return null;
  const judgeId = Number(id);
  return Number.isInteger(judgeId) ? judgeId : null;
}

export async function isAdmin(): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD) return false;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (!safeEqual(signature, sign(payload))) return false;
  return Number(payload) > Date.now();
}
