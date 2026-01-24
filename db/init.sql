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
  url TEXT NOT NULL,
  description TEXT,
  license TEXT,
  contributor TEXT
);


INSERT INTO users (username, password, email) VALUES
('testuser', 'password123', 'testuser@example.com');

-- Sample data for species table
INSERT INTO species (scientific_name, common_name, family, order_name, diet, conservation_status) VALUES
('Anas acuta', 'Northern Pintail', 'Anatidae', 'Anseriformes', 'Herbivore', 'Least Concern');