import SubmissionForm from "@/components/SubmissionForm";
import { formatDateTime, getDeadline } from "@/lib/config";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getStatus() {
  let closed = false;
  try {
    const db = getDb();
    const rows = await db`SELECT submissions_closed FROM settings WHERE id = 1`;
    closed = Boolean(rows[0]?.submissions_closed);
  } catch (err) {
    console.error("Could not read settings:", err);
  }

  let deadline: Date | null = null;
  try {
    deadline = getDeadline();
  } catch (err) {
    console.error(err);
  }

  const pastDeadline = deadline ? Date.now() > deadline.getTime() : false;
  return { closed, deadline, lateMode: closed || pastDeadline };
}

export default async function HomePage() {
  const { closed, deadline, lateMode } = await getStatus();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-14 sm:py-20">
      <header className="mb-10 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-indigo-300">
          ✦ Hackathon ✦
        </p>
        <h1 className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
          Orion
        </h1>
        <p className="mt-3 text-slate-400">Submit your project for judging.</p>
      </header>

      {lateMode ? (
        <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
          <p className="font-medium">
            {closed ? "Submissions have been closed by the organisers." : "The submission deadline has passed."}
          </p>
          <p className="mt-1 text-amber-200/80">
            You can still submit, but your project will be permanently marked as a Late Submission.
          </p>
        </div>
      ) : (
        deadline && (
          <div className="mb-6 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-100">
            <p className="font-medium">Submissions are open</p>
            <p className="mt-1 text-emerald-200/80">Deadline: {formatDateTime(deadline)}</p>
          </div>
        )
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
        <SubmissionForm />
      </section>

      <p className="mt-8 text-center text-xs text-slate-600">
        Submission time is recorded on the server when you press submit.
      </p>
    </main>
  );
}
