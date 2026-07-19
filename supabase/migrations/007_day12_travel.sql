-- Dec 12 (in-flight date-line day) is a travel day too: gets the split-color
-- treatment and the SFO→Hong Kong arc on its map, same as Dec 11.
update public.days
set move = '{"mode":"plane","brand":"United","from":"transit","to":"hongkong"}'
where trip_id = '11111111-1111-1111-1111-111111111111' and date = '2026-12-12';
