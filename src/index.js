const http = require('http');
const db = require('./db/db');
const fs = require('fs');
const path = require('path');
const auth = require('./auth');

const STATIC_ROOT = path.join(__dirname, '..', 'static');

const PORT = 3000;
const protectedRoutes = [
  '/profile',
  `/profile/logout`,
  `/api/user/observations`,
  `/api/user/observations/new`,
  `/api/user`,
  `/api/user/challenges/new`,
  `/api/user/challenges/invite`,
  `/api/user/challenges`,
];

const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  // List of protected routes that require authentication
  if (protectedRoutes.includes(req.url)) {
    // handle the authentication via a middleware that attaches userId to req if authenticated
    if (!(await auth.middleAuthenticateRequest(req, res))) {
      return;
    }
  }

  if (method === 'GET' && url === '/') {
    // Route to serve the homepage
    serveStaticFileFromPath(path.join(__dirname, '../static/index.html'), res);
  } else if (method === 'GET' && url === '/login') {
    // Route to serve the login page
    serveStaticFileFromPath(path.join(__dirname, '../static/login.html'), res);
  } else if (method === 'GET' && url === '/register') {
    // Route to serve the registration page
    serveStaticFileFromPath(path.join(__dirname, '../static/register.html'), res);
  } else if (method === 'GET' && url === '/profile') {
    // Route to serve the profile page
    serveStaticFileFromPath(path.join(__dirname, '../static/profile.html'), res);
  } else if (method === 'GET' && url.startsWith('/static/')) {
    // Route to serve static files
    serveStaticFile(req, res);
  } else if (method === 'GET' && url === '/profile/logout') {
    // Route to handle logout requests
    handleLogout(req, res);
  } else if (method === 'POST' && url === '/register') {
    // Route to handle registration requests
    handleRegistration(req, res);
  } else if (method === 'POST' && url === '/login') {
    // Route to handle login requests
    handleLogin(req, res);
  } else if (method === 'POST' && url === '/api/species/info') {
    // Route to handle API requests for species information
    handleAPISpecies(req, res);
  } else if (method === 'POST' && url === '/api/species/images') {
    // Route to handle API requests for species images
    handleAPISpeciesImages(req, res);
  } else if (method === 'POST' && url === '/api/species/geojson') {
    // Route to handle API requests for species GeoJSON data
    handleAPISpeciesGeoJSON(req, res);
  } else if (method === 'POST' && url === '/api/user/observations') {
    // Route to handle API requests for user observations
    handleApiUserObservations(req, res);
  } else if (method === 'POST' && url === '/api/user/observations/new') {
    // Route to handle API requests for new user observations
    handleApiUserObservationsNew(req, res);
  } else if (method === 'POST' && url === '/api/user/challenges/new') {
    // Route to handle API requests for creating new challenges
    handleApiCreateChallenge(req, res);
  } else if (method === 'POST' && url === '/api/user/challenges/invite') {
    // Route to handle API requests for inviting users to challenges
    handleApiInviteUserToChallenge(req, res);
  } else if (method === 'POST' && url === '/api/user/challenges') {
    // Route to handle API requests for user challenges
    handleApiUserChallenges(req, res);
  } else if (method === 'POST' && url === '/api/user') {
    // Route to handle API requests for user information
    handleApiUser(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

function serveStaticFile(req, res) {
  const safePath = checkStaticDirectoryTraversal(req.url);
  if (safePath === '') {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }
  // get the relative path, decode URL-encoded characters (e.g., %20 -> space)
  serveStaticFileFromPath(safePath, res);
}

// serve static files (CSS, JS, images, etc.)
function serveStaticFileFromPath(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    // set basic security headers
    // prevent MIME type sniffing, prevent the browser from guessing the content type
    // protect against security risks like Cross-Site Scripting (XSS) attacks
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // prevent clickjacking, by disallowing the page to be displayed in a frame
    res.setHeader('X-Frame-Options', 'DENY');
    // (optional) we are not serving static files with sensitive info for now
    // res.setHeader('Referrer-Policy', 'no-referrer');
    res.writeHead(200, ContentType(ext));
    res.end(data);
  });
}

// handle registration requests (POST /register)
// expects JSON body with username and password
function handleRegistration(req, res) {
  parsePostJsonData(res, req, async (data) => {
    const success = await auth.createUser(data.username, data.password, data.email);
    if (success) {
      // Redirect to login page after successful registration
      sendJSONResponse(res, 200, { redirectUrl: '/login' });
    } else {
      sendJSONResponse(res, 400, { error: 'Registration failed. Username may already exist.' });
    }
  });
}

// handle login requests (POST /login)
// expects JSON body with username and password
function handleLogin(req, res) {
  parsePostJsonData(res, req, async (data) => {
    const sessionId = await auth.authenticateUser(data.username, data.password);
    if (sessionId) {
      // Set the session ID in a cookie
      // HttpOnly: prevents JavaScript (document.cookie) from reading the session ID.
      // Path=/ : cookie is sent for all paths on the domain.
      // SameSite=Strict : Prevents the cookie from being sent when clicking links from external websites (stops CSRF attacks).
      res.setHeader('Set-Cookie', `sid=${sessionId}; HttpOnly; Path=/; Max-Age=2700; SameSite=Strict`); // 45 minutes
      // Redirect to profile page after successful login
      sendJSONResponse(res, 200, { redirectUrl: '/profile' });
    } else {
      sendJSONResponse(res, 401, { error: 'Invalid credentials' });
    }
  });
}

// handle logout requests (GET /profile/logout)
async function handleLogout(req, res) {
  const success = await auth.invalidateUserSession(req);
  if (success) {
    // Redirect to login page after successful logout
    res.writeHead(302, { Location: '/login', 'Set-Cookie': 'sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict' });
    res.end();
  } else {
    // If logout failed, send error response as html
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<h1>Logout failed</h1>');
  }
}

// handle POST data conversion to JSON (presume application/json content type)
// the handleData callback is called with the parsed JSON data
function parsePostJsonData(res, req, handleData) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
    if (body.length > 1e6) { // limit to 1MB
      // kill connection if body is too big
      req.destroy();
    }
  });
  req.on('end', () => {
    try {
      const parsedData = JSON.parse(body);
      handleData(parsedData);
    } catch (err) {
      console.error('Error parsing JSON:', err);
      sendJSONResponse(res, 500, { error: 'Failed to parse JSON' });
    }
  });
}

// route to handle API requests for species GeoJSON data
function handleAPISpeciesGeoJSON(req, res) {
  // get the species name and season from the POST data and query the database
  parsePostJsonData(res, req, (data) => {
    handleAPIQuery(res, async () => {
      return await db.queryGeoJSONSpecies(data.speciesName, data.season);
    });
  });
}

// route to handle API requests for species media data
function handleAPISpeciesImages(req, res) {
  // get the species from the POST data and query the database
  parsePostJsonData(res, req, (data) => {
    handleAPIQuery(res, async () => {
      return await db.getSpeciesImages(data.speciesName);
    });
  });
}

// route to handle API requests for species data
function handleAPISpecies(req, res) {
  // get the species name from the POST data and query the database
  parsePostJsonData(res, req, (data) => {
    handleAPIQuery(res, async () => {
      return await db.querySpecies(data.speciesName);
    });
  });
}

// route to handle API requests for user observations, requires authentication
// return all observations made by the authenticated user as a JSON array
function handleApiUserObservations(req, res) {
  // get the userId from the authenticated request and query the database
  // req.userId set by the authentication middleware
  handleAPIQuery(res, async () => {
    return await db.getUserObservations(req.userId);
  });
}

// route to handle API requests for user information, requires authentication
// return user information as a JSON object
function handleApiUser(req, res) {
  // get the userId from the authenticated request and query the database
  // req.userId set by the authentication middleware
  handleAPIQuery(res, async () => {
    return await db.getUserById(req.userId);
  });
}

// route to handle API requests for adding new user observations, requires authentication
// expects JSON body with species, latitude, longitude, observedAt
function handleApiUserObservationsNew(req, res) {
  parsePostJsonData(res, req, (data) => {
    handleAPIQuery(res, async () => {
      // req.userId set by the authentication middleware
      const rst = await db.insertUserObservation(req.userId, data.species, data.latitude, data.longitude, data.observedAt);
      return { success: rst };
    });
  });
}

// route to handle API requests for user challenges, requires authentication
function handleApiUserChallenges(req, res) {
  // req.userId set by the authentication middleware
  handleAPIQuery(res, async () => {
    return await db.getUserChallengesWithParticipants(req.userId);
  });
}

// route to handle API requests for creating new challenges, requires authentication
// expects JSON body with name, startDate, endDate, points (object with lc, nt, vu, en, cr)
function handleApiCreateChallenge(req, res) {
  parsePostJsonData(res, req, (data) => {
    handleAPIQuery(res, async () => {
      // req.userId set by the authentication middleware
      const rst = await db.insertChallenge(
        data.name,
        data.startDate,
        data.endDate,
        req.userId,
        data.points
      );
      return { success: rst };
    });
  });
}

// route to handle API requests for inviting users to challenges, requires authentication
// expects JSON body with challengeId and inviteeUsername
function handleApiInviteUserToChallenge(req, res) {
  parsePostJsonData(res, req, (data) => {
    handleAPIQuery(res, async () => {
      // req.userId set by the authentication middleware
      const rst = await db.inviteUserToChallenge(
        data.challenge,
        req.userId,
        data.username // inviteeUsername
      );
      return { success: rst };
    });
  });
}

// generic function to handle API queries and send JSON responses
async function handleAPIQuery(res, asyncQueryJsonFn) {
  try {
    const data = await asyncQueryJsonFn();
    // check if data is non-empty array or non-null object
    if ((Array.isArray(data) && data.length > 0) || (data && !Array.isArray(data))) {
      sendJSONResponse(res, 200, data);
    } else {
      sendJSONResponse(res, 404, { error: 'No data found' });
    }
  } catch (err) {
    console.error('Database query error:', err);
    sendJSONResponse(res, 500, { error: 'Database query failed' });
  }
}

// Api json response content, reduce code duplication
function sendJSONResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Utility function to get content type based on file extension
function ContentType(extname) {
  let type = 'application/octet-stream';
  if (extname === '.css') type = 'text/css';
  else if (extname === '.js') type = 'application/javascript';
  else if (extname === '.html') type = 'text/html';
  else if (extname === '.json') type = 'application/json';
  else if (extname === '.png') type = 'image/png';
  else if (extname === '.jpg' || extname === '.jpeg') type = 'image/jpeg';
  return { 'Content-Type': type };
}

/* 
  sanitize and resolve the requested static path to prevent directory traversal
  basically check if the resolved path starts with STATIC_ROOT, staying inside the static directory
  returns the safe path or empty string if invalid
 */
function checkStaticDirectoryTraversal(reqUrl) {
  let safePath;
  try {
    // get the relative path, decode URL-encoded characters (e.g., %20 -> space)
    // .. or / can be encoded, so decode first 
    const relPath = decodeURIComponent(reqUrl.replace(/^\/static\//, ''));
    // normalize the joined path to remove any .. or .
    safePath = path.normalize(path.join(STATIC_ROOT, relPath));
    // Produces the absolute path for STATIC_ROOT and safePath
    const resolvedStaticRoot = path.resolve(STATIC_ROOT);
    const resolvedSafePath = path.resolve(safePath);
    // check if the resolved safe path starts with the resolved static root
    if (!resolvedSafePath.startsWith(resolvedStaticRoot)) {
      return '';
    }
  } catch (err) {
    return '';
  }
  return safePath;
}