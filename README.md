# Leadgen Dashboard — Supabase + Vercel + Google Places

Deployable version of the AU/US SMB outreach pipeline: Google Places discovery,
Claude-based site scoring, Claude-drafted pitches, a review dashboard, and
Smartlead sending — all as one Next.js app on Vercel's free tier.

## Architecture

```
Vercel Cron (daily) ──▶ /api/cron/discover  ──▶ Supabase `leads`
Vercel Cron (daily) ──▶ /api/cron/score     ──▶ Claude scores each site
Vercel Cron (daily) ──▶ /api/cron/pitch     ──▶ Claude drafts subject+body
                                                  ↓ status: pending_approval
You, in the dashboard ──▶ approve / edit / reject
                                                  ↓ status: approved
You, in the dashboard ──▶ "Run queue"       ──▶ /api/queue ──▶ Smartlead
```

Nothing sends without your approval in the dashboard. The dashboard is also
where you manually attach an email to each lead (Google Places doesn't return
emails — see the note in the previous README, same limitation applies here).

## 1. Create the Supabase project (free)

1. Go to supabase.com → New project (free tier).
2. Once created, open the SQL editor and paste in `sql/schema.sql`, run it.
3. Go to Project Settings → API. Copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key (NOT the anon key) → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Get a Google Places API key

1. Go to console.cloud.google.com → create a project (or use an existing one).
2. Enable billing on the project — this is required even to stay within the
   free tier. As of 2026, Google Places (New) uses per-SKU monthly free
   allotments (10,000 events/month for Essentials-tier fields, 5,000/month
   for Pro-tier fields like phone/website) rather than the old pooled $200
   credit. Our field mask requests phone + website, which lands in the Pro
   tier — 5,000 free lookups/month, still generous for daily discovery runs.
3. APIs & Services → Enable "Places API (New)".
4. Credentials → Create API key → restrict it to Places API (New) for safety.
5. Copy the key → `GOOGLE_PLACES_API_KEY`.
6. Optional: set a daily quota cap in APIs & Services → Quotas so a bug can't
   run up a bill unexpectedly.

## 3. Get an Anthropic API key

console.anthropic.com → API Keys → create one → `ANTHROPIC_API_KEY`.

## 4. Deploy to Vercel (free)

1. Push this folder to a GitHub repo.
2. vercel.com → New Project → import the repo.
3. Before first deploy, add these Environment Variables (Project Settings →
   Environment Variables), for Production (and Preview if you want to test
   there too):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_PLACES_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `APP_PASSWORD` — pick any password, this gates your dashboard
   - `CRON_SECRET` — random 16+ char string (this is what lets Vercel's own
     cron calls past the login gate; it's sent automatically by Vercel as an
     Authorization header matching this value — see `lib/auth.js`)
   - `FROM_NAME`, `PHYSICAL_ADDRESS`, `UNSUBSCRIBE_BASE_URL` — for the
     compliance footer
   - `SMARTLEAD_API_KEY`, `SMARTLEAD_CAMPAIGN_ID` — once you're ready to send
4. Deploy. Vercel reads `vercel.json` automatically and registers the three
   cron jobs (discover/score/pitch, staggered at 22:00 / 23:00 / 00:00 UTC —
   roughly 6–8am Manila time). Hobby plan allows daily-only cron frequency,
   which is exactly what we want here.
5. Visit your `*.vercel.app` URL → you'll hit the login page → enter
   `APP_PASSWORD` → you're in.

## 5. Using the dashboard

- The four "Run …" buttons at the top let you manually trigger discover /
  score / pitch / queue immediately, instead of waiting for the next cron
  tick — handy while you're testing.
- "Needs review" tab shows every Claude-drafted pitch with the specific
  issues it found on that lead's site. You can Approve, Edit (rewrite
  subject/body inline, then it auto-approves), or Reject.
- Add an email to a lead in any tab before running "queue" — leads without
  one are skipped and logged as `skipped_no_email`.
- "Sent" tab shows what's already gone to Smartlead.

## 6. Editing your target searches

Edit the `SEARCHES` array in `lib/places.js` — niches and locations for both
AU and US. This is also where the field-mask/SKU-tier tradeoff is documented
if you want to trim costs further.

## Compliance notes (AU Spam Act + US CAN-SPAM)

Same as before: the footer in `/api/queue.js` appends your physical address
and an unsubscribe link automatically. Keep `PHYSICAL_ADDRESS` accurate.
Consider adding a simple `/unsubscribe` page later that writes to the
`unsubscribes` table — right now the URL is a placeholder you'd need to wire
up (flag if you want this built next).

## What's intentionally left manual

- **Email addresses.** No enrichment step yet — add manually per lead, or
  wire up Apollo/Clearbit later.
- **Unsubscribe page.** The link in the footer needs a real page/route,
  not built yet.
- **Auth.** The password gate is intentionally simple (single shared
  password, no user accounts) since this is a single-operator tool.
