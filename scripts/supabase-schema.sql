-- One-time setup for the questionnaire lead-capture table.
-- Run this once in the Supabase project's SQL editor (Project > SQL Editor).
-- Region should be EU West (Frankfurt) for UK/EU data residency - set that
-- when creating the project, not here.

create table if not exists questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  questionnaire_slug text not null,
  form_version int not null,
  client_token uuid not null unique, -- idempotency key, one per form load
  answers jsonb not null,            -- [{ id, prompt, selected }, ...]
  wants_report boolean not null default false,
  report_consent_given_at timestamptz,
  name text,
  email text,
  marketing_consent boolean not null default false,
  marketing_consent_confirmed_at timestamptz, -- null until the double opt-in link is confirmed
  privacy_policy_version text
);

alter table questionnaire_responses enable row level security;

-- Deliberately no policies: the anon key must get permission-denied on
-- every read and write. Only the service_role key (used server-side in
-- netlify/functions/submit-questionnaire.mjs and confirm-subscription.mjs,
-- and which bypasses RLS by design) can touch this table. Verify this
-- with the anon key before sharing the questionnaire link - see
-- docs/questionnaire-data-requests.md.
