-- Expense tracker joins the engine: shared ledger, assistant-writable.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  "desc" text not null default '',
  cat text not null default 'Other' check (cat in ('Flights','Lodging','Activities','Food','Transport','Other')),
  cash numeric not null default 0 check (cash >= 0),
  points numeric not null default 0 check (points >= 0),
  prog text not null default '',
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;
create policy "read for travelers"  on public.expenses for select to authenticated using (true);
create policy "write for travelers" on public.expenses for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.expenses;

-- migrate the seed ledger (was localStorage-only)
insert into public.expenses (trip_id, "desc", cat, cash, points, prog) values
('11111111-1111-1111-1111-111111111111','United open-jaw ×2 — SFO→HKG (Dec 11) + KIX→SFO (Dec 31), $1,999 each','Flights',3998,0,''),
('11111111-1111-1111-1111-111111111111','Banyan Tree Koh Samui — Ocean View Pool Villa, 6 nights (extend booking!)','Lodging',0,330527,'Chase UR'),
('11111111-1111-1111-1111-111111111111','Bangkok Airways ×2 — Hong Kong → Koh Samui (Dec 14), $312 each','Flights',624,0,''),
('11111111-1111-1111-1111-111111111111','PG122 + TG660 ×2 — Koh Samui → Bangkok → Tokyo (Dec 20), $477 each','Flights',954,0,''),
('11111111-1111-1111-1111-111111111111','Shinkansen ×2 — Tokyo → Kyoto (Dec 26), $83 each','Transport',166,0,'');
