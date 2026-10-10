# Orion — Hackathon Submission Portal

Next.js 15 (App Router) · React 19 · Tailwind CSS 4 · Neon Postgres (via Vercel Marketplace) · deploys on Vercel.

## How it works

| Piece | Where |
| --- | --- |
| Public submission form | `src/app/page.tsx`, `src/components/SubmissionForm.tsx` |
| Server action (validation + insert + late logic) | `src/app/actions.ts` |
| Admin dashboard, login, Close/Reopen toggle | `src/app/admin/page.tsx`, `src/app/admin/actions.ts` |
| CSV export (admin only) | `src/app/admin/export/route.ts` |
| Schema migration (idempotent) | `scripts/migrate.mjs` |
| Signed-cookie admin auth | `src/lib/auth.ts` |

### Late-submission logic

A submission is flagged **Late** (`is_late = true`, permanently) if either:

1. the database clock is past `SUBMISSION_DEADLINE`, or
2. the admin has clicked **Close Submissions** (`settings.submissions_closed = true`).

The decision is made inside a single `INSERT … SELECT` using the **database server's** `now()`, in the same statement that reads the admin flag. `created_at` uses the same clock (`DEFAULT now()`), so the recorded timestamp and the late decision can never disagree, and nothing the browser sends can change either one. A database trigger rejects any later `UPDATE` of `is_late`, `late_reason` or `created_at`. Reopening submissions never un-flags earlier late entries. `late_reason` records which rule applied: `deadline_passed`, `admin_closed` or `both`.

Late submissions are still accepted, as required.

## Local development

```bash
npm install
cp .env.example .env.local      # then fill in the values
npm run db:migrate              # creates tables (needs DATABASE_URL)
npm run dev                     # http://localhost:3000  (admin: /admin)
```

## Environment variables

| Name | Required | Example | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | `postgresql://…neon.tech/neondb?sslmode=require` | Added automatically by the Vercel + Neon integration. `POSTGRES_URL` is accepted as a fallback. |
| `ADMIN_PASSWORD` | yes | long random string | Password for `/admin`. |
| `ADMIN_SESSION_SECRET` | recommended | `openssl rand -hex 32` | Signs the admin cookie. Falls back to `ADMIN_PASSWORD` if unset. |
| `SUBMISSION_DEADLINE` | yes | `2026-10-12T18:00:00+05:30` | ISO 8601 **with UTC offset**. |
| `EVENT_TIMEZONE` | no | `Asia/Kolkata` | Display only. Defaults to `UTC`. |

## Deploying to Vercel

### 1. Push the project to GitHub

```bash
git init
git add .
git commit -m "Orion submission portal"
git branch -M main
git remote add origin https://github.com/<you>/orion-portal.git
git push -u origin main
```

### 2. Import the project in Vercel

1. Go to <https://vercel.com/new> and import the repository.
2. Framework preset is detected as **Next.js**. `vercel.json` already sets the build command to `npm run vercel-build`, which runs the DB migration and then `next build`. Leave everything else as default.
3. **Don't click Deploy yet** — set up the database and env vars first (steps 3–4). If you already deployed, just redeploy afterwards.

### 3. Create the database (Neon)

1. In your Vercel project, open **Storage** (or **Marketplace**) → **Neon** → **Create / Connect Database**.
2. Choose a region close to your Vercel Functions region, and connect it to **Production**, **Preview** and **Development**.
3. This injects `DATABASE_URL` into the project for you. Check it under **Settings → Environment Variables**.

Prefer to do it by hand? Create a project at <https://neon.tech>, copy the pooled connection string and add it as `DATABASE_URL`.

### 4. Add the other environment variables

In **Settings → Environment Variables**, add for Production (and Preview if you want to test there):

```
ADMIN_PASSWORD         = <long random password>
ADMIN_SESSION_SECRET   = <output of: openssl rand -hex 32>
SUBMISSION_DEADLINE    = 2026-10-12T18:00:00+05:30
EVENT_TIMEZONE         = Asia/Kolkata
```

### 5. Deploy

Click **Deploy** (or push to `main`). During the build you should see `✔ Database schema is up to date` in the logs. The migration is idempotent, so it is safe on every deploy.

Using the CLI instead:

```bash
npm i -g vercel
vercel login
vercel link
vercel env pull .env.local     # pulls DATABASE_URL etc. for local dev
vercel --prod
```

### 6. Smoke-test before the event

1. Open the site and submit a test project before the deadline → admin shows **On time**.
2. Open `/admin`, sign in, click **Close Submissions**, submit again → shows **Late Submission** (`admin_closed`).
3. Click **Reopen Submissions** and submit → On time again, while the earlier Late row stays Late.
4. To test the deadline path: set `SUBMISSION_DEADLINE` to a past time in a Preview environment, redeploy, submit → Late (`deadline_passed`).
5. Delete the test rows in the Neon SQL editor: `DELETE FROM submissions;`

## Changing the deadline later

Vercel environment variables are applied at deploy time. After editing `SUBMISSION_DEADLINE`, **redeploy** (Deployments → ⋯ → Redeploy) for it to take effect.

## Operational notes

- **Admin sessions** last 8 hours. Rotating `ADMIN_PASSWORD` (or `ADMIN_SESSION_SECRET`) logs everyone out.
- **Spam:** a hidden honeypot field is included. For a public event consider adding Vercel's bot protection or a rate limit (e.g. Upstash) in front of the server action.
- **Duplicates:** the portal accepts multiple submissions per team. If you want one per team, add a `UNIQUE (lower(team_name))` index and decide whether resubmits should replace or be rejected.
- **Scripts:** `npm run typecheck`, `npm run db:migrate` (local), `npm run vercel-build` (used by Vercel).
