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
  email TEXT NOT NULL
);

-- table species, storing bird species information
CREATE TABLE species (
  scientific_name TEXT PRIMARY KEY,
  common_name TEXT NOT NULL,
  family TEXT NOT NULL,
  order_name TEXT NOT NULL,
  diet TEXT,
  conservation_status TEXT -- information from IUCN Red List (wiki)
);

-- table species_range, storing geographical range of bird species
-- range data come from eBird
-- relationship: many-to-one with species table
CREATE TABLE species_range (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  species_scientific_name TEXT REFERENCES species(scientific_name),
  season TEXT, -- breeding, nonbreeding, year-round, 
  geom GEOMETRY(MULTIPOLYGON, 4326) -- GeoJSON format
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
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
  challenge_id UUID REFERENCES challenge(id),
  user_id UUID REFERENCES users(id),
  PRIMARY KEY (challenge_id, user_id)
);

/* table Observations storing birdwatching observations made by users. */
-- relationship: many-to-one with users and species table
CREATE TABLE observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  species_scientific_name TEXT REFERENCES species(scientific_name),
  location GEOMETRY(POINT, 4326),
  observed_at TIMESTAMP NOT NULL
);

INSERT INTO users (username, password, email) VALUES
('testuser', 'password123', 'testuser@example.com');

-- Sample data for species table
INSERT INTO species (scientific_name, common_name, family, order_name, diet, conservation_status) VALUES
('Anas acuta', 'Northern Pintail', 'Anatidae', 'Anseriformes', 'Herbivore', 'Least Concern');