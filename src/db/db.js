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
  querySpecies,
  getUserObservations,
  getUserById,
  insertUserObservation,
  insertChallenge,
  addUserToChallenge,
  inviteUserToChallenge,
  getUserChallengesWithParticipants,
  getSpeciesImages,
  getSpeciesBatch
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

// get all observations made by a specific user
async function getUserObservations(userId) {
  if (!userId) {
    console.error('userId parameter is required');
    return [];
  }
  const sql = `
    SELECT species_scientific_name, observed_at, ST_AsGeoJSON(location)::json AS location, approved
    FROM observations
    WHERE user_id = $1
  `;
  try {
    const result = await pool.query(sql, [userId]);
    return result.rows.map(row => ({
      type: 'Feature',
      properties: {
        speciesName: row.species_scientific_name,
        observedAt: row.observed_at,
        approved: row.approved,
      },
      geometry: {
        type: 'Point',
        coordinates: row.location.coordinates,
      },
    }));
  } catch (error) {
    console.error('Error fetching user observations:', error);
    return [];
  }
}

// get user information by userId return (username and email)
async function getUserById(userId) {
  if (!userId) {
    console.error('userId parameter is required');
    return null;
  }
  const sql = `
    SELECT * FROM users
    WHERE id = $1
  `;
  const result = await pool.query(sql, [userId]);
  if (result.rows[0]) {
    return {
      username: result.rows[0].username,
      email: result.rows[0].email,
    };
  }
  return null;
}

// get userId by username
async function getUserIdByUsername(username) {
  if (!username) {
    console.error('username parameter is required');
    return null;
  }
  const sql = `
    SELECT id FROM users
    WHERE LOWER(username) = $1
  `;
  const result = await pool.query(sql, [username.toLowerCase()]);
  if (result.rows[0]) {
    return result.rows[0].id;
  }
  return null;
}

// insert user observation into the database
async function insertUserObservation(userId, speciesScientificName, latitude, longitude, observedAt) {
  if (!userId || !speciesScientificName || !latitude || !longitude || !observedAt) {
    console.error('All parameters are required');
    return false;
  }
  const sql = `
    INSERT INTO observations (user_id, species_scientific_name, location, observed_at)
    VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5)
  `;
  try {
    const rst = await pool.query(sql, [userId, speciesScientificName, longitude, latitude, observedAt]);
    return rst.rowCount > 0;
  } catch (error) {
    console.error('Error inserting user observation:', error);
    return false;
  }
}

/*
 insert a new challenge into the database, and add the user creating it as participant
 points is an object with the following structure:
 {
   lc: number, conservation status points for least concern species
   nt: number,
   vu: number,
   en: number,
   cr: number
 }
 */
async function insertChallenge(name, startDate, endDate, userId, points) {
  if (!name || !startDate || !endDate || !userId || !points) {
    console.error('All parameters are required');
    return false;
  }
  const sql = `
    INSERT INTO challenge (name, start_date, end_date, lc_points, nt_points, vu_points, en_points, cr_points)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;
  try {
    const rst = await pool.query(sql, [name, startDate, endDate, points.lc, points.nt, points.vu, points.en, points.cr]);
    let success = false;
    if (rst.rowCount > 0) {
      // Add the user as a participant in the challenge
      success = await addUserToChallenge(name, userId);
    }
    return success;
  } catch (error) {
    console.error('Error inserting challenge:', error);
    return false;
  }
}

// add a user as participant to a challenge by challenge name
async function addUserToChallenge(challengeName, userId) {
  if (!challengeName || !userId) {
    console.error('Both challengeName and userId parameters are required');
    return false;
  }
  const sql = `
    INSERT INTO challenge_participants (challenge_name, user_id)
    VALUES ($1, $2)
  `;
  try {
    const rst = await pool.query(sql, [challengeName, userId]);
    return rst.rowCount > 0;
  } catch (error) {
    console.error('Error adding user to challenge:', error);
    return false;
  }
}

// invite a user to a challenge by challengeId, userId of the inviter, and inviteeUsername
async function inviteUserToChallenge(challengeName, userId, inviteeUsername) {
  if (!challengeName || !userId || !inviteeUsername) {
    console.error('All parameters are required');
    return false;
  }

  // check if the user inviting is a participant in the challenge
  const isParticipant = await checkUserIsParticipantInChallenge(challengeName, userId);
  if (!isParticipant) {
    console.error('User inviting is not a participant in the challenge');
    return false;
  }

  const inviteeId = await getUserIdByUsername(inviteeUsername);
  if (!inviteeId) {
    console.error('Invalid invitee username');
    return false;
  }

  const sql = `
    INSERT INTO challenge_participants (challenge_name, user_id)
    VALUES ($1, $2)
  `;
  try {
    const rst = await pool.query(sql, [challengeName, inviteeId]);
    return rst.rowCount > 0;
  } catch (error) {
    console.error('Error inviting user to challenge:', error);
    return false;
  }
}

// check if a user is participant in a challenge
async function checkUserIsParticipantInChallenge(challengeName, userId) {
  if (!challengeName || !userId) {
    console.error('Both challengeName and userId parameters are required');
    return false;
  }
  const sql = `
    SELECT 1
    FROM challenge_participants
    WHERE challenge_name = $1 AND user_id = $2
  `;
  try {
    const result = await pool.query(sql, [challengeName, userId]);
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error checking user participation in challenge:', error);
    return false;
  }
}


/* get all challenges where the given user is a participant */
async function getUserChallenges(userId) {
  if (!userId) {
    console.error('userId parameter is required');
    return [];
  }
  const sql = `
    SELECT c.*
    FROM challenge c
    JOIN challenge_participants cp ON c.name = cp.challenge_name
    WHERE cp.user_id = $1
  `;
  try {
    const result = await pool.query(sql, [userId]);
    return result.rows.map(row => ({
      challengeName: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      ended: new Date() > new Date(row.end_date),
      lcPoints: row.lc_points,
      ntPoints: row.nt_points,
      vuPoints: row.vu_points,
      enPoints: row.en_points,
      crPoints: row.cr_points,
    }));
  } catch (error) {
    console.error('Error getting user challenges:', error);
    return [];
  }
}

/* 
  get challenge participants and their scores as a a list of JSON object:
  [
    username: {
      username,
      score,
      lcScore,
      ntScore,
      vuScore,
      enScore,
      crScore
    }
]
*/
async function getChallengeParticipantsScores(challengeName) {
  if (!challengeName) {
    console.error('challengeName parameter is required');
    return [];
  }
  const sql = `
    SELECT *
    FROM user_challenge_points
    WHERE challenge_name = $1
  `;

  try {
    const result = await pool.query(sql, [challengeName]);
    const participants = result.rows.map(row => ({
      username: row.username,
      score: parseFloat(row.total_points),
      lcScore: parseFloat(row.lc_score),
      ntScore: parseFloat(row.nt_score),
      vuScore: parseFloat(row.vu_score),
      enScore: parseFloat(row.en_score),
      crScore: parseFloat(row.cr_score),
    }));
    return participants;
  } catch (error) {
    console.error('Error getting challenge participants scores:', error);
    return [];
  }
}

/*
  get all challenges where the given user is a participant
  including all the information about a specific challenge and its participants as a list of JSON object including:
  {
    challengeName,
    startDate,
    endDate,
    ended,
    lcPoints,
    ntPoints,
    vuPoints,
    enPoints,
    crPoints,
    participants: [
      username: {
        username,
        score,
        lcScore,
        ntScore,
        vuScore,
        enScore,
        crScore
      }
    ]
  }
*/
async function getUserChallengesWithParticipants(userId) {
  if (!userId) {
    console.error('userId parameter is required');
    return [];
  }

  const challenges = await getUserChallenges(userId);
  for (const challenge of challenges) {
    const participants = await getChallengeParticipantsScores(challenge.challengeName);
    challenge.participants = participants;
  }
  return challenges;
}

// get only the image (with license and contributor) for the given species scientific name or common name
async function getSpeciesImages(speciesName) {
  if (!speciesName) {
    console.error('speciesName parameter is required');
    return [];
  }

  const sql = `
    SELECT url
    FROM media
    JOIN species s ON media.species_scientific_name = s.scientific_name
    WHERE (s.scientific_name = $1 OR s.common_name = $1) AND media.media_type = 'image'
  `;

  try {
    const result = await pool.query(sql, [speciesName]);
    return result.rows.map(row => ({
      url: row.url,
      license: row.license,
      contributor: row.contributor,
    }));
  } catch (error) {
    console.error('Error getting bird images:', error);
    return [];
  }
}


// get species information in chunks for pagination
// speciesNameOffset is the scientific name of the last species in the previous chunk
// if speciesNameOffset is not provided, start from the beginning
async function getSpeciesBatch(limit, speciesNameOffset = '') {
  if (limit === null) {
    console.error('limit parameter is required');
    return [];
  }
  let sql;
  let params = [];

  if (speciesNameOffset === '') {
    sql = `
      SELECT *
      FROM species
      ORDER BY scientific_name
      LIMIT $1
    `;
    params = [limit];
  } else {
    sql = `
      SELECT *
      FROM species
      ORDER BY scientific_name
      WHERE LOWER(scientific_name) > $1 LIMIT $2
    `;
    params = [speciesNameOffset.toLowerCase(), limit];
  }

  try {
    const result = await pool.query(sql, params);
    return result.rows.map(row => ({
      scientificName: row.scientific_name,
      commonName: row.common_name,
      family: row.family,
      orderName: row.order_name,
      diet: row.diet,
      conservationStatus: row.conservation_status,
    }));
  } catch (error) {
    console.error('Error fetching species chunk:', error);
    return [];
  }
}