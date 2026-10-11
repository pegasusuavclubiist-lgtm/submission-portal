"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveScoreAction, type ScoreState } from "@/app/judge/actions";
import { CRITERIA, MARK_STEP, RUBRIC_TOTAL, type CriterionKey } from "@/lib/rubric";

const initialState: ScoreState = { status: "idle" };

const inputClass =
  "w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-right text-base font-semibold text-slate-100 outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-400/20 disabled:opacity-40";

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save scores"}
    </button>
  );
}

export default function ScoreForm({
  submissionId,
  existing,
  locked,
}: {
  submissionId: number;
  existing: { conflict: boolean; marks: Record<CriterionKey, number | null>; comments: string | null } | null;
  locked: boolean;
}) {
  const [state, formAction] = useActionState(saveScoreAction, initialState);
  const [conflict, setConflict] = useState(existing?.conflict ?? false);
  const [values, setValues] = useState<Record<CriterionKey, string>>(() => {
    const initial = {} as Record<CriterionKey, string>;
    for (const c of CRITERIA) {
      const v = existing?.marks[c.key];
      initial[c.key] = v === null || v === undefined ? "" : String(v);
    }
    return initial;
  });

  const total = CRITERIA.reduce((sum, c) => {
    const n = Number(values[c.key]);
    return sum + (values[c.key] !== "" && Number.isFinite(n) ? n : 0);
  }, 0);
  const filled = CRITERIA.filter((c) => values[c.key] !== "").length;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="submissionId" value={submissionId} />

      {/* Conflict of interest — rulebook 9.8 */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <input
          type="checkbox"
          name="conflict"
          checked={conflict}
          disabled={locked}
          onChange={(e) => setConflict(e.target.checked)}
          className="mt-1 h-4 w-4 accent-indigo-500"
        />
        <span className="text-sm">
          <span className="font-medium text-slate-100">I have a conflict of interest with this team</span>
          <span className="mt-0.5 block text-slate-400">
            Personal, family, academic-supervision or club-project tie (Rulebook 9.8). You will not score this team and
            your marks are left out of the average.
          </span>
        </span>
      </label>

      <fieldset disabled={conflict || locked} className="space-y-3 disabled:opacity-50">
        <legend className="sr-only">Scoring matrix</legend>
        {CRITERIA.map((c) => (
          <div
            key={c.key}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="min-w-0 flex-1 basis-64">
              <label htmlFor={c.key} className="block text-sm font-semibold text-white">
                {c.label} <span className="font-normal text-slate-500">· {c.weight}% · {c.weight} marks</span>
              </label>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{c.look}</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                id={c.key}
                name={c.key}
                type="number"
                inputMode="decimal"
                min={0}
                max={c.weight}
                step={MARK_STEP}
                value={values[c.key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [c.key]: e.target.value }))}
                placeholder="0"
                className={inputClass}
              />
              <span className="w-10 text-sm text-slate-500">/ {c.weight}</span>
            </div>
          </div>
        ))}
      </fieldset>

      <div className="flex items-center justify-between rounded-xl border border-indigo-400/30 bg-indigo-400/10 px-5 py-4">
        <span className="text-sm text-indigo-100">
          {conflict ? "Recused — no score for this team" : `Rubric total (${filled}/${CRITERIA.length} criteria entered)`}
        </span>
        <span className="text-2xl font-bold text-white">
          {conflict ? "—" : total}
          {!conflict && <span className="text-base font-medium text-indigo-200"> / {RUBRIC_TOTAL}</span>}
        </span>
      </div>

      <div>
        <label htmlFor="comments" className="mb-1.5 block text-sm font-medium text-slate-200">
          Comments / feedback <span className="font-normal text-slate-500">(optional, Rulebook 13.8)</span>
        </label>
        <textarea
          id="comments"
          name="comments"
          rows={4}
          maxLength={2000}
          disabled={locked}
          defaultValue={existing?.comments ?? ""}
          placeholder="Strengths, gaps, questions you asked in the Explain Test…"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-400/20 disabled:opacity-50"
        />
      </div>

      {state.status === "error" && (
        <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{state.message}</p>
      )}
      {state.status === "saved" && (
        <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          ✓ {state.message}
        </p>
      )}
      {locked && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Scoring is locked by the organisers. Scores are read-only.
        </p>
      )}

      <SaveButton disabled={locked} />
    </form>
  );
}
