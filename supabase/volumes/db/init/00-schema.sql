-- Custom tables for the Adrian Pop portfolio
-- This script runs after the Supabase base schema is initialized.

-- ─── Contact form submissions ──────────────────────────────────────────────
create table if not exists public.contact_submissions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  email       text not null,
  message     text not null,
  source      text not null default 'contact-form'  -- 'contact-form' | 'contact-book'
);

-- ─── Chat sessions ─────────────────────────────────────────────────────────
create table if not exists public.chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  session_id  text not null,
  role        text not null check (role in ('user', 'assistant')),
  message     text not null
);

create index if not exists chat_sessions_session_id_idx
  on public.chat_sessions (session_id, created_at);

-- ─── Row-Level Security ────────────────────────────────────────────────────
alter table public.contact_submissions enable row level security;
alter table public.chat_sessions enable row level security;

-- anon role can INSERT (submit forms / chat messages)
create policy "anon_insert_contacts"
  on public.contact_submissions for insert
  to anon
  with check (true);

create policy "anon_insert_chat"
  on public.chat_sessions for insert
  to anon
  with check (true);

-- service_role can read everything (used by Studio / admin queries)
create policy "service_select_contacts"
  on public.contact_submissions for select
  to service_role
  using (true);

create policy "service_select_chat"
  on public.chat_sessions for select
  to service_role
  using (true);
