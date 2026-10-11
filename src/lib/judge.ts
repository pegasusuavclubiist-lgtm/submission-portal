import { randomInt } from "node:crypto";
import { readJudgeSession } from "./auth";
import { getDb } from "./db";

// No 0/O or 1/I/L so codes are easy to read out or type from WhatsApp.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 8 characters, stored without a dash and shown as XXXX-XXXX. */
export function generateCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export type Judge = { id: number; name: string };

/** The signed-in judge, verified against the database (so deleting a judge ends their session). */
export async function getCurrentJudge(): Promise<Judge | null> {
  const id = await readJudgeSession();
  if (id === null) return null;
  const rows = await getDb()`SELECT id, name FROM judges WHERE id = ${id}`;
  const row = rows[0];
  return row ? { id: Number(row.id), name: String(row.name) } : null;
}

export async function isScoringLocked(): Promise<boolean> {
  const rows = await getDb()`SELECT scoring_locked FROM settings WHERE id = 1`;
  return Boolean(rows[0]?.scoring_locked);
}
