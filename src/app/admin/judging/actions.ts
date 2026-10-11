"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { generateCode } from "@/lib/judge";
import { BONUS_MAX, isTrack } from "@/lib/rubric";

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin");
}

export async function addJudgeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) redirect("/admin/judging?msg=name");

  const db = getDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db`INSERT INTO judges (name, code) VALUES (${name}, ${generateCode()})`;
      revalidatePath("/admin/judging");
      redirect("/admin/judging");
    } catch (err) {
      // redirect() works by throwing — let it through; retry only on a duplicate-code clash.
      if (err instanceof Error && "digest" in err) throw err;
      if (attempt === 4) throw err;
    }
  }
}

export async function deleteJudgeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) {
    // Their scores are removed with them (ON DELETE CASCADE).
    await getDb()`DELETE FROM judges WHERE id = ${id}`;
  }
  revalidatePath("/admin/judging");
}

export async function saveTeamMetaAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const teamKey = String(formData.get("teamKey") ?? "");
  if (!teamKey) return;

  const trackRaw = String(formData.get("track") ?? "");
  const track = isTrack(trackRaw) ? trackRaw : null;

  const bonus = Math.min(BONUS_MAX, Math.max(0, Number(formData.get("bonus")) || 0));
  const penalty = Math.max(0, Number(formData.get("penalty")) || 0);
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;

  await getDb()`
    INSERT INTO team_meta (team_key, track, bonus, penalty, note)
    VALUES (${teamKey}, ${track}, ${Math.round(bonus * 10) / 10}, ${Math.round(penalty * 10) / 10}, ${note})
    ON CONFLICT (team_key) DO UPDATE SET
      track = EXCLUDED.track, bonus = EXCLUDED.bonus, penalty = EXCLUDED.penalty, note = EXCLUDED.note
  `;
  revalidatePath("/admin/judging");
  revalidatePath("/judge");
}

export async function setScoringLockedAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const lock = formData.get("lock") === "true";
  await getDb()`UPDATE settings SET scoring_locked = ${lock} WHERE id = 1`;
  revalidatePath("/admin/judging");
  revalidatePath("/judge");
}
