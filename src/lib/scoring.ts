import { CRITERIA, GAP_REVIEW_MARKS, type CriterionKey } from "./rubric";

export type ScoreRow = {
  judgeId: number;
  judgeName: string;
  teamKey: string;
  conflict: boolean;
  marks: Record<CriterionKey, number | null>;
  comments: string | null;
};

export type TeamInput = {
  teamKey: string;
  teamName: string;
  projectTitle: string;
  submissionId: number;
  submittedAt: Date;
  isLate: boolean;
  submissionCount: number;
  track: string | null;
  bonus: number;
  penalty: number;
  note: string | null;
};

export type JudgeTotal = {
  judgeId: number;
  judgeName: string;
  conflict: boolean;
  total: number | null;
  comments: string | null;
};

export type TeamResult = TeamInput & {
  judges: JudgeTotal[];
  scoredCount: number;
  avg: Record<CriterionKey, number> | null;
  rubricTotal: number | null;
  final: number | null;
  gap: number;
  needsReview: boolean;
  rank: number | null;
  tie: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function sumMarks(marks: Record<CriterionKey, number | null>): number | null {
  let total = 0;
  for (const c of CRITERIA) {
    const value = marks[c.key];
    if (value === null || value === undefined) return null;
    total += value;
  }
  return round2(total);
}

/**
 * Rulebook 13.2 / 13.3 / 13.5 / 13.6:
 *  - each judge's rubric total is out of 100; judges' scores are averaged
 *  - final = averaged rubric total + Interdisciplinary Bonus - penalties
 *  - tracks are ranked separately
 *  - tie-breaks: higher Innovation avg, then higher Technical avg, then a panel vote
 * A judge who declared a conflict of interest is left out of the average.
 */
export function computeResults(teams: TeamInput[], scores: ScoreRow[]): TeamResult[] {
  const byTeam = new Map<string, ScoreRow[]>();
  for (const s of scores) {
    const list = byTeam.get(s.teamKey) ?? [];
    list.push(s);
    byTeam.set(s.teamKey, list);
  }

  const results: TeamResult[] = teams.map((team) => {
    const rows = byTeam.get(team.teamKey) ?? [];
    const judges: JudgeTotal[] = rows.map((r) => ({
      judgeId: r.judgeId,
      judgeName: r.judgeName,
      conflict: r.conflict,
      total: r.conflict ? null : sumMarks(r.marks),
      comments: r.comments,
    }));

    const counted = rows.filter((r) => !r.conflict && sumMarks(r.marks) !== null);
    const scoredCount = counted.length;

    let avg: Record<CriterionKey, number> | null = null;
    let rubricTotal: number | null = null;
    let final: number | null = null;
    let gap = 0;

    if (scoredCount > 0) {
      avg = {} as Record<CriterionKey, number>;
      for (const c of CRITERIA) {
        const sum = counted.reduce((acc, r) => acc + (r.marks[c.key] ?? 0), 0);
        avg[c.key] = round2(sum / scoredCount);
      }
      const totals = counted.map((r) => sumMarks(r.marks) as number);
      rubricTotal = round2(totals.reduce((a, b) => a + b, 0) / scoredCount);
      final = round2(rubricTotal + team.bonus - team.penalty);
      gap = scoredCount > 1 ? round2(Math.max(...totals) - Math.min(...totals)) : 0;
    }

    return {
      ...team,
      judges,
      scoredCount,
      avg,
      rubricTotal,
      final,
      gap,
      needsReview: gap > GAP_REVIEW_MARKS,
      rank: null,
      tie: false,
    };
  });

  // Rank within each track (unassigned teams are grouped together).
  const groups = new Map<string, TeamResult[]>();
  for (const r of results) {
    const key = r.track ?? "unassigned";
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  for (const list of groups.values()) {
    const scored = list
      .filter((r) => r.final !== null && r.avg !== null)
      .sort(
        (a, b) =>
          (b.final as number) - (a.final as number) ||
          (b.avg as Record<CriterionKey, number>).innovation - (a.avg as Record<CriterionKey, number>).innovation ||
          (b.avg as Record<CriterionKey, number>).technical - (a.avg as Record<CriterionKey, number>).technical
      );

    const sameKey = (a: TeamResult, b: TeamResult) =>
      a.final === b.final &&
      (a.avg as Record<CriterionKey, number>).innovation === (b.avg as Record<CriterionKey, number>).innovation &&
      (a.avg as Record<CriterionKey, number>).technical === (b.avg as Record<CriterionKey, number>).technical;

    scored.forEach((r, i) => {
      if (i > 0 && sameKey(r, scored[i - 1])) {
        r.rank = scored[i - 1].rank;
        r.tie = true;
        scored[i - 1].tie = true;
      } else {
        r.rank = i + 1;
      }
    });
  }

  return results;
}

/** Sort for display: ranked teams first (by rank), then unscored teams by name. */
export function sortForDisplay(list: TeamResult[]): TeamResult[] {
  return [...list].sort((a, b) => {
    if (a.rank !== null && b.rank !== null) {
      return a.rank - b.rank || a.teamName.localeCompare(b.teamName);
    }
    if (a.rank !== null) return -1;
    if (b.rank !== null) return 1;
    return a.teamName.localeCompare(b.teamName);
  });
}
