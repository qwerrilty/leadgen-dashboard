-- ============================================================
-- Leadgen Automation — Supabase Schema
-- Target: AU + US small businesses, low digital activity
-- ============================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- leads: one row per business discovered via Google Places
-- ------------------------------------------------------------
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- source / discovery
  source text default 'google_places',        -- google_places, manual, referral
  place_id text unique,                        -- Google Places place_id (dedupe key)
  search_query text,                           -- the query that found this lead, e.g. "plumbers Cebu"
  target_market text,                          -- 'AU' or 'US'

  -- business info
  business_name text not null,
  category text,                               -- Places "types" primary category
  phone text,
  website text,                                -- null if no website found
  address text,
  city text,
  region text,                                 -- state/province
  country text,                                -- 'AU' or 'US'
  rating numeric,
  review_count int,

  -- qualification signals (filled by scoring step)
  has_website boolean default false,
  site_has_ssl boolean,
  site_is_mobile_friendly boolean,
  site_last_updated_guess text,                -- e.g. copyright year found, or null
  site_screenshot_url text,
  digital_activity_score int,                  -- 0-100, lower = more opportunity
  lead_temp text default 'unscored',           -- unscored, hot, warm, cold

  -- outreach state
  email text,                                  -- manually added; Places API doesn't return emails
  pitch_subject text,                          -- Claude-generated subject line
  pitch_draft text,                             -- Claude-generated personalized pitch body
  outreach_status text default 'not_contacted',-- not_contacted, pending_approval, approved, rejected,
                                                 -- queued, sent, replied, booked, won, lost, unsubscribed
  outreach_sent_at timestamptz,
  last_contacted_at timestamptz,
  contact_count int default 0,

  -- compliance (AU Spam Act + US CAN-SPAM)
  unsubscribed boolean default false,
  unsubscribed_at timestamptz,
  opt_in_basis text,                           -- 'inferred_business_relationship' etc — document your basis

  notes text
);

create index if not exists idx_leads_temp on leads (lead_temp);
create index if not exists idx_leads_status on leads (outreach_status);
create index if not exists idx_leads_market on leads (target_market);

-- ------------------------------------------------------------
-- outreach_log: every email/message sent, for compliance + tracking
-- ------------------------------------------------------------
create table if not exists outreach_log (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id) on delete cascade,
  created_at timestamptz default now(),
  channel text default 'email',                -- email, sms, other
  subject text,
  body text,
  status text default 'sent',                  -- sent, bounced, opened, clicked, replied
  provider_message_id text                      -- Smartlead / ESP message id
);

create index if not exists idx_outreach_lead on outreach_log (lead_id);

-- ------------------------------------------------------------
-- unsubscribes: global suppression list (belt + suspenders)
-- ------------------------------------------------------------
create table if not exists unsubscribes (
  id uuid primary key default uuid_generate_v4(),
  email text unique,
  domain text,
  created_at timestamptz default now(),
  reason text
);

-- auto-update updated_at on leads
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at
before update on leads
for each row execute function set_updated_at();
