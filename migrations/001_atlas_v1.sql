-- ATLAS MVP v1.0
create extension if not exists pgcrypto;

-- ====== SITES ======
create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  cms_type text not null check (cms_type in ('wordpress','shopify')),
  locale text not null default 'fr-FR',
  timezone text not null default 'Europe/Paris',
  seo_plugin text,
  -- policies keys expected (MVP):
  -- publish_mode: 'auto'|'semi'|'manual'
  -- high_stakes: boolean
  -- cluster_caps: { [cluster_id]: int }
  -- hard_cap: boolean
  policies jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ====== SITE PAGES (snapshot inventory) ======
create table if not exists site_pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  url text not null check (length(url) > 0),
  slug text,
  title text,
  h1 text,
  status text not null default 'live' check (status in ('live','draft','archived')),
  last_modified_at timestamptz,
  cluster_id text,
  role text check (role in ('pillar','cluster','support','unknown')),
  primary_intent text check (primary_intent in ('informational','comparative','transactional','navigational','support','unknown')),
  topic_key text,
  embedding_ref text,
  embedding_hash text,
  created_at timestamptz not null default now()
);

-- unique url per site (snapshot ingestion integrity)
create unique index if not exists uq_site_pages_site_url on site_pages(site_id, url);
create index if not exists idx_site_pages_site on site_pages(site_id);
create index if not exists idx_site_pages_topic_key on site_pages(site_id, topic_key);
-- partial index for topic_key not null
create index if not exists idx_pages_topic_key_notnull on site_pages(site_id, topic_key) where topic_key is not null;

-- ====== CONTENT REGISTRY (anti-duplication) ======
create table if not exists content_registry (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  topic_key text not null,
  reference_page_id uuid not null references site_pages(id) on delete restrict,
  primary_intent text not null check (primary_intent in ('informational','comparative','transactional','navigational','support')),
  cluster_id text,
  lock_mode text not null default 'strict' check (lock_mode in ('strict','soft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site_id, topic_key)
);

-- updated_at trigger
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_registry_touch on content_registry;
create trigger trg_registry_touch
before update on content_registry
for each row execute function touch_updated_at();

-- ====== CLUSTER HISTORY (anti-surpublication) ======
create table if not exists cluster_history (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  cluster_id text not null,
  published_count_30d int not null default 0,
  last_published_at timestamptz,
  cap_30d int,
  unique(site_id, cluster_id)
);

-- ====== DRAFTS ======
create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  plan_item_id text,
  title text not null,
  content text not null,
  meta_title text,
  meta_description text,
  slug text,
  primary_intent text not null check (primary_intent in ('informational','comparative','transactional','navigational','support')),
  secondary_intent text check (secondary_intent in ('informational','comparative','transactional','navigational','support')),
  role text not null default 'unknown' check (role in ('pillar','cluster','support','unknown')),
  cluster_id text,
  topic_key text not null,
  generation_version text,
  created_at timestamptz not null default now()
);
create index if not exists idx_drafts_site on drafts(site_id);

-- ====== ATLAS SCORES (versionné, multi-runs allowed) ======
create table if not exists atlas_scores (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references drafts(id) on delete cascade,
  ruleset_version text not null,
  score_total int not null,
  score_a int not null,
  score_b int not null,
  score_c int not null,
  score_d int not null,
  score_e int not null,
  score_f int not null,
  flags jsonb not null default '[]'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  inputs_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_scores_draft_time on atlas_scores(draft_id, created_at desc);
-- optional dedupe (kept as index only, not unique to avoid altering scope)
create index if not exists idx_scores_draft_ruleset_hash on atlas_scores(draft_id, ruleset_version, inputs_hash);

-- ====== EVENTS (append-only) ======
create table if not exists atlas_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  draft_id uuid references drafts(id) on delete set null,
  job_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_site_time on atlas_events(site_id, created_at desc);
create index if not exists idx_events_draft_time on atlas_events(draft_id, created_at desc);
