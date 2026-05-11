-- Destructive reset for the Uber Property app objects.
-- Run this only when you are happy to wipe existing app data in this Supabase project.
drop policy if exists "authenticated upload receipts" on storage.objects;
drop policy if exists "authenticated update receipts" on storage.objects;
drop policy if exists "public read receipts" on storage.objects;

delete from storage.objects where bucket_id = 'receipts';
delete from storage.buckets where id = 'receipts';

drop table if exists certificates cascade;
drop table if exists rent_due cascade;
drop table if exists income cascade;
drop table if exists expenses cascade;
drop table if exists recurring_transactions cascade;
drop table if exists properties cascade;

create table if not exists properties (
  id uuid primary key,
  property_name text not null,
  address text,
  tenant_name text,
  tenant_phone text,
  tenant_email text,
  tenancy_start_date date,
  monthly_rent numeric(12,2) default 0,
  deposit_amount numeric(12,2) default 0,
  deposit_scheme text,
  mortgage_interest_monthly numeric(12,2) default 0,
  insurance_monthly numeric(12,2) default 0,
  management_fee_percentage numeric(5,2) default 0,
  status text check (status in ('tenanted', 'vacant')) default 'tenanted',
  notes text,
  created_at timestamptz default now()
);

create table if not exists recurring_transactions (
  id uuid primary key,
  property_id uuid references properties(id) on delete cascade,
  category text not null,
  description text,
  amount numeric(12,2) not null,
  frequency text check (frequency in ('monthly', 'yearly')) default 'monthly',
  start_date date not null,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists expenses (
  id uuid primary key,
  property_id uuid references properties(id) on delete cascade,
  expense_date date not null,
  category text not null,
  amount numeric(12,2) not null,
  supplier text,
  notes text,
  receipt_url text,
  created_at timestamptz default now()
);

create table if not exists income (
  id uuid primary key,
  property_id uuid references properties(id) on delete cascade,
  date_received date not null,
  rent_period text,
  rent_due_date date,
  amount numeric(12,2) not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists rent_due (
  id uuid primary key,
  property_id uuid references properties(id) on delete cascade,
  due_date date not null,
  period text not null,
  amount numeric(12,2) not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists certificates (
  id uuid primary key,
  property_id uuid references properties(id) on delete cascade,
  certificate_type text not null,
  issue_date date,
  expiry_date date not null,
  reminder_date date,
  notes text,
  document_url text,
  created_at timestamptz default now()
);

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

alter table properties enable row level security;
alter table recurring_transactions enable row level security;
alter table expenses enable row level security;
alter table income enable row level security;
alter table rent_due enable row level security;
alter table certificates enable row level security;

-- Review these authenticated single-user draft policies before production use.
create policy "authenticated read properties" on properties for select using (auth.role() = 'authenticated');
create policy "authenticated write properties" on properties for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read recurring" on recurring_transactions for select using (auth.role() = 'authenticated');
create policy "authenticated write recurring" on recurring_transactions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read expenses" on expenses for select using (auth.role() = 'authenticated');
create policy "authenticated write expenses" on expenses for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read income" on income for select using (auth.role() = 'authenticated');
create policy "authenticated write income" on income for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read rent due" on rent_due for select using (auth.role() = 'authenticated');
create policy "authenticated write rent due" on rent_due for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read certificates" on certificates for select using (auth.role() = 'authenticated');
create policy "authenticated write certificates" on certificates for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated upload receipts" on storage.objects
  for insert with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

create policy "authenticated update receipts" on storage.objects
  for update using (bucket_id = 'receipts' and auth.role() = 'authenticated')
  with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

create policy "public read receipts" on storage.objects
  for select using (bucket_id = 'receipts');
