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

  // ---------------------------------------------------------------------------
  // Judging panel
  // ---------------------------------------------------------------------------

  // A team may submit more than once (Day 1 update, then final). team_key groups
  // those rows into one team: lower-cased, trimmed, inner spaces collapsed.
  `ALTER TABLE submissions
     ADD COLUMN IF NOT EXISTS team_key TEXT
     GENERATED ALWAYS AS (lower(regexp_replace(btrim(team_name), '\\s+', ' ', 'g'))) STORED`,

  `CREATE INDEX IF NOT EXISTS submissions_team_key_idx ON submissions (team_key, created_at DESC)`,

  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS scoring_locked BOOLEAN NOT NULL DEFAULT FALSE`,

  `CREATE TABLE IF NOT EXISTS judges (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
    code        TEXT        NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // One row per (judge, team). Marks follow rulebook 13.1; each column is capped at
  // its criterion's weight. A judge with a conflict of interest (9.8) recuses: no marks.
  `CREATE TABLE IF NOT EXISTS scores (
    judge_id      BIGINT       NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
    team_key      TEXT         NOT NULL,
    conflict      BOOLEAN      NOT NULL DEFAULT FALSE,
    innovation    NUMERIC(4,1) CHECK (innovation   BETWEEN 0 AND 25),
    technical     NUMERIC(4,1) CHECK (technical    BETWEEN 0 AND 20),
    relevance     NUMERIC(4,1) CHECK (relevance    BETWEEN 0 AND 15),
    scalability   NUMERIC(4,1) CHECK (scalability  BETWEEN 0 AND 15),
    presentation  NUMERIC(4,1) CHECK (presentation BETWEEN 0 AND 15),
    cad           NUMERIC(4,1) CHECK (cad          BETWEEN 0 AND 10),
    comments      TEXT         CHECK (char_length(comments) <= 2000),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (judge_id, team_key),
    CHECK (
      conflict
      OR (innovation IS NOT NULL AND technical IS NOT NULL AND relevance IS NOT NULL
          AND scalability IS NOT NULL AND presentation IS NOT NULL AND cad IS NOT NULL)
    )
  )`,

  // Per-team settings applied by the organisers: track (5.4), Interdisciplinary Bonus
  // (5.2, capped at 5) and penalties (Section 15 / 11.3).
  `CREATE TABLE IF NOT EXISTS team_meta (
    team_key  TEXT         PRIMARY KEY,
    track     TEXT         CHECK (track IN ('senior', 'first_year')),
    bonus     NUMERIC(3,1) NOT NULL DEFAULT 0 CHECK (bonus BETWEEN 0 AND 5),
    penalty   NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (penalty >= 0),
    note      TEXT         CHECK (char_length(note) <= 500)
  )`,
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
