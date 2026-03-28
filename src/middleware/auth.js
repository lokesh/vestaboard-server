import crypto from 'crypto';

const APP_SECRET = process.env.APP_SECRET;

if (!APP_SECRET) {
  console.warn('WARNING: APP_SECRET not set. Authentication is disabled. Set APP_SECRET to enable auth.');
}

// Generate a session token from the secret
function generateToken(secret) {
  return crypto.createHmac('sha256', secret).update('vestaboard-session').digest('hex');
}

// Validate a token against the secret
function isValidToken(token) {
  if (!APP_SECRET) return true; // Auth disabled if no secret
  return token === generateToken(APP_SECRET);
}

// Express middleware to protect API routes
export function requireAuth(req, res, next) {
  // If no APP_SECRET is configured, skip auth
  if (!APP_SECRET) return next();

  // Allow login endpoint through
  if (req.path === '/api/auth/login' || req.path === '/api/auth/check') return next();

  // Check for token in Authorization header or cookie
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token;

  if (!token || !isValidToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

// Login handler - validates password and returns token
export function handleLogin(req, res) {
  const { password } = req.body;

  if (!APP_SECRET) {
    return res.json({ success: true, token: 'no-auth', message: 'Auth disabled' });
  }

  if (!password || password !== APP_SECRET) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = generateToken(APP_SECRET);
  res.json({ success: true, token });
}

// Check if current token is valid
export function handleAuthCheck(req, res) {
  if (!APP_SECRET) {
    return res.json({ authenticated: true, authEnabled: false });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  res.json({
    authenticated: token ? isValidToken(token) : false,
    authEnabled: true
  });
}
