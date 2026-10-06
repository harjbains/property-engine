-- Wealth Engine Supabase v1 sync schema.
-- Run this in the Supabase SQL editor for the wealth-engine project.
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

drop policy if exists "Wealth Engine read own records" on tax_engine_records;
drop policy if exists "Wealth Engine insert own records" on tax_engine_records;
drop policy if exists "Wealth Engine update own records" on tax_engine_records;
drop policy if exists "Wealth Engine delete own records" on tax_engine_records;

create policy "Wealth Engine read own records"
  on tax_engine_records for select
  using (auth.uid() = user_id);

create policy "Wealth Engine insert own records"
  on tax_engine_records for insert
  with check (auth.uid() = user_id);

create policy "Wealth Engine update own records"
  on tax_engine_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Wealth Engine delete own records"
  on tax_engine_records for delete
  using (auth.uid() = user_id);

-- Wealth Engine Revisions
CREATE TABLE IF NOT EXISTS public.wealth_engine_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    record_key TEXT NOT NULL,
    version BIGINT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.wealth_engine_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own revisions" 
    ON public.wealth_engine_revisions 
    FOR ALL 
    USING (auth.uid() = owner_id);

-- Trigger function to automatically create a revision and prune old ones
CREATE OR REPLACE FUNCTION save_wealth_engine_revision()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert the new revision (using epoch timestamp as a monotonic version if not present in payload)
    INSERT INTO public.wealth_engine_revisions (owner_id, record_key, version, payload)
    VALUES (NEW.owner_id, NEW.record_key, COALESCE((NEW.payload->>'version')::bigint, extract(epoch from now())::bigint), NEW.payload);

    -- Keep only the latest 200 revisions for this user and record_key
    DELETE FROM public.wealth_engine_revisions
    WHERE id IN (
        SELECT id FROM (
            SELECT id, row_number() OVER (PARTITION BY owner_id, record_key ORDER BY created_at DESC) as rn
            FROM public.wealth_engine_revisions
            WHERE owner_id = NEW.owner_id AND record_key = NEW.record_key
        ) sub
        WHERE rn > 200
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the trigger
DROP TRIGGER IF EXISTS trigger_wealth_engine_revision ON public.tax_engine_records;
CREATE TRIGGER trigger_wealth_engine_revision
    AFTER INSERT OR UPDATE ON public.tax_engine_records
    FOR EACH ROW
    EXECUTE FUNCTION save_wealth_engine_revision();
