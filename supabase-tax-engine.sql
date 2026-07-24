-- Tax Engine Supabase v1 sync schema.
-- Run this in the Supabase SQL editor for the tax-engine project.
-- Project URL: https://ixhxsylbdscfapmsjhlb.supabase.co

create table if not exists tax_engine_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  record_key text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, record_key)
);

create index if not exists tax_engine_records_user_updated_idx
  on tax_engine_records (user_id, updated_at desc);

create or replace function set_tax_engine_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tax_engine_records_updated_at on tax_engine_records;
create trigger tax_engine_records_updated_at
before update on tax_engine_records
for each row execute function set_tax_engine_updated_at();

alter table tax_engine_records enable row level security;

drop policy if exists "tax engine read own records" on tax_engine_records;
drop policy if exists "tax engine insert own records" on tax_engine_records;
drop policy if exists "tax engine update own records" on tax_engine_records;
drop policy if exists "tax engine delete own records" on tax_engine_records;

create policy "tax engine read own records"
  on tax_engine_records for select
  using (auth.uid() = user_id);

create policy "tax engine insert own records"
  on tax_engine_records for insert
  with check (auth.uid() = user_id);

create policy "tax engine update own records"
  on tax_engine_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tax engine delete own records"
  on tax_engine_records for delete
  using (auth.uid() = user_id);
