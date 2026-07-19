-- Seed the honeymoon as trip #1 of the engine (data formerly hardcoded in index.html).
insert into public.trips (id, name, start_date, end_date, origin_name, origin_lat, origin_lng, cap_start, cap_end) values
('11111111-1111-1111-1111-111111111111', 'Honeymoon — Plan A', '2026-12-11', '2026-12-31',
 'SFO', 37.62, -122.38,
 '{"short":"✈️ DEC 11<br>DEPART SFO","label":"Dec 11 — Depart SFO","note":"United · SFO → HKG · 11:15 PM, nonstop 15h 30m"}',
 '{"short":"✈️ DEC 31<br>FLY HOME","label":"Dec 31 — Fly home","note":"United · KIX → SFO · 6:35 PM, lands 11:50 AM"}');

insert into public.legs (trip_id, key, label, color, country, center_lat, center_lng, zoom, sort, is_transit, d1, d2, nights, via) values
('11111111-1111-1111-1111-111111111111','transit','In transit','#6b7280',null,37.6213,-122.379,11,0,true,null,null,null,null),
('11111111-1111-1111-1111-111111111111','hongkong','Hong Kong','#0f766e','China',22.3193,114.1694,12,1,false,13,13,1,'✈️ United — lands 6:45 AM Dec 13'),
('11111111-1111-1111-1111-111111111111','thailand','Koh Samui, Thailand','#c2410c','Thailand',9.512,100.043,11,2,false,14,19,6,'✈️ Bangkok Airways — 5:05 PM → 7:35 PM'),
('11111111-1111-1111-1111-111111111111','tokyo','Tokyo, Japan','#3730a3','Japan',35.6812,139.7671,12,3,false,20,25,6,'✈️ Bangkok Airways PG122 + Thai TG660 — lands 10:05 PM'),
('11111111-1111-1111-1111-111111111111','kyoto','Kyoto, Japan','#9d174d','Japan',35.0116,135.7681,13,4,false,26,30,5,'🚄 Shinkansen — 2:30 PM → 4:44 PM');

insert into public.days (trip_id, date, leg_key, city, ico, nights, move, hotel_key) values
('11111111-1111-1111-1111-111111111111','2026-12-11','transit','Depart SFO','✈️','Evening departure · 11:15 PM','{"mode":"plane","brand":"United","from":"transit","to":"hongkong"}',null),
('11111111-1111-1111-1111-111111111111','2026-12-12','transit','Over the Pacific','🌏','In flight · date line',null,null),
('11111111-1111-1111-1111-111111111111','2026-12-13','hongkong','Hong Kong','🌆','Night 1 of 1 · arrive 6:45 AM',null,null),
('11111111-1111-1111-1111-111111111111','2026-12-14','hongkong','HK → Koh Samui','🏝️','Night 1 of 6 · arrive 7:35 PM','{"mode":"plane","brand":"Bangkok Airways","from":"hongkong","to":"thailand"}','thailand'),
('11111111-1111-1111-1111-111111111111','2026-12-15','thailand','Koh Samui','🏝️','Night 2 of 6',null,null),
('11111111-1111-1111-1111-111111111111','2026-12-16','thailand','Koh Samui','🏝️','Night 3 of 6',null,null),
('11111111-1111-1111-1111-111111111111','2026-12-17','thailand','Koh Samui','🏝️','Night 4 of 6',null,null),
('11111111-1111-1111-1111-111111111111','2026-12-18','thailand','Koh Samui','🏝️','Night 5 of 6',null,null),
('11111111-1111-1111-1111-111111111111','2026-12-19','thailand','Koh Samui','🏝️','Night 6 of 6',null,null),
('11111111-1111-1111-1111-111111111111','2026-12-20','tokyo','Tokyo','🗼','Night 1 of 6','{"mode":"plane","brand":"Bangkok Air → Thai","from":"thailand","to":"tokyo"}',null),
('11111111-1111-1111-1111-111111111111','2026-12-21','tokyo','Tokyo','🗼','Night 2 of 6',null,null),
('11111111-1111-1111-1111-111111111111','2026-12-22','tokyo','Tokyo','🗼','Night 3 of 6',null,null),
('11111111-1111-1111-1111-111111111111','2026-12-23','tokyo','Tokyo','🗼','Night 4 of 6',null,null),
('11111111-1111-1111-1111-111111111111','2026-12-24','tokyo','Tokyo','🎄','Night 5 of 6 · Christmas Eve',null,null),
('11111111-1111-1111-1111-111111111111','2026-12-25','tokyo','Tokyo','🎄','Night 6 of 6 · Christmas Day',null,null),
('11111111-1111-1111-1111-111111111111','2026-12-26','kyoto','Tokyo → Kyoto','🚄','Kyoto · night 1 of 5','{"mode":"train","brand":"Shinkansen","from":"tokyo","to":"kyoto"}',null),
('11111111-1111-1111-1111-111111111111','2026-12-27','kyoto','Kyoto','⛩️','Night 2 of 5',null,null),
('11111111-1111-1111-1111-111111111111','2026-12-28','kyoto','Kyoto','⛩️','Night 3 of 5',null,null),
('11111111-1111-1111-1111-111111111111','2026-12-29','kyoto','Kyoto','⛩️','Night 4 of 5',null,null),
('11111111-1111-1111-1111-111111111111','2026-12-30','kyoto','Kyoto','⛩️','Night 5 of 5 · New Year''s Eve eve',null,null),
('11111111-1111-1111-1111-111111111111','2026-12-31','kyoto','Kyoto → Home','✈️','Half day · fly home','{"mode":"plane","brand":"United","from":"kyoto","to":"transit"}',null);

insert into public.hotels (trip_id, leg_key, name, lat, lng) values
('11111111-1111-1111-1111-111111111111','thailand','Banyan Tree Koh Samui',9.47285,100.06933);

insert into public.travel_segments (trip_id, date, sort, ico, main, sub) values
('11111111-1111-1111-1111-111111111111','2026-12-11',1,'🏠','Home → SFO','~45 min'),
('11111111-1111-1111-1111-111111111111','2026-12-11',2,'🕐','Airport buffer','90 min before departure'),
('11111111-1111-1111-1111-111111111111','2026-12-11',3,'✈️','United · SFO → Hong Kong (HKG)','11:15 PM · nonstop 15h 30m · lands 6:45 AM Dec 13 (+2, date line)'),
('11111111-1111-1111-1111-111111111111','2026-12-11',4,'🚕','HKG → Hong Kong hotel','~40 min'),
('11111111-1111-1111-1111-111111111111','2026-12-14',1,'🏨','Hong Kong hotel → HKG','~40 min'),
('11111111-1111-1111-1111-111111111111','2026-12-14',2,'🕐','Airport buffer','90 min before departure'),
('11111111-1111-1111-1111-111111111111','2026-12-14',3,'✈️','Bangkok Airways · HKG → Koh Samui (USM)','5:05 PM → 7:35 PM · nonstop 3h 30m'),
('11111111-1111-1111-1111-111111111111','2026-12-14',4,'🚕','USM → Banyan Tree','~30 min resort transfer'),
('11111111-1111-1111-1111-111111111111','2026-12-20',1,'🏨','Banyan Tree → Koh Samui (USM)','~30 min'),
('11111111-1111-1111-1111-111111111111','2026-12-20',2,'🕐','Airport buffer','90 min before departure'),
('11111111-1111-1111-1111-111111111111','2026-12-20',3,'✈️','PG122 · Bangkok Airways · USM → Bangkok (BKK)','9:20 AM → 10:35 AM · 1h 15m'),
('11111111-1111-1111-1111-111111111111','2026-12-20',4,'🕐','Layover in Bangkok','3h 50m'),
('11111111-1111-1111-1111-111111111111','2026-12-20',5,'✈️','TG660 · Thai Airways · BKK → Tokyo','2:25 PM → 10:05 PM · ~6h 40m'),
('11111111-1111-1111-1111-111111111111','2026-12-20',6,'🚕','Airport → Tokyo hotel','~45 min'),
('11111111-1111-1111-1111-111111111111','2026-12-26',1,'🏨','Tokyo hotel → Tokyo Station','~20 min'),
('11111111-1111-1111-1111-111111111111','2026-12-26',2,'🕐','Station buffer','30 min before departure'),
('11111111-1111-1111-1111-111111111111','2026-12-26',3,'🚄','Shinkansen · Tokyo → Kyoto','2:30 PM → 4:44 PM · 2h 14m'),
('11111111-1111-1111-1111-111111111111','2026-12-26',4,'🚕','Kyoto Station → hotel','~15 min'),
('11111111-1111-1111-1111-111111111111','2026-12-31',1,'🏨','Kyoto hotel → Osaka Kansai (KIX)','~90 min'),
('11111111-1111-1111-1111-111111111111','2026-12-31',2,'🕐','Airport buffer','90 min before departure'),
('11111111-1111-1111-1111-111111111111','2026-12-31',3,'✈️','United (op. ANA) · KIX → SFO','6:35 PM → 11:50 AM same day · ~10h 15m'),
('11111111-1111-1111-1111-111111111111','2026-12-31',4,'🏠','SFO → home','~45 min');

update public.items set trip_id = '11111111-1111-1111-1111-111111111111' where trip_id is null;
