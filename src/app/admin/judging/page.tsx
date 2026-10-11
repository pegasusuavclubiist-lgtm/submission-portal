import type { Metadata } from "next";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { isAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/config";
import { formatCode } from "@/lib/judge";
import { loadJudging } from "@/lib/judging-data";
import { BONUS_MAX, CRITERIA, GAP_REVIEW_MARKS, MIN_JUDGES, TRACKS, isTrack } from "@/lib/rubric";
import { sortForDisplay, type TeamResult } from "@/lib/scoring";
import { addJudgeAction, deleteJudgeAction, saveTeamMetaAction, setScoringLockedAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Orion · Judging results",
  robots: { index: false, follow: false },
};

const inputClass =
  "rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-400/20";

function minutesLate(team: TeamResult, deadline: Date | null): number | null {
  if (!deadline) return null;
  const mins = (team.submittedAt.getTime() - deadline.getTime()) / 60000;
  return mins > 0 ? Math.ceil(mins) : null;
}

function ResultsTable({
  title,
  teams,
  deadline,
}: {
  title: string;
  teams: TeamResult[];
  deadline: Date | null;
}) {
  const sorted = sortForDisplay(teams);
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold text-white">
        {title} <span className="text-sm font-normal text-slate-500">· {teams.length} {teams.length === 1 ? "team" : "teams"}</span>
      </h2>
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-3 font-medium">Rank</th>
              <th className="px-3 py-3 font-medium">Team</th>
              <th className="px-3 py-3 font-medium">Judges</th>
              {CRITERIA.map((c) => (
                <th key={c.key} className="px-3 py-3 text-right font-medium" title={c.label}>
                  {c.label.split(" ")[0]}
                  <span className="block text-[10px] normal-case text-slate-600">/{c.weight}</span>
                </th>
              ))}
              <th className="px-3 py-3 text-right font-medium">Rubric<span className="block text-[10px] normal-case text-slate-600">/100</span></th>
              <th className="px-3 py-3 text-right font-medium">Bonus</th>
              <th className="px-3 py-3 text-right font-medium">Penalty</th>
              <th className="px-3 py-3 text-right font-medium">Final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-slate-500">No teams in this group.</td>
              </tr>
            )}
            {sorted.map((t) => {
              const late = minutesLate(t, deadline);
              return (
                <tr key={t.teamKey} className="align-top">
                  <td className="px-3 py-3 font-mono text-slate-300">
                    {t.rank ?? "—"}
                    {t.tie && <span className="ml-1 text-xs text-amber-300" title="Tied on final score, Innovation and Technical (13.6): panel vote needed">tie</span>}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-white">{t.teamName}</p>
                    <p className="max-w-[16rem] truncate text-xs text-slate-500">{t.projectTitle}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {t.isLate && (
                        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                          Late{late ? ` +${late} min` : ""}
                        </span>
                      )}
                      {t.needsReview && (
                        <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] font-medium text-rose-200" title={`Judges differ by ${t.gap} marks`}>
                          Review gap ({t.gap})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`px-3 py-3 ${t.scoredCount < MIN_JUDGES ? "text-amber-300" : "text-slate-300"}`}>
                    {t.scoredCount}
                    {t.scoredCount < MIN_JUDGES && <span className="block text-[10px]">need {MIN_JUDGES}+</span>}
                  </td>
                  {CRITERIA.map((c) => (
                    <td key={c.key} className="px-3 py-3 text-right tabular-nums text-slate-300">
                      {t.avg ? t.avg[c.key] : "—"}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right tabular-nums text-slate-200">{t.rubricTotal ?? "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-300">{t.bonus ? `+${t.bonus}` : "0"}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-rose-300">{t.penalty ? `−${t.penalty}` : "0"}</td>
                  <td className="px-3 py-3 text-right text-base font-bold tabular-nums text-white">{t.final ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function JudgingAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  if (!(await isAdmin())) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 text-center">
        <p className="text-slate-300">Admin sign-in required.</p>
        <a href="/admin" className="mt-4 text-indigo-300 hover:underline">Go to admin</a>
      </main>
    );
  }

  const { msg } = await searchParams;
  const { judges, results, locked, deadline } = await loadJudging();

  const senior = results.filter((r) => r.track === "senior");
  const firstYear = results.filter((r) => r.track === "first_year");
  const unassigned = results.filter((r) => !isTrack(r.track));

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <a href="/admin" className="text-sm text-slate-400 hover:text-white">← Submissions</a>

      <header className="mb-8 mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Orion · Judging</h1>
          <p className="text-sm text-slate-400">
            Final score = rubric total (100, averaged across judges) + Interdisciplinary Bonus − penalties (Rulebook 13.2).
            Tracks are ranked separately.
          </p>
        </div>
        <a href="/admin/judging/export" className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-slate-200 hover:bg-white/10">
          Export results CSV
        </a>
      </header>

      {/* Lock */}
      <section
        className={`mb-8 flex flex-wrap items-center justify-between gap-5 rounded-2xl border p-5 ${
          locked ? "border-rose-400/30 bg-rose-400/10" : "border-emerald-400/25 bg-emerald-400/10"
        }`}
      >
        <div>
          <p className={`font-semibold ${locked ? "text-rose-100" : "text-emerald-100"}`}>
            {locked ? "Scoring is LOCKED" : "Scoring is open"}
          </p>
          <p className="mt-1 max-w-xl text-sm text-slate-300">
            {locked
              ? "Judges can no longer change their scores. Unlock to allow corrections."
              : "Lock scoring once every judge has finished, so results cannot change (Rulebook 13.7: decisions are final)."}
          </p>
        </div>
        <form action={setScoringLockedAction}>
          <input type="hidden" name="lock" value={locked ? "false" : "true"} />
          <ConfirmSubmitButton
            message={locked ? "Unlock scoring so judges can edit again?" : "Lock scoring? Judges will no longer be able to change scores."}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 ${locked ? "bg-emerald-600" : "bg-rose-600"}`}
          >
            {locked ? "Unlock scoring" : "Lock scoring"}
          </ConfirmSubmitButton>
        </form>
      </section>

      {/* Judges */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold text-white">Judges</h2>
        <p className="mb-4 text-sm text-slate-400">
          Add each judge and send them their passcode. They sign in at <span className="font-mono text-slate-200">/judge</span>.
          Rulebook 13.3 needs at least {MIN_JUDGES} judges per track.
        </p>

        <form action={addJudgeAction} className="mb-4 flex flex-wrap gap-3">
          <input name="name" required minLength={2} maxLength={80} placeholder="Judge name" className={`${inputClass} w-64`} />
          <button className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400">Add judge</button>
          {msg === "name" && <span className="self-center text-xs text-rose-400">Enter a name (2–80 characters).</span>}
        </form>

        <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {judges.length === 0 && <p className="px-5 py-6 text-sm text-slate-500">No judges yet.</p>}
          {judges.map((j) => (
            <div key={j.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="font-medium text-white">{j.name}</p>
                <p className="text-xs text-slate-500">{j.scoredCount} of {results.length} teams scored</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-base tracking-widest text-indigo-200">
                  {formatCode(j.code)}
                </span>
                <form action={deleteJudgeAction}>
                  <input type="hidden" name="id" value={j.id} />
                  <ConfirmSubmitButton
                    message={`Remove ${j.name}? Their scores (${j.scoredCount}) will be deleted too.`}
                    className="text-sm text-slate-500 hover:text-rose-300"
                  >
                    Remove
                  </ConfirmSubmitButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      {unassigned.length > 0 && (
        <p className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-3 text-sm text-amber-100">
          {unassigned.length} team{unassigned.length > 1 ? "s have" : " has"} no track yet. Set the track below (from the
          registration list) so they are ranked in the right track.
        </p>
      )}

      <ResultsTable title={TRACKS.senior} teams={senior} deadline={deadline} />
      <ResultsTable title={TRACKS.first_year} teams={firstYear} deadline={deadline} />
      {unassigned.length > 0 && <ResultsTable title="Track not set" teams={unassigned} deadline={deadline} />}

      {/* Per-team settings */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold text-white">Track, bonus &amp; penalties</h2>
        <p className="mb-4 text-sm text-slate-400">
          Interdisciplinary Bonus (5.2): proposed +2 for two branches, +4 for three, +5 for four (max {BONUS_MAX}). Penalties:
          a Level 2 offence costs 3–10 marks (15.2); a submission up to 10 minutes late loses 5 marks and anything later is
          not evaluated (11.3). Those amounts are marked [to confirm] in the rulebook, so enter whatever the organisers decide.
        </p>

        <div className="space-y-3">
          {sortForDisplay(results).length === 0 && <p className="text-sm text-slate-500">No teams have submitted yet.</p>}
          {results.map((t) => {
            const late = minutesLate(t, deadline);
            return (
              <details key={t.teamKey} className="rounded-2xl border border-white/10 bg-white/[0.03]">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <span>
                    <span className="font-medium text-white">{t.teamName}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {isTrack(t.track) ? TRACKS[t.track] : "Track not set"} · submitted {formatDateTime(t.submittedAt)}
                      {t.submissionCount > 1 ? ` · ${t.submissionCount} submissions` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    {t.isLate && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-amber-200">Late{late ? ` +${late} min` : ""}</span>}
                    <span className="text-slate-400">Final: <span className="font-semibold text-white">{t.final ?? "—"}</span></span>
                  </span>
                </summary>

                <div className="border-t border-white/5 px-5 py-4">
                  {t.judges.length > 0 && (
                    <ul className="mb-4 space-y-2 text-sm">
                      {t.judges.map((j) => (
                        <li key={j.judgeId} className="rounded-lg bg-white/[0.03] px-3 py-2">
                          <span className="text-slate-300">{j.judgeName}:</span>{" "}
                          {j.conflict ? <span className="text-amber-300">recused (conflict of interest)</span> : <span className="font-semibold text-white">{j.total} / 100</span>}
                          {j.comments && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-400">{j.comments}</p>}
                        </li>
                      ))}
                    </ul>
                  )}

                  <form action={saveTeamMetaAction} className="grid gap-3 sm:grid-cols-[1fr_6rem_6rem] ">
                    <input type="hidden" name="teamKey" value={t.teamKey} />
                    <label className="text-xs text-slate-400">
                      Track
                      <select name="track" defaultValue={t.track ?? ""} className={`${inputClass} mt-1 w-full`}>
                        <option value="">Not set</option>
                        <option value="senior">{TRACKS.senior}</option>
                        <option value="first_year">{TRACKS.first_year}</option>
                      </select>
                    </label>
                    <label className="text-xs text-slate-400">
                      Bonus (0–{BONUS_MAX})
                      <input name="bonus" type="number" min={0} max={BONUS_MAX} step={0.5} defaultValue={t.bonus} className={`${inputClass} mt-1 w-full`} />
                    </label>
                    <label className="text-xs text-slate-400">
                      Penalty
                      <input name="penalty" type="number" min={0} step={0.5} defaultValue={t.penalty} className={`${inputClass} mt-1 w-full`} />
                    </label>
                    <label className="text-xs text-slate-400 sm:col-span-3">
                      Note (reason for bonus / penalty)
                      <input name="note" maxLength={500} defaultValue={t.note ?? ""} placeholder="e.g. 3 branches: Aerospace, Avionics, CSE" className={`${inputClass} mt-1 w-full`} />
                    </label>
                    <div className="sm:col-span-3">
                      <button className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400">Save</button>
                    </div>
                  </form>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <p className="text-xs text-slate-600">
        Ties are broken by Innovation &amp; Creativity, then Technical Complexity &amp; Feasibility, then a panel vote (13.6).
        Judges differing by more than {GAP_REVIEW_MARKS} marks are flagged for review (13.3).
      </p>
    </main>
  );
}
