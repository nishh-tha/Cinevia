-- 003: columns needed by the movie pages and booking totals.
-- rating (existing) stays the age certificate (U / UA / A); score is the 0-10 audience score.
ALTER TABLE rs_movies
  ADD COLUMN genres VARCHAR(200) NULL,
  ADD COLUMN synopsis TEXT NULL,
  ADD COLUMN cast_list VARCHAR(500) NULL,
  ADD COLUMN color CHAR(7) NOT NULL DEFAULT '#7a1e1e',
  ADD COLUMN trailer_url VARCHAR(255) NULL,
  ADD COLUMN score DECIMAL(3,1) NOT NULL DEFAULT 0.0,
  ADD COLUMN release_status ENUM('NOW','SOON') NOT NULL DEFAULT 'NOW',
  ADD COLUMN release_date DATE NULL;

ALTER TABLE rs_bookings
  ADD COLUMN fee_paise INT NOT NULL DEFAULT 0,
  ADD COLUMN cancelled_at DATETIME NULL;
