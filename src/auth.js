const crypto = require('crypto');
const db = require('./db/db');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

// Hash a password with a random salt using scrypt returning salt:hash
async function hashPassword(password) {
  // Generate a random salt
  const salt = crypto.randomBytes(16).toString('hex');
  // Hash the password with the salt using scrypt
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

// Verify a password against a stored salt:hash
async function verifyPassword(stored, passwordAttempt) {
  const [salt, hash] = stored.split(':');
  const hashAttempt = await scrypt(passwordAttempt, salt, 64);
  return hash === hashAttempt.toString('hex');
}

// Create a new user with hashed password
// return bool indicating success or failure
async function createUser(username, password, email) {
  const hashedPassword = await hashPassword(password);
  const sql = 'INSERT INTO users (username, password, email) VALUES ($1, $2, $3)';
  const result = await db.query(sql, [username, hashedPassword, email]);
  return result.rowCount > 0;
}

// create a new Session for a user
async function createSession(userId, durationMs) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + durationMs);
  const sql = 'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)';
  await db.query(sql, [sessionId, userId, expiresAt]);
  return sessionId;
}

// Authenticate a user via username and password and return session ID if successful, null otherwise
async function authenticateUser(username, password) {
  const sql = 'SELECT * FROM users WHERE LOWER(username) = $1';
  const result = await db.query(sql, [username.toLowerCase()]);
  const user = result.rows[0];
  if (user && await verifyPassword(user.password, password)) {
    // if authentication is successful, return a new session ID
    return createSession(user.id, 45 * 60 * 1000); // 45 minutes
  }
  return null;
}

// verify a session ID and return associated user ID if valid, null otherwise
async function verifySession(sessionId) {
  const sql = 'SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()';
  const result = await db.query(sql, [sessionId]);
  const session = result.rows[0];
  if (session) {
    return session.user_id;
  }
  return null;
}

/*
  Middleware to authenticate requests via session ID to protected routes
  returns true if authenticated, false otherwise
  attaches userId to req if authenticated
  In case of failed authentication, redirects to /login
  Assumes session ID is stored in a cookie named 'sid'
*/
async function middleAuthenticateRequest(req, res) {
  const sessionId = getSessionIdFromRequest(req);
  // attach userId to request for further use
  req.userId = await verifySession(sessionId);
  if (!req.userId) {
    // If no valid session redirect to login
    res.writeHead(302, { Location: '/login' });
    res.end();
    return false;
  }
  return true;
}

// extract session ID from cookies in the request
function getSessionIdFromRequest(req) {
  // parse the cookies from the request headers
  const cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      cookies[name] = decodeURIComponent(value);
    });
  }
  return cookies['sid'] || null;
}

module.exports = {
  createUser,
  authenticateUser,
  middleAuthenticateRequest
};
