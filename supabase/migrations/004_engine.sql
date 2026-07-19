-- Engine-ification: trip structure becomes data. The HTML becomes a renderer.

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  origin_name text,          -- e.g. 'SFO' (route-map endpoint)
  origin_lat double precision,
  origin_lng double precision,
  cap_start jsonb,           -- ribbon end-caps {short,label,note}
  cap_end jsonb,
  created_at timestamptz not null default now()
);

create table public.legs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  key text not null,         -- stable slug used across tables ('thailand', 'tokyo'...)
  label text not null,       -- 'Koh Samui, Thailand'
  color text not null,
  country text,
  center_lat double precision not null,
  center_lng double precision not null,
  zoom int not null default 12,
  sort int not null,
  is_transit boolean not null default false,
  d1 int, d2 int, nights int, via text,   -- ribbon segment data (null for transit legs)
  unique (trip_id, key)
);

create table public.days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  date date not null,
  leg_key text not null,
  city text not null,
  ico text not null,
  nights text not null,      -- display label ('Night 2 of 6')
  move jsonb,                -- travel days: {mode,brand,from,to}
  hotel_key text,            -- override: which leg's hotel you sleep at (e.g. arrival day)
  unique (trip_id, date)
);

create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  leg_key text not null,
  name text not null,
  lat double precision,
  lng double precision,
  url text check (url is null or url like 'https://%'),
  unique (trip_id, leg_key)
);

create table public.travel_segments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  date date not null,
  sort int not null,
  ico text not null,
  main text not null,
  sub text not null
);

-- items joins the engine: belongs to a trip; leg/day validated in the assistant fn now
alter table public.items add column trip_id uuid references public.trips(id) on delete cascade;
alter table public.items drop constraint if exists items_leg_check;
alter table public.items drop constraint if exists items_day_check;

-- RLS: same model everywhere — the two authenticated travelers
alter table public.trips enable row level security;
alter table public.legs enable row level security;
alter table public.days enable row level security;
alter table public.hotels enable row level security;
alter table public.travel_segments enable row level security;

do $$ declare t text;
begin
  foreach t in array array['trips','legs','days','hotels','travel_segments'] loop
    execute format('create policy "read for travelers" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "write for travelers" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- realtime for hotel changes (items already published in 003)
alter publication supabase_realtime add table public.hotels;
