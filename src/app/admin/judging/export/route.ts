import { isAdmin } from "@/lib/auth";
import { csvCell } from "@/lib/csv";
import { loadJudging } from "@/lib/judging-data";
import { CRITERIA, TRACKS, isTrack } from "@/lib/rubric";
import { sortForDisplay } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });

  const { results } = await loadJudging();

  const header = [
    "track",
    "rank",
    "tie_needs_panel_vote",
    "team",
    "project",
    "judges_scored",
    ...CRITERIA.map((c) => `avg_${c.key}_of_${c.weight}`),
    "rubric_total_of_100",
    "interdisciplinary_bonus",
    "penalty",
    "final_score",
    "late_submission",
    "large_judge_gap",
    "notes",
  ];

  const order = ["senior", "first_year", "unassigned"];
  const lines = [header.map(csvCell).join(",")];
  for (const group of order) {
    const rows = sortForDisplay(results.filter((r) => (r.track ?? "unassigned") === group));
    for (const r of rows) {
      lines.push(
        [
          isTrack(r.track) ? TRACKS[r.track] : "Unassigned",
          r.rank ?? "",
          r.tie ? "yes" : "",
          r.teamName,
          r.projectTitle,
          r.scoredCount,
          ...CRITERIA.map((c) => (r.avg ? r.avg[c.key] : "")),
          r.rubricTotal ?? "",
          r.bonus,
          r.penalty,
          r.final ?? "",
          r.isLate ? "LATE" : "",
          r.needsReview ? "yes" : "",
          r.note ?? "",
        ]
          .map(csvCell)
          .join(",")
      );
    }
  }

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orion-results.csv"',
      "Cache-Control": "no-store",
    },
  });
}
