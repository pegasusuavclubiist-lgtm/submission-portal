"use server";

import { revalidatePath } from "next/cache";
import { formatDateTime, getDeadline } from "@/lib/config";
import { getDb } from "@/lib/db";
import type { FieldName, SubmitState } from "@/lib/types";

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function isHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function submitProject(
  _previous: SubmitState,
  formData: FormData
): Promise<SubmitState> {
  // Honeypot: real users never see or fill this field.
  if (clean(formData.get("company_website"))) {
    return { status: "error", errors: {}, values: {}, message: "Submission rejected." };
  }

  const values: Record<FieldName, string> = {
    teamName: clean(formData.get("teamName")),
    projectTitle: clean(formData.get("projectTitle")),
    description: clean(formData.get("description")),
    repoUrl: clean(formData.get("repoUrl")),
    demoUrl: clean(formData.get("demoUrl")),
  };

  const errors: Partial<Record<FieldName, string>> = {};
  if (values.teamName.length < 2 || values.teamName.length > 80)
    errors.teamName = "Team name must be 2–80 characters.";
  if (values.projectTitle.length < 3 || values.projectTitle.length > 120)
    errors.projectTitle = "Project title must be 3–120 characters.";
  if (values.description.length < 20 || values.description.length > 3000)
    errors.description = "Description must be 20–3000 characters.";
  if (!isHttpUrl(values.repoUrl) || values.repoUrl.length > 500)
    errors.repoUrl = "Enter a valid repository URL starting with https://";
  // Demo/video link is optional (bonus points). If given, it must be a valid URL.
  if (values.demoUrl && (!isHttpUrl(values.demoUrl) || values.demoUrl.length > 500))
    errors.demoUrl = "If you add a demo/video link, it must be a valid URL starting with https://";

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  let deadline: Date;
  try {
    deadline = getDeadline();
  } catch (err) {
    console.error(err);
    return {
      status: "error",
      errors: {},
      values,
      message: "The portal is not configured correctly. Please contact the organisers.",
    };
  }

  try {
    const db = getDb();
    const deadlineIso = deadline.toISOString();

    // One atomic statement. The late decision and created_at both use the
    // DATABASE server clock (now() is identical within a statement), and the
    // admin "closed" flag is read in the same statement, so there is no race
    // between checking and inserting. The client cannot influence either value.
    const rows = await db`
      INSERT INTO submissions
        (team_name, project_title, description, repo_url, demo_url, is_late, late_reason)
      SELECT
        ${values.teamName}, ${values.projectTitle}, ${values.description},
        ${values.repoUrl}, ${values.demoUrl},
        (s.submissions_closed OR now() > ${deadlineIso}::timestamptz),
        CASE
          WHEN s.submissions_closed AND now() > ${deadlineIso}::timestamptz THEN 'both'
          WHEN s.submissions_closed THEN 'admin_closed'
          WHEN now() > ${deadlineIso}::timestamptz THEN 'deadline_passed'
          ELSE NULL
        END
      FROM settings s
      WHERE s.id = 1
      RETURNING id, created_at, is_late, late_reason
    `;

    const row = rows[0];
    if (!row) throw new Error("settings row missing — run `npm run db:migrate`");

    revalidatePath("/admin");
    return {
      status: "success",
      id: Number(row.id),
      submittedAt: formatDateTime(row.created_at),
      isLate: Boolean(row.is_late),
      lateReason: row.late_reason ?? null,
    };
  } catch (err) {
    console.error("Submission failed:", err);
    return {
      status: "error",
      errors: {},
      values,
      message: "Something went wrong saving your submission. Please try again.",
    };
  }
}
