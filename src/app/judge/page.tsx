import type { Metadata } from "next";
import { formatDateTime } from "@/lib/config";
import { getDb } from "@/lib/db";
import { getCurrentJudge, isScoringLocked } from "@/lib/judge";
import { TRACKS, isTrack } from "@/lib/rubric";
import { judgeLoginAction, judgeLogoutAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Orion · Judging panel",
  robots: { index: false, follow: false },
};

function LoginScreen({ error }: { error: boolean }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.35em] text-indigo-300">✦ Orion ✦</p>
      <h1 className="mb-1 text-2xl font-semibold text-white">Judging panel</h1>
      <p className="mb-6 text-sm text-slate-400">Enter the passcode the organisers gave you.</p>
      <form action={judgeLoginAction} className="space-y-4">
        <input
          name="code"
          required
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="XXXX-XXXX"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-center font-mono text-lg tracking-widest text-slate-100 outline-none focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-400/20"
        />
        {error && <p className="text-xs text-rose-400">That passcode was not recognised.</p>}
        <button className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400">
          Enter
        </button>
      </form>
    </main>
  );
}

type Filter = "all" | "todo" | "done";

export default async function JudgePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; filter?: string; track?: string }>;
}) {
  const params = await searchParams;
  const judge = await getCurrentJudge();
  if (!judge) return <LoginScreen error={params.error === "1"} />;

  const db = getDb();
  const [locked, rows] = await Promise.all([
    isScoringLocked(),
    db`SELECT t.team_key, t.team_name, t.project_title, t.id, t.created_at, t.is_late, t.submission_count,
              m.track, sc.conflict, sc.updated_at AS scored_at,
              (sc.team_key IS NOT NULL) AS has_score
         FROM (
           SELECT DISTINCT ON (team_key) team_key, team_name, project_title, id, created_at, is_late,
                  count(*) OVER (PARTITION BY team_key) AS submission_count
             FROM submissions
            ORDER BY team_key, created_at DESC
         ) t
         LEFT JOIN team_meta m ON m.team_key = t.team_key
         LEFT JOIN scores sc ON sc.team_key = t.team_key AND sc.judge_id = ${judge.id}
        ORDER BY t.team_name`,
  ]);

  const filter: Filter = params.filter === "todo" || params.filter === "done" ? params.filter : "all";
  const trackFilter = isTrack(params.track) ? params.track : null;

  const done = rows.filter((r) => r.has_score).length;
  const visible = rows.filter((r) => {
    if (filter === "todo" && r.has_score) return false;
    if (filter === "done" && !r.has_score) return false;
    if (trackFilter && r.track !== trackFilter) return false;
    return true;
  });

  const query = (next: { filter?: string; track?: string }) => {
    const p = new URLSearchParams();
    const f = next.filter ?? params.filter;
    const t = next.track ?? params.track;
    if (f && f !== "all") p.set("filter", f);
    if (t && t !== "all") p.set("track", t);
    const s = p.toString();
    return `/judge${s ? `?${s}` : ""}`;
  };

  const pill = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
      active ? "bg-white text-slate-900" : "bg-white/5 text-slate-300 hover:bg-white/10"
    }`;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-300">✦ Orion ✦</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Judging panel</h1>
          <p className="text-sm text-slate-400">
            Signed in as <span className="text-slate-200">{judge.name}</span> · {done} of {rows.length} teams scored
          </p>
        </div>
        <form action={judgeLogoutAction}>
          <button className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-slate-400 hover:text-white">
            Sign out
          </button>
        </form>
      </header>

      {locked && (
        <p className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
          Scoring has been locked by the organisers. You can view your scores but not change them.
        </p>
      )}

      <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">
        <h2 className="mb-2 font-semibold text-white">Judges&apos; guide (Rulebook 12.4, 13)</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-slate-400">
          <li>Score every team <strong className="text-slate-200">independently</strong>. Do not discuss crews with other judges until scoring is complete.</li>
          <li>Marks per criterion: Innovation 25, Technical 20, Problem Relevance 15, Scalability 15, Presentation 15, CAD 10 (total 100). Half marks are allowed.</li>
          <li>Declare any conflict of interest on that team&apos;s page and do not score it.</li>
          <li>Explain Test: if a crew cannot explain what it submitted, you may reduce marks.</li>
          <li>Ask questions to understand the work, not to intimidate. Keep submissions confidential.</li>
          <li>The organisers add the Interdisciplinary Bonus and any penalties; you only fill in the 100-mark rubric.</li>
        </ul>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <a href={query({ filter: "all" })} className={pill(filter === "all")}>All</a>
        <a href={query({ filter: "todo" })} className={pill(filter === "todo")}>To score</a>
        <a href={query({ filter: "done" })} className={pill(filter === "done")}>Scored</a>
        <span className="mx-1 text-slate-700">|</span>
        <a href={query({ track: "all" })} className={pill(!trackFilter)}>Both tracks</a>
        <a href={query({ track: "senior" })} className={pill(trackFilter === "senior")}>Senior</a>
        <a href={query({ track: "first_year" })} className={pill(trackFilter === "first_year")}>First-Year</a>
      </div>

      <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        {visible.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">No teams to show.</p>}
        {visible.map((r) => (
          <a key={String(r.team_key)} href={`/judge/${r.id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.04]">
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{String(r.team_name)}</p>
              <p className="truncate text-sm text-slate-400">{String(r.project_title)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {isTrack(r.track) ? TRACKS[r.track] : "Track not set"} · last submitted {formatDateTime(r.created_at)}
                {Number(r.submission_count) > 1 ? ` · ${r.submission_count} submissions` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {r.is_late && (
                <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 text-xs font-medium text-amber-200">Late</span>
              )}
              {r.has_score ? (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
                  {r.conflict ? "Recused" : "Scored"}
                </span>
              ) : (
                <span className="rounded-full border border-white/15 px-2.5 py-1 text-xs font-medium text-slate-400">To score</span>
              )}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
