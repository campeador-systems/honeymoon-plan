-- One-time seed: migrate the two activities that lived in the HTML into the DB.
insert into public.items (leg, day, kind, name, note, ico, lat, lng, url) values
('thailand', 16, 'todo', 'Samui Elephant Sanctuary — Morning Elephant Tour',
 '9:00 AM · Chaweng Noi · 2 adults', '🐘', 9.5043, 100.0531,
 'https://share.google/tvKi7se1D8IRbeXno'),
('thailand', 17, 'todo', 'Koh Tao diving day trip — Silent Divers',
 'Pickup 7:45 AM · boat to Koh Tao · 2 dives, lunch on board · back ~4 PM', '🤿', 10.0922, 99.8395,
 'https://silentdivers.com/trips/dive-tour-koh-tao/');
