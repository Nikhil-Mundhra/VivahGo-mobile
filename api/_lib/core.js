const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const emptyWedding = {
  bride: '',
  groom: '',
  date: '',
  venue: '',
  guests: '',
  budget: '',
};

let cachedConnection = null;

function getClientOrigins() {
  if (!process.env.CLIENT_ORIGIN) {
    return ['*'];
  }

  return process.env.CLIENT_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean);
}

function setCorsHeaders(req, res) {
  const origins = getClientOrigins();
  const requestOrigin = req.headers.origin;
  const allowAll = origins.includes('*');

  if (allowAll) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && origins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
}

function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res);
    res.status(204).end();
    return true;
  }
  return false;
}

async function connectDb() {
  if (cachedConnection) {
    return cachedConnection;
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required.');
  }

  cachedConnection = mongoose.connect(mongoUri);
  return cachedConnection;
}

function getUserModel() {
  const schema = new mongoose.Schema(
    {
      googleId: { type: String, required: true, unique: true, index: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      name: { type: String, required: true, trim: true },
      picture: { type: String, default: '' },
    },
    { timestamps: true }
  );

  return mongoose.models.User || mongoose.model('User', schema);
}

function getPlannerModel() {
  const schema = new mongoose.Schema(
    {
      googleId: { type: String, required: true, unique: true, index: true },
      wedding: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
      events: { type: [mongoose.Schema.Types.Mixed], default: [] },
      expenses: { type: [mongoose.Schema.Types.Mixed], default: [] },
      guests: { type: [mongoose.Schema.Types.Mixed], default: [] },
      vendors: { type: [mongoose.Schema.Types.Mixed], default: [] },
      tasks: { type: [mongoose.Schema.Types.Mixed], default: [] },
    },
    { timestamps: true, minimize: false }
  );

  return mongoose.models.Planner || mongoose.model('Planner', schema);
}

function buildEmptyPlanner() {
  return {
    wedding: { ...emptyWedding },
    events: [],
    expenses: [],
    guests: [],
    vendors: [],
    tasks: [],
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeCollection(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord);
}

function sanitizePlanner(payload = {}) {
  const wedding = isRecord(payload.wedding)
    ? { ...emptyWedding, ...payload.wedding }
    : { ...emptyWedding };

  return {
    wedding,
    events: sanitizeCollection(payload.events),
    expenses: sanitizeCollection(payload.expenses),
    guests: sanitizeCollection(payload.guests),
    vendors: sanitizeCollection(payload.vendors),
    tasks: sanitizeCollection(payload.tasks),
  };
}

function createSessionToken(user) {
  const jwtSecret = process.env.JWT_SECRET || 'change-me-before-production';
  return jwt.sign(
    {
      sub: user.googleId,
      email: user.email,
      name: user.name,
    },
    jwtSecret,
    { expiresIn: '7d' }
  );
}

function readBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return '';
  }
  return authHeader.slice(7);
}

function verifySession(req) {
  const token = readBearerToken(req);
  if (!token) {
    return { error: 'Authentication required.' };
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'change-me-before-production';
    return { auth: jwt.verify(token, jwtSecret) };
  } catch {
    return { error: 'Session expired. Please sign in again.' };
  }
}

module.exports = {
  buildEmptyPlanner,
  connectDb,
  createSessionToken,
  getPlannerModel,
  getUserModel,
  handlePreflight,
  sanitizePlanner,
  setCorsHeaders,
  verifySession,
};
