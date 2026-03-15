-- ============================================================
--  SCHEMA SUPABASE - Torneo Calcio Giovanile
--  Copia e incolla tutto questo nel SQL Editor di Supabase
-- ============================================================

-- Tabella principale torneo
create table if not exists torneo (
  id integer primary key default 1,
  nome text default 'Torneo Calcio Giovanile',
  data text default ''
);
insert into torneo (id, nome, data) values (1, 'Torneo Calcio Giovanile', '') on conflict (id) do nothing;

-- Categorie (Under 10, Under 12, ecc.)
create table if not exists categorie (
  id bigint generated always as identity primary key,
  nome text not null,
  qualificate integer default 2,
  formato text default 'semi',
  ordine integer default 0
);

-- Squadre (globali, riusabili tra categorie)
create table if not exists squadre (
  id bigint generated always as identity primary key,
  nome text not null unique,
  logo text
);

-- Gironi
create table if not exists gironi (
  id bigint generated always as identity primary key,
  categoria_id bigint references categorie(id) on delete cascade,
  nome text not null
);

-- Appartenenza squadra-girone
create table if not exists girone_squadre (
  id bigint generated always as identity primary key,
  girone_id bigint references gironi(id) on delete cascade,
  squadra_id bigint references squadre(id) on delete cascade,
  posizione integer default 0,
  unique(girone_id, squadra_id)
);

-- Partite gironi
create table if not exists partite (
  id bigint generated always as identity primary key,
  girone_id bigint references gironi(id) on delete cascade,
  home_id bigint references squadre(id),
  away_id bigint references squadre(id),
  gol_home integer default 0,
  gol_away integer default 0,
  giocata boolean default false,
  created_at timestamptz default now()
);

-- Marcatori partite gironi
create table if not exists marcatori (
  id bigint generated always as identity primary key,
  partita_id bigint references partite(id) on delete cascade,
  squadra_id bigint references squadre(id),
  nome text not null,
  minuto text
);

-- Partite fase finale (knockout)
create table if not exists knockout (
  id bigint generated always as identity primary key,
  categoria_id bigint references categorie(id) on delete cascade,
  round_name text not null,
  round_order integer default 0,
  match_order integer default 0,
  home_id bigint references squadre(id),
  away_id bigint references squadre(id),
  gol_home integer default 0,
  gol_away integer default 0,
  giocata boolean default false
);

-- ============================================================
--  POLICY DI ACCESSO (Row Level Security)
--  Lettura pubblica per tutti, scrittura solo con anon key
-- ============================================================
alter table torneo enable row level security;
alter table categorie enable row level security;
alter table squadre enable row level security;
alter table gironi enable row level security;
alter table girone_squadre enable row level security;
alter table partite enable row level security;
alter table marcatori enable row level security;
alter table knockout enable row level security;

-- Tutti possono leggere
create policy "lettura pubblica" on torneo for select using (true);
create policy "lettura pubblica" on categorie for select using (true);
create policy "lettura pubblica" on squadre for select using (true);
create policy "lettura pubblica" on gironi for select using (true);
create policy "lettura pubblica" on girone_squadre for select using (true);
create policy "lettura pubblica" on partite for select using (true);
create policy "lettura pubblica" on marcatori for select using (true);
create policy "lettura pubblica" on knockout for select using (true);

-- Tutti possono scrivere (la password admin è nel sito)
create policy "scrittura pubblica" on torneo for all using (true) with check (true);
create policy "scrittura pubblica" on categorie for all using (true) with check (true);
create policy "scrittura pubblica" on squadre for all using (true) with check (true);
create policy "scrittura pubblica" on gironi for all using (true) with check (true);
create policy "scrittura pubblica" on girone_squadre for all using (true) with check (true);
create policy "scrittura pubblica" on partite for all using (true) with check (true);
create policy "scrittura pubblica" on marcatori for all using (true) with check (true);
create policy "scrittura pubblica" on knockout for all using (true) with check (true);

-- Abilita realtime per aggiornamenti live
alter publication supabase_realtime add table partite;
alter publication supabase_realtime add table knockout;
alter publication supabase_realtime add table marcatori;
