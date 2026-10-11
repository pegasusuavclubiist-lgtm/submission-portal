import type { Metadata } from "next";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { isAdmin } from "@/lib/auth";
import { formatDateTime, getDeadline } from "@/lib/config";
import { getDb } from "@/lib/db";
import { LATE_REASON_LABEL, type Submission } from "@/lib/types";
import { loginAction, logoutAction, setSubmissionsClosedAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Orion · Admin",
  robots: { index: false, follow: false },
};

type Filter = "all" | "late" | "ontime";

function LoginScreen({ error }: { error: boolean }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-5">
      <h1 className="mb-1 text-2xl font-semibold text-white">Orion admin</h1>
      <p className="mb-6 text-sm text-slate-400">Enter the admin password to continue.</p>
      <form action={loginAction} className="space-y-4">
        <input
          type="password"
          name="password"
          required
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-400/20"
        />
        {error && <p className="text-xs text-rose-400">Incorrect password.</p>}
        <button className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400">
          Sign in
        </button>
      </form>
    </main>
  );
}

function FilterTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
        active ? "bg-white text-slate-900" : "bg-white/5 text-slate-300 hover:bg-white/10"
      }`}
    >
      {children}
    </a>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; filter?: string }>;
}) {
  const params = await searchParams;
  if (!(await isAdmin())) {
    return <LoginScreen error={params.error === "1"} />;
  }

  const db = getDb();
  const [settingsRows, submissionRows] = await Promise.all([
    db`SELECT submissions_closed, closed_at FROM settings WHERE id = 1`,
    db`SELECT id, team_name, project_title, description, repo_url, demo_url,
              is_late, late_reason, created_at
       FROM submissions ORDER BY created_at DESC`,
  ]);

  const closed = Boolean(settingsRows[0]?.submissions_closed);
  const closedAt = settingsRows[0]?.closed_at as Date | null | undefined;
  const submissions = submissionRows as unknown as Submission[];

  let deadline: Date | null = null;
  try {
    deadline = getDeadline();
  } catch {
    /* shown as "not configured" below */
  }

  const filter: Filter = params.filter === "late" || params.filter === "ontime" ? params.filter : "all";
  const lateCount = submissions.filter((s) => s.is_late).length;
  const visible = submissions.filter((s) =>
    filter === "late" ? s.is_late : filter === "ontime" ? !s.is_late : true
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Orion · Admin</h1>
          <p className="text-sm text-slate-400">
            Deadline: {deadline ? formatDateTime(deadline) : "not configured (set SUBMISSION_DEADLINE)"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/admin/judging" className="rounded-lg bg-indigo-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-400">
            Judging panel
          </a>
          <a href="/admin/export"className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-slate-200 hover:bg-white/10">
            Export CSV
          </a>
          <form action={logoutAction}>
            <button className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-slate-400 hover:text-white">
              Log out
            </button>
          </form>
        </div>
      </header>

      {/* Closing mechanism */}
      <section
        className={`mb-8 flex flex-wrap items-center justify-between gap-5 rounded-2xl border p-6 ${
          closed ? "border-rose-400/30 bg-rose-400/10" : "border-emerald-400/25 bg-emerald-400/10"
        }`}
      >
        <div>
          <p className={`text-lg font-semibold ${closed ? "text-rose-100" : "text-emerald-100"}`}>
            {closed ? "Submissions are CLOSED" : "Submissions are OPEN"}
          </p>
          <p className="mt-1 max-w-xl text-sm text-slate-300">
            {closed
              ? `Closed ${closedAt ? formatDateTime(closedAt) : ""}. New submissions are still accepted but permanently flagged as Late. Reopening does not remove existing Late flags.`
              : "When closed, new submissions are still accepted but permanently flagged as Late Submission."}
          </p>
        </div>
        <form action={setSubmissionsClosedAction}>
          <input type="hidden" name="close" value={closed ? "false" : "true"} />
          <ConfirmSubmitButton
            message={
              closed
                ? "Reopen submissions? Existing Late flags will remain."
                : "Close submissions? New entries will still be accepted but permanently flagged as Late."
            }
            className={`rounded-xl px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:brightness-110 ${
              closed ? "bg-emerald-600 shadow-emerald-900/40" : "bg-rose-600 shadow-rose-900/40"
            }`}
          >
            {closed ? "Reopen Submissions" : "Close Submissions"}
          </ConfirmSubmitButton>
        </form>
      </section>

      {/* Stats + filters */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          <span className="font-semibold text-white">{submissions.length}</span> total ·{" "}
          <span className="font-semibold text-emerald-300">{submissions.length - lateCount}</span> on time ·{" "}
          <span className="font-semibold text-amber-300">{lateCount}</span> late
        </p>
        <div className="flex gap-2">
          <FilterTab href="/admin" active={filter === "all"}>All</FilterTab>
          <FilterTab href="/admin?filter=ontime" active={filter === "ontime"}>On time</FilterTab>
          <FilterTab href="/admin?filter=late" active={filter === "late"}>Late</FilterTab>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
              <th className="px-4 py-3 font-medium">Team</th>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Links</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  No submissions to show.
                </td>
              </tr>
            )}
            {visible.map((s) => (
              <tr key={s.id} className="align-top">
                <td className="px-4 py-3 font-mono text-slate-500">{s.id}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-300">{formatDateTime(s.created_at)}</td>
                <td className="px-4 py-3 font-medium text-white">{s.team_name}</td>
                <td className="max-w-sm px-4 py-3">
                  <p className="font-medium text-slate-100">{s.project_title}</p>
                  <details className="mt-1 text-slate-400">
                    <summary className="cursor-pointer text-xs text-indigo-300">Description</summary>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed">{s.description}</p>
                  </details>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <a href={s.repo_url} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:underline">
                    Repo
                  </a>
                  <span className="px-2 text-slate-600">·</span>
                  {s.demo_url ? (
                    <a href={s.demo_url} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:underline">
                      Demo
                    </a>
                  ) : (
                    <span className="text-slate-600">No demo</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {s.is_late ? (
                    <span
                      title={s.late_reason ? LATE_REASON_LABEL[s.late_reason] : undefined}
                      className="inline-block rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 text-xs font-medium text-amber-200"
                    >
                      Late Submission
                    </span>
                  ) : (
                    <span className="inline-block rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
                      On time
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
