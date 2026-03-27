# VivahGo

VivahGo is a wedding planning platform built for Indian weddings. It combines a React + Vite frontend, a local Express API for development, and Vercel-style serverless API routes for deployment. The product now includes collaborative planning, public wedding websites, guest RSVP flows, vendor onboarding, subscriptions, careers, and admin operations.

## Table of Contents

- [What’s in the Product](#whats-in-the-product)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Run Locally](#run-locally)
- [Routes and Product Areas](#routes-and-product-areas)
- [API Overview](#api-overview)
- [Testing and Linting](#testing-and-linting)
- [Deployment Notes](#deployment-notes)
- [Security](#security)

## What’s in the Product

- Wedding planner workspace with dashboards, events, budget, guests, vendors, and tasks.
- Demo mode for quick product exploration with seeded local planner data.
- Google-authenticated mode with MongoDB persistence.
- Multi-plan support for managing more than one wedding workspace.
- Collaborator roles per plan: `owner`, `editor`, and `viewer`.
- Workspace switching for shared planner access.
- Public wedding website generation with custom slug/theme/settings.
- Guest RSVP links and RSVP submission flow for invited guests.
- Marketing home and pricing pages.
- Vendor portal with business registration, profile editing, portfolio/media management, and verification document uploads.
- Public vendor directory backed by approved vendor records.
- Admin portal for vendor moderation, staff management, career applications, and paid subscriber visibility.
- Careers page with application submission and resume upload to Google Drive.
- Subscription checkout for `premium` and `studio` plans with Razorpay, coupon support, and receipt generation.
- Feedback submission flow and legal/about modals.
- Capacitor iOS wrapper for mobile packaging.

## Project Structure

```text
.
├── api/              # Vercel serverless API routes and shared helpers
├── config/           # Local config data such as careers and coupon examples
├── test/             # Root Mocha test suite
├── vivahgo/          # Main app workspace
│   ├── src/          # React frontend
│   ├── server/       # Express server for local development
│   ├── public/       # Static assets
│   └── ios/          # Capacitor iOS project
├── FEATURE_GUIDE.md
├── Makefile
├── README.md
├── SECURITY.md
└── vercel.json
```

## Tech Stack

- Frontend: React 19, Vite
- Styling: CSS, Tailwind tooling
- Local backend: Express 5
- Deployment backend: Vercel serverless functions
- Database: MongoDB with Mongoose
- Authentication: Google OAuth token verification + JWT sessions
- Payments: Razorpay
- File storage: Cloudflare R2
- Resume storage: Google Drive service account uploads
- Analytics: Vercel Analytics, Vercel Speed Insights
- Mobile shell: Capacitor iOS
- Testing: Mocha, Supertest, c8
- Linting: ESLint

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- MongoDB instance
- Google Cloud OAuth Web client credentials

### Install Dependencies

Repository root:

```bash
npm install
```

App workspace:

```bash
cd vivahgo
npm install
```

## Configuration

Create a local environment file:

```bash
cp vivahgo/.env.example vivahgo/.env
```

### Core required variables

- `VITE_GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_ID`
- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_ORIGIN`

### Frontend/runtime variables

- `VITE_API_BASE_URL`
- `VITE_USE_REMOTE_API`

### Feature-specific backend variables

- Feedback: `FEEDBACK_WEBHOOK_URL`, `FEEDBACK_SECRET_KEY`
- RSVP signing: `RSVP_TOKEN_SECRET` (optional, otherwise falls back to `JWT_SECRET`)
- Coupons: `SUBSCRIPTION_COUPONS_JSON`
- Payments: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- Payment amount overrides:
  - `RAZORPAY_PREMIUM_MONTHLY_AMOUNT`
  - `RAZORPAY_PREMIUM_YEARLY_AMOUNT`
  - `RAZORPAY_STUDIO_MONTHLY_AMOUNT`
  - `RAZORPAY_STUDIO_YEARLY_AMOUNT`
- Billing email: `RESEND_API_KEY`, `BILLING_FROM_EMAIL`
- Media storage:
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_ENDPOINT`
  - `R2_BUCKET_NAME`
  - `R2_PUBLIC_URL`
- Admin bootstrap: `ADMIN_OWNER_EMAIL`
- Careers upload:
  - `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL`
  - `GOOGLE_DRIVE_PRIVATE_KEY`
  - `GOOGLE_DRIVE_CAREERS_FOLDER_ID`

Use [vivahgo/.env.example](/Users/nikhil/Documents/VivahGo-mobile/vivahgo/.env.example) as the source of truth for local setup.

### Google OAuth Notes

- Use a Google OAuth client of type **Web application**.
- Keep `VITE_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID` the same.
- Add local frontend origins such as:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
- Add your deployed frontend domain to both Google OAuth and `CLIENT_ORIGIN`.

## Run Locally

From the app directory:

```bash
cd vivahgo
npm run dev
```

This starts:

- Vite frontend on `http://localhost:5173`
- Express API server on `http://localhost:4000`

From repository root you can also use:

```bash
npm run dev
```

Or:

```bash
make run_local
```

## Routes and Product Areas

- `/` - Main planner application
- `/home` - Marketing home page
- `/pricing` - Pricing page
- `/careers` - Careers page
- `/vendor` - Vendor portal
- `/admin` - Admin portal
- `/wedding` - Local wedding website preview
- `/:slug` - Public wedding website by slug
- `/rsvp/:token` - Guest RSVP page

## API Overview

### Auth and account

- `POST /api/auth/google`
- `DELETE /api/auth/me`

### Planner

- `GET /api/planner/me`
- `PUT /api/planner/me`
- `GET /api/planner/access`
- `GET /api/planner/public`
- `POST /api/planner/me/rsvp-link`
- `GET /api/planner/rsvp`
- `POST /api/planner/rsvp`
- `GET /api/planner/me/collaborators`
- `POST /api/planner/me/collaborators`
- `PUT /api/planner/me/collaborators`
- `DELETE /api/planner/me/collaborators`

### Vendor and media

- `GET /api/vendors`
- `GET /api/vendor/me`
- `POST /api/vendor/me`
- `PATCH /api/vendor/me`
- `POST /api/media/presigned-url`
- `POST /api/media/verification-presigned-url`
- `POST /api/vendor/media`
- `PUT /api/vendor/media`
- `DELETE /api/vendor/media`
- `POST /api/vendor/verification`
- `DELETE /api/vendor/verification`

### Subscription

- `GET /api/subscription/status`
- `POST /api/subscription/quote`
- `POST /api/subscription/checkout`
- `POST /api/subscription/confirm`
- `POST /api/subscription/portal`
- `POST /api/subscription/webhook`

### Admin

- `GET /api/admin/me`
- `GET /api/admin/vendors`
- `PATCH /api/admin/vendors`
- `GET /api/admin/staff`
- `POST /api/admin/staff`
- `PUT /api/admin/staff`
- `DELETE /api/admin/staff`
- `GET /api/admin/applications`
- `GET /api/admin/subscribers`

### Misc

- `GET /api/health`
- `GET /api/careers`
- `POST /api/careers`
- `POST /api/feedback`

## Testing and Linting

Run the full test suite from the repository root:

```bash
npm test
```

Run coverage:

```bash
npm run test:coverage
```

Check the coverage threshold:

```bash
npm run coverage:check
```

Run app linting:

```bash
cd vivahgo
npm run lint
```

## Deployment Notes

- The `api/` directory contains the serverless routes used for Vercel deployment.
- The local Express server in [vivahgo/server/index.js](/Users/nikhil/Documents/VivahGo-mobile/vivahgo/server/index.js) mirrors the main API behavior for development.
- In local development, the frontend defaults to `http://localhost:4000/api` unless `VITE_USE_REMOTE_API=true`.
- Production can usually use relative `/api` requests without setting `VITE_API_BASE_URL`.

## SEO Verification

After deploying, run the smoke test against production:

```bash
npm run verify:seo -- https://vivahgo.com
```

To verify public wedding or RSVP previews too, pass real routes:

```bash
npm run verify:seo -- https://vivahgo.com /home /pricing /careers /asha-rohan-1 /rsvp/REAL_TOKEN
```

The script checks the initial HTML response for:

- `<title>`
- canonical link
- description
- Open Graph tags
- Twitter card tags
- robots tag

## Security

See [SECURITY.md](/Users/nikhil/Documents/VivahGo-mobile/SECURITY.md) for supported versions and vulnerability reporting instructions.
