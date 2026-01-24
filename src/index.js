const http = require('http');
const db = require('./db/db');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  if (method === 'GET' && url === '/') {
    serveHomepage(req, res);
  } else if (method === 'GET' && url === '/api/species') {
    await handleAPISpecies(req, res);
  } else if (method === 'GET' && url.startsWith('/api/species/geojson')) {
    await handleAPISpeciesGeoJSON(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Route to serve the homepage
function serveHomepage(req, res) {
  const filePath = path.join(__dirname, '../static/index.html');
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
  });
}

// route to handle API requests for species data
async function handleAPISpecies(req, res) {
  try {
    const result = await db.query('SELECT * FROM species');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.rows));
  } catch (err) {
    console.error('Database query error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Database query failed' }));
  }
}

// route to handle API requests for species GeoJSON data
async function handleAPISpeciesGeoJSON(req, res) {
  try {
    const geojsonFeatures = await db.queryGeoJSONSpecies('Anas acuta'); // example species
    if (geojsonFeatures.length > 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(geojsonFeatures));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Species not found' }));
    }
  } catch (err) {
    console.error('Database query error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Database query failed' }));
  }
}