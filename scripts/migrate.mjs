// Idempotent schema migration. Safe to run on every deploy.
// Runs automatically via the `vercel-build` script, or manually: npm run db:migrate
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error(
    "✖ DATABASE_URL is not set. Add it in Vercel -> Project Settings -> Environment Variables (or .env.local locally)."
  );
  process.exit(1);
}

const sql = neon(url);

const statements = [
  // Submissions. created_at is stamped by the database server, never by the client.
  `CREATE TABLE IF NOT EXISTS submissions (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    team_name      TEXT        NOT NULL CHECK (char_length(team_name) BETWEEN 2 AND 80),
    project_title  TEXT        NOT NULL CHECK (char_length(project_title) BETWEEN 3 AND 120),
    description    TEXT        NOT NULL CHECK (char_length(description) BETWEEN 20 AND 3000),
    repo_url       TEXT        NOT NULL CHECK (char_length(repo_url) <= 500),
    demo_url       TEXT        NOT NULL CHECK (char_length(demo_url) <= 500),
    is_late        BOOLEAN     NOT NULL DEFAULT FALSE,
    late_reason    TEXT        CHECK (late_reason IN ('deadline_passed', 'admin_closed', 'both')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((is_late AND late_reason IS NOT NULL) OR (NOT is_late AND late_reason IS NULL))
  )`,

  `CREATE INDEX IF NOT EXISTS submissions_created_at_idx ON submissions (created_at DESC)`,

  // Single-row global settings table (the "Close Submissions" flag lives here).
  `CREATE TABLE IF NOT EXISTS settings (
    id                 INT         PRIMARY KEY CHECK (id = 1),
    submissions_closed BOOLEAN     NOT NULL DEFAULT FALSE,
    closed_at          TIMESTAMPTZ
  )`,

  `INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,

  // Make the Late flag, its reason and the timestamp permanent at the database level.
  `CREATE OR REPLACE FUNCTION protect_submission_flags() RETURNS trigger AS $$
  BEGIN
    IF NEW.is_late     IS DISTINCT FROM OLD.is_late
       OR NEW.late_reason IS DISTINCT FROM OLD.late_reason
       OR NEW.created_at  IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'is_late, late_reason and created_at are immutable';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql`,

  `DROP TRIGGER IF EXISTS submissions_protect_flags ON submissions`,

  `CREATE TRIGGER submissions_protect_flags
     BEFORE UPDATE ON submissions
     FOR EACH ROW EXECUTE FUNCTION protect_submission_flags()`,
];

try {
  for (const statement of statements) {
    await sql.query(statement);
  }
  console.log("✔ Database schema is up to date");
} catch (err) {
  console.error("✖ Migration failed:", err);
  process.exit(1);
}
