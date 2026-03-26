# VivahGo

VivahGo is a wedding planner web application with a React + Vite frontend and an Express/MongoDB backend. It supports both demo access and Google-authenticated accounts with persistent planner data.

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Run Locally](#run-locally)
- [API Endpoints](#api-endpoints)
- [Testing and Linting](#testing-and-linting)
- [Security](#security)
- [Contributing](#contributing)

## Features

- Demo login with seeded planner data for quick evaluation.
- Google login with backend token verification.
- Automatic user creation for first-time Google sign-ins.
- Planner persistence in MongoDB for returning users.

## Project Structure

```text
.
├── api/              # Serverless API routes (Vercel)
├── test/             # Root test suite (Mocha)
├── vivahgo/          # Main app (frontend + Express API server)
│   ├── src/          # React client
│   └── server/       # Express backend
├── Makefile
├── SECURITY.md
└── vercel.json
```

## Tech Stack

- Frontend: React, Vite
- Backend: Node.js, Express
- Database: MongoDB, Mongoose
- Auth: Google OAuth (token verification)
- Testing: Mocha

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- MongoDB instance (local or hosted)
- Google Cloud OAuth 2.0 Web client credentials

### Install Dependencies

Install repository-level dependencies:

```bash
npm install
```

Install app dependencies:

```bash
cd vivahgo
npm install
```

## Configuration

Create a local environment file from the template:

```bash
cp vivahgo/.env.example vivahgo/.env
```

Set these variables in `vivahgo/.env`:

- `VITE_GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_ID`
- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_ORIGIN`
- `FEEDBACK_WEBHOOK_URL`
- `FEEDBACK_SECRET_KEY`
- `SUBSCRIPTION_COUPONS_JSON`

Use the same Google Web Client ID for `VITE_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID`.

`FEEDBACK_SECRET_KEY` is server-only and must not use a `VITE_` prefix.

`SUBSCRIPTION_COUPONS_JSON` is server-only and should contain a JSON array of coupon objects. Use [config/subscription-coupons.example.json](/Users/nikhil/Documents/VivahGo-mobile/config/subscription-coupons.example.json) as the format reference, or create a local-only `config/subscription-coupons.local.json` file that is ignored by Git.

### Google OAuth Setup Notes

- The OAuth client type must be **Web application**.
- Add local frontend origins under **Authorized JavaScript origins**:
	- `http://localhost:5173`
	- `http://127.0.0.1:5173`
- If you run Vite on a different port, add that exact origin.
- For the current implementation, JavaScript origins are the critical setting.

## Run Locally

From the app directory:

```bash
cd vivahgo
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`

Optional Makefile flow from repository root:

```bash
make run_local
```

## API Endpoints

Core endpoints:

- `POST /api/auth/google` - Verifies Google sign-in and creates a user session.
- `GET /api/planner/me` - Loads the saved planner for the authenticated user.
- `PUT /api/planner/me` - Persists planner updates for the authenticated user.

## Testing and Linting

Run root test suite:

```bash
npm test
```

Run test suite with Istanbul coverage (includes statement coverage in the summary):

```bash
npm run test:coverage
```

Run frontend/backend linting:

```bash
cd vivahgo
npm run lint
```

## Security

See [SECURITY.md](SECURITY.md) for supported versions and vulnerability reporting instructions.

## Contributing

1. Create a feature branch.
2. Keep changes scoped and well-tested.
3. Run tests before opening a pull request.
4. Open a pull request with a clear summary and validation steps.
