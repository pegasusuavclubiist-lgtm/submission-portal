import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ScoreForm from "@/components/ScoreForm";
import { formatDateTime } from "@/lib/config";
import { getDb } from "@/lib/db";
import { getCurrentJudge, isScoringLocked } from "@/lib/judge";
import { CRITERIA, TRACKS, isTrack, type CriterionKey } from "@/lib/rubric";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Orion · Score a team",
  robots: { index: false, follow: false },
};

export default async function ScoreTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const judge = await getCurrentJudge();
  if (!judge) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 text-center">
        <p className="text-slate-300">Please sign in to continue.</p>
        <a href="/judge" className="mt-4 text-indigo-300 hover:underline">Go to judge sign-in</a>
      </main>
    );
  }

  const { id } = await params;
  const submissionId = Number(id);
  if (!Number.isInteger(submissionId)) notFound();

  const db = getDb();
  const first = await db`SELECT team_key FROM submissions WHERE id = ${submissionId}`;
  if (!first[0]) notFound();
  const teamKey = String(first[0].team_key);

  const [subs, scoreRows, metaRows, locked] = await Promise.all([
    db`SELECT id, team_name, project_title, description, repo_url, demo_url, is_late, late_reason, created_at
         FROM submissions WHERE team_key = ${teamKey} ORDER BY created_at DESC`,
    db`SELECT conflict, innovation, technical, relevance, scalability, presentation, cad, comments
         FROM scores WHERE judge_id = ${judge.id} AND team_key = ${teamKey}`,
    db`SELECT track FROM team_meta WHERE team_key = ${teamKey}`,
    isScoringLocked(),
  ]);

  const latest = subs[0];
  const earlier = subs.slice(1);
  const track = metaRows[0]?.track;

  const s = scoreRows[0];
  let existing = null;
  if (s) {
    const marks = {} as Record<CriterionKey, number | null>;
    for (const c of CRITERIA) marks[c.key] = s[c.key] === null ? null : Number(s[c.key]);
    existing = { conflict: Boolean(s.conflict), marks, comments: s.comments ? String(s.comments) : null };
  }

  const link = (href: unknown, label: string) =>
    href ? (
      <a href={String(href)} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:underline">
        {label} ↗
      </a>
    ) : (
      <span className="text-slate-600">No {label.toLowerCase()}</span>
    );

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <a href="/judge" className="text-sm text-slate-400 hover:text-white">← All teams</a>

      <header className="mb-6 mt-4">
        <p className="text-xs uppercase tracking-wider text-slate-500">
          {isTrack(track) ? TRACKS[track] : "Track not set"} · signed in as {judge.name}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">{String(latest.team_name)}</h1>
        <p className="text-slate-300">{String(latest.project_title)}</p>
      </header>

      <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-slate-400">Latest submission · {formatDateTime(latest.created_at)}</span>
          {latest.is_late && (
            <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-0.5 text-xs font-medium text-amber-200">
              Late Submission
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{String(latest.description)}</p>
        <div className="mt-4 flex gap-5 text-sm">
          {link(latest.repo_url, "Repository")}
          {link(latest.demo_url, "Demo / video")}
        </div>

        {earlier.length > 0 && (
          <details className="mt-5 border-t border-white/5 pt-4 text-sm text-slate-400">
            <summary className="cursor-pointer text-indigo-300">Earlier submissions from this team ({earlier.length})</summary>
            <ul className="mt-3 space-y-3">
              {earlier.map((e) => (
                <li key={String(e.id)} className="rounded-lg bg-white/[0.03] p-3">
                  <p className="text-xs text-slate-500">{formatDateTime(e.created_at)}</p>
                  <p className="mt-1 font-medium text-slate-200">{String(e.project_title)}</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-slate-400">{String(e.description)}</p>
                  <div className="mt-2 flex gap-4 text-xs">
                    {link(e.repo_url, "Repository")}
                    {link(e.demo_url, "Demo / video")}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <ScoreForm submissionId={Number(latest.id)} existing={existing} locked={locked} />
    </main>
  );
}
