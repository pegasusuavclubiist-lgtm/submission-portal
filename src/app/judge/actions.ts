"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createJudgeSession, destroyJudgeSession, readJudgeSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isScoringLocked, normalizeCode } from "@/lib/judge";
import { CRITERIA, MARK_STEP } from "@/lib/rubric";

export type ScoreState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved"; message: string };

export async function judgeLoginAction(formData: FormData): Promise<void> {
  const code = normalizeCode(String(formData.get("code") ?? ""));
  const rows = code.length === 8 ? await getDb()`SELECT id FROM judges WHERE code = ${code}` : [];
  if (!rows[0]) {
    await new Promise((resolve) => setTimeout(resolve, 700)); // slows down guessing
    redirect("/judge?error=1");
  }
  await createJudgeSession(Number(rows[0].id));
  redirect("/judge");
}

export async function judgeLogoutAction(): Promise<void> {
  await destroyJudgeSession();
  redirect("/judge");
}

export async function saveScoreAction(_prev: ScoreState, formData: FormData): Promise<ScoreState> {
  const judgeId = await readJudgeSession();
  if (judgeId === null) return { status: "error", message: "Your session has expired. Please sign in again." };

  if (await isScoringLocked()) {
    return { status: "error", message: "Scoring has been locked by the organisers. Scores can no longer be changed." };
  }

  const db = getDb();
  const submissionId = Number(formData.get("submissionId"));
  const [judgeRows, subRows] = await Promise.all([
    db`SELECT id FROM judges WHERE id = ${judgeId}`,
    Number.isInteger(submissionId) ? db`SELECT team_key FROM submissions WHERE id = ${submissionId}` : Promise.resolve([]),
  ]);
  if (!judgeRows[0]) return { status: "error", message: "Judge account not found. Please sign in again." };
  if (!subRows[0]) return { status: "error", message: "That team could not be found." };
  const teamKey = String(subRows[0].team_key);

  const comments = String(formData.get("comments") ?? "").trim().slice(0, 2000) || null;
  const conflict = formData.get("conflict") === "on";

  const marks: Record<string, number | null> = {};
  if (conflict) {
    // 9.8: judges recuse themselves from any crew they have a tie with.
    for (const c of CRITERIA) marks[c.key] = null;
  } else {
    for (const c of CRITERIA) {
      const raw = String(formData.get(c.key) ?? "").trim();
      if (raw === "") return { status: "error", message: `Enter marks for ${c.label} (0–${c.weight}).` };
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > c.weight) {
        return { status: "error", message: `${c.label} must be between 0 and ${c.weight}.` };
      }
      if (Math.abs(value / MARK_STEP - Math.round(value / MARK_STEP)) > 1e-9) {
        return { status: "error", message: `${c.label}: use whole or half marks (e.g. 17 or 17.5).` };
      }
      marks[c.key] = value;
    }
  }

  await db`
    INSERT INTO scores
      (judge_id, team_key, conflict, innovation, technical, relevance, scalability, presentation, cad, comments, updated_at)
    VALUES
      (${judgeId}, ${teamKey}, ${conflict},
       ${marks.innovation}, ${marks.technical}, ${marks.relevance},
       ${marks.scalability}, ${marks.presentation}, ${marks.cad},
       ${comments}, now())
    ON CONFLICT (judge_id, team_key) DO UPDATE SET
      conflict     = EXCLUDED.conflict,
      innovation   = EXCLUDED.innovation,
      technical    = EXCLUDED.technical,
      relevance    = EXCLUDED.relevance,
      scalability  = EXCLUDED.scalability,
      presentation = EXCLUDED.presentation,
      cad          = EXCLUDED.cad,
      comments     = EXCLUDED.comments,
      updated_at   = now()
  `;

  revalidatePath("/judge");
  revalidatePath("/admin/judging");

  if (conflict) return { status: "saved", message: "Recorded: you have recused yourself from this team." };
  const total = CRITERIA.reduce((sum, c) => sum + (marks[c.key] ?? 0), 0);
  return { status: "saved", message: `Scores saved. Your total for this team: ${total} / 100.` };
}
