-- Enable realtime change broadcasts for trip items (dashboard live-refresh).
alter publication supabase_realtime add table public.items;
