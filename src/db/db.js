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
};

async function queryGeoJSONSpecies(scientificName) {
  const sql = `
    SELECT ST_AsGeoJSON(geom) AS geojson, species_scientific_name, season
    FROM species_range
    WHERE species_scientific_name = $1
  `;
  const result = await pool.query(sql, [scientificName]);

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