-- Trip content: activities & restaurants, shared between the two travelers.
-- Auth model: signups disabled; exactly two pre-created users. RLS = any authenticated user.

create table public.items (
  id uuid primary key default gen_random_uuid(),
  leg text not null check (leg in ('transit','hongkong','thailand','tokyo','kyoto')),
  day int check (day between 11 and 30),
  kind text not null check (kind in ('todo','eat')),
  name text not null check (length(name) between 1 and 120),
  note text check (length(note) <= 200),
  ico text check (length(ico) <= 8),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  url text check (url is null or url like 'https://%'),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.items enable row level security;

create policy "read for travelers"   on public.items for select to authenticated using (true);
create policy "insert for travelers" on public.items for insert to authenticated with check (true);
create policy "update for travelers" on public.items for update to authenticated using (true);
create policy "delete for travelers" on public.items for delete to authenticated using (true);
