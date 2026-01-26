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
  querySpecies,
};

// get species range as GeoJSON features array, filtered by scientific name (or common name) and season
async function queryGeoJSONSpecies(scientificName, season) {
  if (!scientificName || !season) {
    console.error('Both scientificName and season parameters are required');
    return [];  // Return an empty array if parameters are missing
  }

  const sql = `
    SELECT ST_AsGeoJSON(geom) AS geojson, species_scientific_name, season
    FROM species_range
    JOIN species s ON species_scientific_name = s.scientific_name
    WHERE (LOWER(species_scientific_name) LIKE $1 OR LOWER(s.common_name) LIKE $1) AND LOWER(season) = $2
  `;
  const result = await pool.query(sql, [`%${scientificName.toLowerCase()}%`, season.toLowerCase()]);

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
  if (!speciesId) {
    console.error('speciesId parameter is required');
    return [];
  }

  const sql = `
    SELECT url, media_type, license, contributor
    FROM media
    WHERE LOWER(species_scientific_name) LIKE $1
  `;
  const result = await pool.query(sql, [`%${speciesId.toLowerCase()}%`]);
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

/* Get species information as object by scientific or common name */
async function querySpecies(speciesId) {
  if (!speciesId) {
    console.error('speciesId parameter is required');
    return null;
  }
  const sql = `
    SELECT * FROM species
    WHERE  LOWER(scientific_name) LIKE $1 or LOWER(common_name) LIKE $1
  `;
  const result = await pool.query(sql, [`%${speciesId.toLowerCase()}%`]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    scientific_name: row.scientific_name,
    common_name: row.common_name,
    family: row.family,
    order_name: row.order_name,
    diet: row.diet,
    conservation_status: row.conservation_status,
  };
}


/* get all challenges where the given user is a participant, and the challenge is active */
async function getUserActiveChallenges(userId) {
  if (!userId) {
    console.error('userId parameter is required');
    return [];
  }
  const sql = `
    SELECT c.*
    FROM challenge c
    JOIN challenge_participants cp ON c.id = cp.challenge_id
    WHERE LOWER(cp.user_id) = $1 AND c.end_date > NOW() AND c.start_date <= NOW()
  `;
  const result = await pool.query(sql, [userId.toLowerCase()]);
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