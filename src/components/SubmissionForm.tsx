"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitProject } from "@/app/actions";
import type { FieldName, SubmitState } from "@/lib/types";

const initialState: SubmitState = { status: "idle" };

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-indigo-400/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-indigo-400/20";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Submitting…" : "Submit project"}
    </button>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: FieldName;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-slate-200">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-rose-400">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export default function SubmissionForm() {
  const [state, formAction] = useActionState(submitProject, initialState);

  if (state.status === "success") {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white">Submission received</h2>
        <p className="text-sm text-slate-400">
          Reference <span className="font-mono text-slate-200">#{state.id}</span> · recorded at{" "}
          <span className="text-slate-200">{state.submittedAt}</span>
        </p>
        {state.isLate && (
          <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            Your project arrived after the cut-off, so it has been recorded as a{" "}
            <strong>Late Submission</strong>.
          </p>
        )}
        <a href="/" className="inline-block text-sm text-indigo-300 underline-offset-4 hover:underline">
          Submit another project
        </a>
      </div>
    );
  }

  const values = state.status === "error" ? state.values : {};
  const errors = state.status === "error" ? state.errors : {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message && (
        <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {state.message}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Team name" name="teamName" error={errors.teamName}>
          <input id="teamName" name="teamName" required maxLength={80} defaultValue={values.teamName} placeholder="Team Polaris" className={inputClass} />
        </Field>
        <Field label="Project title" name="projectTitle" error={errors.projectTitle}>
          <input id="projectTitle" name="projectTitle" required maxLength={120} defaultValue={values.projectTitle} placeholder="SkyScout" className={inputClass} />
        </Field>
      </div>

      <Field label="Description" name="description" error={errors.description} hint="What does it do, how did you build it, and what are you proud of? (20–3000 characters)">
        <textarea id="description" name="description" required rows={6} maxLength={3000} defaultValue={values.description} placeholder="Tell the judges about your project…" className={`${inputClass} resize-y`} />
      </Field>

      <Field label="GitHub / repository link" name="repoUrl" error={errors.repoUrl}>
        <input id="repoUrl" name="repoUrl" type="url" required maxLength={500} defaultValue={values.repoUrl} placeholder="https://github.com/your-team/your-project" className={inputClass} />
      </Field>

      <Field
        label="Demo / video link (optional)"
        name="demoUrl"
        error={errors.demoUrl}
        hint="Optional — adding a demo or video link earns bonus points."
      >
        <input id="demoUrl" name="demoUrl" type="url" maxLength={500} defaultValue={values.demoUrl} placeholder="https://youtu.be/…" className={inputClass} />
      </Field>

      {/* Honeypot for bots — hidden from people and assistive tech */}
      <div className="hidden" aria-hidden="true">
        <label>
          Leave this field empty
          <input name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <SubmitButton />
    </form>
  );
}
