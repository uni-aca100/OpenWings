const { Pool } = require('pg');

// use the environment variables for database connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

module.exports = {
  query: (sql, params) => pool.query(sql, params),
  queryGeoJSONSpecies,
  querySpeciesMedia,
};

async function queryGeoJSONSpecies(scientificName, season) {
  const sql = `
    SELECT ST_AsGeoJSON(geom) AS geojson, species_scientific_name, season
    FROM species_range
    WHERE species_scientific_name = $1 AND season = $2
  `;
  const result = await pool.query(sql, [scientificName, season]);

  // Convert each row to a GeoJSON Feature
  return result.rows.map(row => ({
    type: 'Feature',
    properties: {
      species_scientific_name: row.species_scientific_name,
      season: row.season,
    },
    geometry: JSON.parse(row.geojson),
  }));
}

// get media information related to a species as a JSON array
async function querySpeciesMedia(speciesId) {
  const sql = `
    SELECT url, media_type, license, contributor
    FROM media
    WHERE species_scientific_name = $1
  `;
  const result = await pool.query(sql, [speciesId]);
  // convert to json array
  return result.rows.map(row => ({
    // generate a complete URL for the media,
    // hardcode the base URL (in production, use environment variable)
    media_url: `localhost:3000/${row.url}`,
    media_type: row.media_type,
    license: row.license,
    contributor: row.contributor,
  }));
}

/* Get species information */
async function querySpecies(speciesId) {
  const sql = `
    SELECT * FROM species
    WHERE scientific_name = $1
  `;
  const result = await pool.query(sql, [speciesId]);
  // convert to json
  return result.rows[0].map(row => ({
    scientific_name: row.scientific_name,
    common_name: row.common_name,
    family: row.family,
    order_name: row.order_name,
    diet: row.diet,
    conservation_status: row.conservation_status,
  }));
}


/* table challenge, storing user-submitted challenges.
A small amount of user can submit challenges, forming a championship.
the goal is to spot as many species as possible within a time frame.
*/
/* CREATE TABLE challenge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  -- additional rules about the point system used related to species spotted conservation status
  lc_points DECIMAL(5, 2) DEFAULT 1, -- least concern
  nt_points DECIMAL(5, 2) DEFAULT 2, -- near threatened
  vu_points DECIMAL(5, 2) DEFAULT 5, -- vulnerable
  en_points DECIMAL(5, 2) DEFAULT 6, -- endangered
  cr_points DECIMAL(5, 2) DEFAULT 8  -- critically endangered
); */

/* -- association table between challenge and users many-to-many relationship
CREATE TABLE challenge_participants (
  challenge_id UUID REFERENCES challenge(id),
  user_id UUID REFERENCES users(id),
  PRIMARY KEY (challenge_id, user_id)
); */

/* get all challenges where the given user is a participant, and the challenge is active */
async function getUserActiveChallenges(userId) {
  const sql = `
    SELECT c.*
    FROM challenge c
    JOIN challenge_participants cp ON c.id = cp.challenge_id
    WHERE cp.user_id = $1 AND c.end_date > NOW() AND c.start_date <= NOW()
  `;
  const result = await pool.query(sql, [userId]);
  return result.rows;
}

/*
TODO
  get all the information about a specific challenge as a JSON object including:
  {
    id: // challenge.id,
    start_date,
    end_date,
    lc_points,
    nt_points,
    vu_points,
    en_points,
    cr_points,
    participants: {
      username: {
        username,
        score,
      }
    }
  }
*/