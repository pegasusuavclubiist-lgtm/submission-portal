import { isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Prefix cells that spreadsheets would interpret as formulas (CSV injection).
function cell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  if (!(await isAdmin())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = getDb();
  const rows = await db`
    SELECT id, created_at, team_name, project_title, description,
           repo_url, demo_url, is_late, late_reason
    FROM submissions
    ORDER BY created_at ASC
  `;

  const header = [
    "id",
    "submitted_at_utc",
    "team_name",
    "project_title",
    "description",
    "repo_url",
    "demo_url",
    "late",
    "late_reason",
  ];
  const lines = [header.map(cell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        new Date(r.created_at).toISOString(),
        r.team_name,
        r.project_title,
        r.description,
        r.repo_url,
        r.demo_url,
        r.is_late ? "LATE" : "on time",
        r.late_reason ?? "",
      ]
        .map(cell)
        .join(",")
    );
  }

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orion-submissions.csv"',
      "Cache-Control": "no-store",
    },
  });
}
