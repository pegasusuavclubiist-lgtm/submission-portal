"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, destroySession, isAdmin, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  if (!verifyPassword(password)) {
    // Small delay slows down password guessing.
    await new Promise((resolve) => setTimeout(resolve, 700));
    redirect("/admin?error=1");
  }
  await createSession();
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin");
}

/** Sets the global "submissions closed" flag. Already-stored Late flags are never changed. */
export async function setSubmissionsClosedAction(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin");

  const close = formData.get("close") === "true";
  const db = getDb();
  await db`
    UPDATE settings
    SET submissions_closed = ${close},
        closed_at = CASE WHEN ${close}::boolean THEN COALESCE(closed_at, now()) ELSE NULL END
    WHERE id = 1
  `;

  revalidatePath("/admin");
  revalidatePath("/");
}
