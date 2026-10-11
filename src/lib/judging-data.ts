import { getDeadline } from "./config";
import { getDb } from "./db";
import { CRITERIA, type CriterionKey } from "./rubric";
import { computeResults, type ScoreRow, type TeamInput, type TeamResult } from "./scoring";

export type JudgeRow = {
  id: number;
  name: string;
  code: string;
  scoredCount: number;
};

export type JudgingData = {
  judges: JudgeRow[];
  results: TeamResult[];
  locked: boolean;
  deadline: Date | null;
};

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/** Everything the admin results page and the CSV export need, computed in one place. */
export async function loadJudging(): Promise<JudgingData> {
  const db = getDb();

  const [teamRows, scoreRows, metaRows, judgeRows, settingsRows] = await Promise.all([
    // Latest submission per team (a team may submit a Day 1 update and then a final one).
    db`SELECT DISTINCT ON (team_key)
              team_key, team_name, project_title, id, created_at, is_late,
              count(*) OVER (PARTITION BY team_key) AS submission_count
         FROM submissions
        ORDER BY team_key, created_at DESC`,
    db`SELECT s.judge_id, j.name AS judge_name, s.team_key, s.conflict,
              s.innovation, s.technical, s.relevance, s.scalability, s.presentation, s.cad,
              s.comments
         FROM scores s JOIN judges j ON j.id = s.judge_id`,
    db`SELECT team_key, track, bonus, penalty, note FROM team_meta`,
    db`SELECT id, name, code FROM judges ORDER BY id`,
    db`SELECT scoring_locked FROM settings WHERE id = 1`,
  ]);

  const meta = new Map(metaRows.map((m) => [String(m.team_key), m]));

  const teams: TeamInput[] = teamRows.map((t) => {
    const m = meta.get(String(t.team_key));
    return {
      teamKey: String(t.team_key),
      teamName: String(t.team_name),
      projectTitle: String(t.project_title),
      submissionId: Number(t.id),
      submittedAt: new Date(t.created_at),
      isLate: Boolean(t.is_late),
      submissionCount: Number(t.submission_count),
      track: m?.track ? String(m.track) : null,
      bonus: m ? Number(m.bonus) : 0,
      penalty: m ? Number(m.penalty) : 0,
      note: m?.note ? String(m.note) : null,
    };
  });

  const scores: ScoreRow[] = scoreRows.map((s) => {
    const marks = {} as Record<CriterionKey, number | null>;
    for (const c of CRITERIA) marks[c.key] = num(s[c.key]);
    return {
      judgeId: Number(s.judge_id),
      judgeName: String(s.judge_name),
      teamKey: String(s.team_key),
      conflict: Boolean(s.conflict),
      marks,
      comments: s.comments ? String(s.comments) : null,
    };
  });

  const scoredPerJudge = new Map<number, number>();
  for (const s of scores) scoredPerJudge.set(s.judgeId, (scoredPerJudge.get(s.judgeId) ?? 0) + 1);

  let deadline: Date | null = null;
  try {
    deadline = getDeadline();
  } catch {
    /* not configured */
  }

  return {
    judges: judgeRows.map((j) => ({
      id: Number(j.id),
      name: String(j.name),
      code: String(j.code),
      scoredCount: scoredPerJudge.get(Number(j.id)) ?? 0,
    })),
    results: computeResults(teams, scores),
    locked: Boolean(settingsRows[0]?.scoring_locked),
    deadline,
  };
}
