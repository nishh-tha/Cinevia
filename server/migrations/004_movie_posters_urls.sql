-- 004: support actual movie poster image URLs.
ALTER TABLE rs_movies
  ADD COLUMN poster_url TEXT NULL;

-- Assign each movie its Cloudinary poster.
UPDATE rs_movies
SET poster_url = 'https://res.cloudinary.com/lcqdtxt5/image/upload/v1793439520/Midnight_Harbour.png'
WHERE title = 'Midnight Harbour';

UPDATE rs_movies
SET poster_url = 'https://res.cloudinary.com/lcqdtxt5/image/upload/v1793439520/Paper_Monsoon.png'
WHERE title = 'Paper Monsoon';

UPDATE rs_movies
SET poster_url = 'https://res.cloudinary.com/lcqdtxt5/image/upload/v1793439520/Iron_Orchard.png'
WHERE title = 'Iron Orchard';

UPDATE rs_movies
SET poster_url = 'https://res.cloudinary.com/lcqdtxt5/image/upload/v1793439520/The_Last_Cartographer.png'
WHERE title = 'The Last Cartographer';

UPDATE rs_movies
SET poster_url = 'https://res.cloudinary.com/lcqdtxt5/image/upload/v1793439520/Static.png'
WHERE title = 'Static';

UPDATE rs_movies
SET poster_url = 'https://res.cloudinary.com/lcqdtxt5/image/upload/v1793439520/Saffron_Road.png'
WHERE title = 'Saffron Road';