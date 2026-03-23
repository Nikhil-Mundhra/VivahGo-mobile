import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { OAuth2Client } from 'google-auth-library';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Planner from './models/Planner.js';
import User from './models/User.js';

const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI;
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const jwtSecret = process.env.JWT_SECRET || 'change-me-before-production';

const emptyWedding = {
  bride: '',
  groom: '',
  date: '',
  venue: '',
  guests: '',
  budget: '',
};

export function buildEmptyPlanner() {
  return {
    wedding: { ...emptyWedding },
    events: [],
    expenses: [],
    guests: [],
    vendors: [],
    tasks: [],
  };
}

export function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function sanitizeCollection(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord);
}

export function sanitizePlanner(payload = {}) {
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

export function createSessionToken(user, secret = jwtSecret) {
  return jwt.sign(
    {
      sub: user.googleId,
      email: user.email,
      name: user.name,
    },
    secret,
    { expiresIn: '7d' }
  );
}

export function getClientOrigins(clientOrigin = process.env.CLIENT_ORIGIN) {
  if (!clientOrigin) {
    return true;
  }

  return clientOrigin.split(',').map(origin => origin.trim());
}

export function authMiddleware(req, res, next, secret = jwtSecret) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    req.auth = jwt.verify(token, secret);
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

export function createApp(options = {}) {
  const {
    googleClientId: injectedGoogleClientId = googleClientId,
    jwtSecret: injectedJwtSecret = jwtSecret,
    oauthClient: injectedOauthClient,
    PlannerModel = Planner,
    UserModel = User,
  } = options;

  const oauthClient =
    injectedOauthClient !== undefined
      ? injectedOauthClient
      : injectedGoogleClientId
        ? new OAuth2Client(injectedGoogleClientId)
        : null;

  const app = express();

  app.use(
    cors({
      origin: getClientOrigins(),
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/auth/google', async (req, res) => {
    if (!oauthClient || !injectedGoogleClientId) {
      return res.status(500).json({ error: 'Google auth is not configured on the server.' });
    }

    const { credential } = req.body || {};

    if (!credential) {
      return res.status(400).json({ error: 'Missing Google credential.' });
    }

    try {
      const ticket = await oauthClient.verifyIdToken({
        idToken: credential,
        audience: injectedGoogleClientId,
      });
      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email || !payload.name) {
        return res.status(400).json({ error: 'Google account details are incomplete.' });
      }

      const user = await UserModel.findOneAndUpdate(
        { googleId: payload.sub },
        {
          $set: {
            googleId: payload.sub,
            email: payload.email,
            name: payload.name,
            picture: payload.picture || '',
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

      const planner = await PlannerModel.findOneAndUpdate(
        { googleId: payload.sub },
        {
          $setOnInsert: {
            googleId: payload.sub,
            ...buildEmptyPlanner(),
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

      return res.json({
        token: createSessionToken(user, injectedJwtSecret),
        user: {
          id: user.googleId,
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
        planner: sanitizePlanner(planner.toObject()),
      });
    } catch (error) {
      console.error('Google auth failed:', error);
      return res.status(401).json({ error: 'Google sign-in could not be verified.' });
    }
  });

  app.get('/api/planner/me', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const googleId = req.auth.sub;
      const planner = await PlannerModel.findOneAndUpdate(
        { googleId },
        {
          $setOnInsert: {
            googleId,
            ...buildEmptyPlanner(),
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

      return res.json({ planner: sanitizePlanner(planner.toObject()) });
    } catch (error) {
      console.error('Failed to load planner:', error);
      return res.status(500).json({ error: 'Failed to load planner data.' });
    }
  });

  app.put('/api/planner/me', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const googleId = req.auth.sub;
      const planner = sanitizePlanner(req.body?.planner);
      const updatedPlanner = await PlannerModel.findOneAndUpdate(
        { googleId },
        {
          $set: {
            ...planner,
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

      return res.json({ planner: sanitizePlanner(updatedPlanner.toObject()) });
    } catch (error) {
      console.error('Failed to save planner:', error);
      return res.status(500).json({ error: 'Failed to save planner data.' });
    }
  });

  return app;
}

export const app = createApp();

export async function start() {
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required.');
  }

  await mongoose.connect(mongoUri);
  app.listen(port, () => {
    console.log(`VivahGo API listening on http://localhost:${port}`);
  });
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
