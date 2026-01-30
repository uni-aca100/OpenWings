-- PostgreSQL database initialization script

/*
  database about Ornithology and birdwatching activity
  the database use the Data Source: wiki.
  using GeoJSON for storing geographical data from eBird.
  PostGIS extension is used for spatial data support.  
*/

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  email TEXT NOT NULL,
  UNIQUE(email),
  UNIQUE(username)
);

-- table sessions, storing user sessions
-- relationship: many-to-one with users table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  expires_at TIMESTAMP
);

-- table species, storing bird species information
CREATE TABLE species (
  scientific_name TEXT PRIMARY KEY,
  common_name TEXT NOT NULL,
  family TEXT NOT NULL,
  order_name TEXT NOT NULL,
  diet TEXT,
  conservation_status TEXT CHECK(conservation_status IN (
    'Least Concern', 'Near Threatened', 'Vulnerable', 'Endangered', 'Critically Endangered')
  ) -- information from IUCN Red List (wiki)
);

-- table species_range, storing geographical range of bird species
-- range data come from eBird
-- relationship: many-to-one with species table
CREATE TABLE species_range (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  species_scientific_name TEXT REFERENCES species(scientific_name),
  season TEXT, -- breeding, nonbreeding, year-round, 
  geom GEOMETRY(MULTIPOLYGON, 4326)
);

-- table media, storing media related to bird species
-- relationship: many-to-one with species table
CREATE TABLE media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  species_scientific_name TEXT REFERENCES species(scientific_name),
  media_type TEXT CHECK (media_type IN ('image', 'video', 'audio')),
  url TEXT NOT NULL, -- link is relative to to the root project path
  license TEXT,
  contributor TEXT
);

/* table challenge, storing user-submitted challenges.
A small amount of user can submit challenges, forming a championship.
the goal is to spot as many species as possible within a time frame.
*/
CREATE TABLE challenge (
  name TEXT NOT NULL PRIMARY KEY,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  -- additional rules about the point system used related to species spotted conservation status
  lc_points DECIMAL(5, 2) DEFAULT 1, -- least concern
  nt_points DECIMAL(5, 2) DEFAULT 2, -- near threatened
  vu_points DECIMAL(5, 2) DEFAULT 5, -- vulnerable
  en_points DECIMAL(5, 2) DEFAULT 6, -- endangered
  cr_points DECIMAL(5, 2) DEFAULT 8  -- critically endangered
);

-- association table between challenge and users many-to-many relationship
CREATE TABLE challenge_participants (
  challenge_name TEXT REFERENCES challenge(name),
  user_id UUID REFERENCES users(id),
  PRIMARY KEY (challenge_name, user_id)
);

/* table Observations storing birdwatching observations made by users. */
-- relationship: many-to-one with users and species table
CREATE TABLE observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  species_scientific_name TEXT REFERENCES species(scientific_name),
  location GEOMETRY(POINT, 4326),
  observed_at TIMESTAMP NOT NULL,
  approved BOOLEAN DEFAULT FALSE
);


/*
  query to count the points of a user in a specific challenge
  points are calculated based on the conservation status of the species spotted
  and the point system defined in the challenge table
  only approved observations within the challenge time frame are considered
  we need to include all the user that are participating in the challenge even if they have 0 points
  that means there are no approved observations within the challenge time frame
 */
CREATE OR REPLACE VIEW user_challenge_points AS
SELECT
  cp.challenge_name,
  u.id AS user_id,
  u.username,
  COALESCE(SUM( -- SUM ignores NULLs skipping them, If every term is NULL the aggregate returns NULL
    CASE s.conservation_status
      WHEN 'Least Concern' THEN c.lc_points -- c can be NULL if there are no approved observations in the challenge time frame
      WHEN 'Near Threatened' THEN c.nt_points
      WHEN 'Vulnerable' THEN c.vu_points
      WHEN 'Endangered' THEN c.en_points
      WHEN 'Critically Endangered' THEN c.cr_points
      ELSE 0
    END
  ), 0) AS total_points,
  COALESCE(SUM(
    CASE WHEN s.conservation_status = 'Least Concern' THEN c.lc_points ELSE 0 END
  ), 0) AS lc_score,
  COALESCE(SUM(
    CASE WHEN s.conservation_status = 'Near Threatened' THEN c.nt_points ELSE 0 END
  ), 0) AS nt_score,
  COALESCE(SUM(
    CASE WHEN s.conservation_status = 'Vulnerable' THEN c.vu_points ELSE 0 END
  ), 0) AS vu_score,
  COALESCE(SUM(
    CASE WHEN s.conservation_status = 'Endangered' THEN c.en_points ELSE 0 END
  ), 0) AS en_score,
  COALESCE(SUM(
    CASE WHEN s.conservation_status = 'Critically Endangered' THEN c.cr_points ELSE 0 END
  ), 0) AS cr_score
FROM
  challenge_participants cp
JOIN users u ON cp.user_id = u.id
LEFT JOIN observations o ON o.user_id = u.id
LEFT JOIN species s ON o.species_scientific_name = s.scientific_name
LEFT JOIN challenge c ON cp.challenge_name = c.name
  -- make sure c points columns are NULL when the observation is not approved or is not in the challenge time frame
  AND o.approved = TRUE
  AND o.observed_at BETWEEN c.start_date AND c.end_date
GROUP BY
  cp.challenge_name, u.id, u.username;


-- Sample data for species table
INSERT INTO species (scientific_name, common_name, family, order_name, diet, conservation_status) VALUES
('Anas acuta', 'Northern Pintail', 'Anatidae', 'Anseriformes', 'Herbivore', 'Least Concern');
INSERT INTO species (scientific_name, common_name, family, order_name, diet, conservation_status) VALUES
('Erithacus rubecula', 'European Robin', 'Muscicapidae', 'Passeriformes', 'Omnivore', 'Least Concern');
INSERT INTO species (scientific_name, common_name, family, order_name, diet, conservation_status) VALUES
('Streptopelia turtur', 'European Turtle Dove', 'Columbidae', 'Columbiformes', 'Granivore', 'Vulnerable');
INSERT INTO species (scientific_name, common_name, family, order_name, diet, conservation_status) VALUES
('Coracias garrulus', 'European Roller', 'Coraciidae', 'Coraciiformes', 'Carnivore', 'Near Threatened');

-- Sample data for media table
INSERT INTO media (species_scientific_name, media_type, url, license, contributor) VALUES
('Anas acuta', 'image', 'static/images/northern_pintail_1.jpg', 'CC BY-SA 4.0', 'pmnh.org'),
('Anas acuta', 'image', 'static/images/northern_pintail_2.jpg', 'CC BY-SA 4.0', 'flickr.com'),
('Anas acuta', 'image', 'static/images/northern_pintail_3.jpg', 'CC BY-SA 4.0', 'carolinabirdclub.org'),
('Anas acuta', 'image', 'static/images/northern_pintail_4.jpg', 'CC BY-SA 4.0', 'flickr.com'),
('Coracias garrulus', 'image', 'static/images/european_roller_1.jpg', 'CC BY-SA 4.0', 'flickr.com'),
('Coracias garrulus', 'image', 'static/images/european_roller_2.jpg', 'CC BY-SA 4.0', 'flickr.com'),
('Coracias garrulus', 'image', 'static/images/european_roller_3.jpg', 'CC BY-SA 4.0', 'flickr.com'),
('Coracias garrulus', 'image', 'static/images/european_roller_4.jpg', 'CC BY-SA 4.0', 'flickr.com');