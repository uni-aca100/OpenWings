const http = require('http');
const db = require('./db/db');
const fs = require('fs');
const path = require('path');
const STATIC_ROOT = path.join(__dirname, '..', 'static');

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  if (method === 'GET' && url === '/') {
    // Route to serve the homepage
    serveStaticFileFromPath(path.join(__dirname, '../static/index.html'), res);
  } else if (method === 'GET' && url.startsWith('/static/')) {
    // Route to serve static files
    serveStaticFile(req, res);
  } else if (method === 'POST' && url === '/api/species/info') {
    // Route to handle API requests for species information
    handleAPISpecies(req, res);
  } else if (method === 'POST' && url === '/api/species/geojson') {
    // Route to handle API requests for species GeoJSON data
    handleAPISpeciesGeoJSON(req, res);
  } else if (method === 'POST' && url === '/api/species/media') {
    // Route to handle API requests for species media data
    handleAPISpeciesMedia(req, res);
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

// handle POST data conversion to JSON (presume application/json content type)
// the handleData callback is called with the parsed JSON data
function parsePostData(res, req, handleData) {
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
  parsePostData(res, req, (data) => {
    handleAPIQuery(res, async () => {
      return await db.queryGeoJSONSpecies(data.speciesName, data.season);
    });
  });
}

// route to handle API requests for species media data
function handleAPISpeciesMedia(req, res) {
  // get the species from the POST data and query the database
  parsePostData(res, req, (data) => {
    handleAPIQuery(res, async () => {
      return await db.querySpeciesMedia(data.speciesName);
    });
  });
}

// route to handle API requests for species data
function handleAPISpecies(req, res) {
  // get the species name from the POST data and query the database
  parsePostData(res, req, (data) => {
    handleAPIQuery(res, async () => {
      return await db.querySpecies(data.speciesName);
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