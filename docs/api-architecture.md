# API and Architecture

VivahGo uses one shared product backend exposed in two runtime shapes:

- Vercel serverless functions under [`api/`](/Users/nikhil/Documents/VivahGo-mobile/api)
- A local Express server under [`vivahgo/server/index.js`](/Users/nikhil/Documents/VivahGo-mobile/vivahgo/server/index.js) for development

The important design detail is that both runtimes serve the same product areas and mostly the same business logic. Vercel rewrites friendly URLs like `/api/planner/me` into route-dispatch handlers such as `/api/planner?route=me`, while local development mounts those same endpoints directly on Express.

## High-level architecture

```text
React + Vite frontend
        |
        | HTTP / JSON + cookie session
        v
Vercel rewrites or local Express routes
        |
        +--> api/auth.js
        +--> api/planner.js
        +--> api/vendor.js
        +--> api/admin.js
        +--> api/subscription.js
        +--> api/careers.js
        +--> api/media/*
        |
        v
Shared helpers in api/_lib/*
        |
        +--> MongoDB / Mongoose
        +--> Google auth verification
        +--> JWT session + CSRF protection
        +--> Razorpay
        +--> Cloudflare R2
        +--> Backblaze B2
        +--> Firebase Cloud Messaging
        +--> Resend
```

## Request model

- Frontend calls relative `/api/...` endpoints in production.
- Local development usually proxies to `http://localhost:4000/api`.
- Session auth is cookie-based after successful sign-in.
- State-changing endpoints generally require CSRF protection.
- Public endpoints exist for health checks, public wedding pages, vendor discovery, and RSVP flows.

## Client data layer

The frontend now has a mixed local-form plus TanStack Query data model for authenticated product areas:

- Planner and vendor reads use TanStack Query for authoritative server fetches.
- The planner editor and vendor portal still keep editable local UI state for responsiveness.
- Mutations carry `correlationId`, `clientSequence`, and base revision metadata so the backend can reject stale writes.
- Planner and vendor optimistic updates use guarded mutation journals instead of naive whole-query rollback.

The important rule is that TanStack Query should remain the source of server truth, while local component state handles the immediate editing experience.

## TanStack revalidation behavior

Planner and vendor now follow the same revalidation rule:

1. TanStack Query remains the authoritative server source.
2. Visible editor state is only hydrated from query results when there are no pending optimistic mutations for that surface.
3. While optimistic mutations are still in flight, background refetches must not overwrite local in-progress UI state.
4. Once the mutation journal is clear, the next authoritative query result is allowed to reconcile the visible editor again.

This keeps optimistic UI responsive without letting background refetches reintroduce the double-mutation trap.

## Route dispatch model

Production rewrites are defined in [`vercel.json`](/Users/nikhil/Documents/VivahGo-mobile/vercel.json). The main grouped handlers are:

- `/api/auth/*` -> [`api/auth.js`](/Users/nikhil/Documents/VivahGo-mobile/api/auth.js)
- `/api/admin/*` -> [`api/admin.js`](/Users/nikhil/Documents/VivahGo-mobile/api/admin.js)
- `/api/vendors`, `/api/vendor/*` -> [`api/vendor.js`](/Users/nikhil/Documents/VivahGo-mobile/api/vendor.js)
- `/api/planner/*` -> [`api/planner.js`](/Users/nikhil/Documents/VivahGo-mobile/api/planner.js)
- `/api/subscription/*` -> [`api/subscription.js`](/Users/nikhil/Documents/VivahGo-mobile/api/subscription.js)
- `/api/careers` -> [`api/careers.js`](/Users/nikhil/Documents/VivahGo-mobile/api/careers.js)
- `/api/media/*` -> dedicated handlers in [`api/media/`](/Users/nikhil/Documents/VivahGo-mobile/api/media)
- Marketing and SEO pages -> [`api/page.js`](/Users/nikhil/Documents/VivahGo-mobile/api/page.js)

## Domain areas

### Authentication

Primary files:

- [`api/auth.js`](/Users/nikhil/Documents/VivahGo-mobile/api/auth.js)
- [`api/_lib/core.js`](/Users/nikhil/Documents/VivahGo-mobile/api/_lib/core.js)

Responsibilities:

- Google sign-in verification
- Clerk token sign-in support
- Session issuance and logout
- CSRF token issuance
- Account deletion and cleanup

### Planner

Primary files:

- [`api/planner.js`](/Users/nikhil/Documents/VivahGo-mobile/api/planner.js)
- [`vivahgo/server/index.js`](/Users/nikhil/Documents/VivahGo-mobile/vivahgo/server/index.js)

Responsibilities:

- Planner workspace read/write
- Multi-plan access
- Public wedding data
- Guest RSVP token generation and submission
- Collaborator management
- Notification preference and device registration
- Internal reminder dispatch

### Vendor

Primary files:

- [`api/vendor.js`](/Users/nikhil/Documents/VivahGo-mobile/api/vendor.js)
- [`api/media.js`](/Users/nikhil/Documents/VivahGo-mobile/api/media.js)
- [`api-handlers/media/presignedUrl.js`](/Users/nikhil/Documents/VivahGo-mobile/api-handlers/media/presignedUrl.js)
- [`api-handlers/media/verificationPresignedUrl.js`](/Users/nikhil/Documents/VivahGo-mobile/api-handlers/media/verificationPresignedUrl.js)

Responsibilities:

- Vendor onboarding and profile editing
- Public vendor listing
- Vendor portfolio/media uploads
- Private verification document uploads

### Admin

Primary files:

- [`api/admin.js`](/Users/nikhil/Documents/VivahGo-mobile/api/admin.js)
- [`api/_lib/admin.js`](/Users/nikhil/Documents/VivahGo-mobile/api/_lib/admin.js)

Responsibilities:

- Staff session and role enforcement
- Vendor moderation
- Choice content management
- Career application review and resume download
- Subscriber visibility

### Subscription and billing

Primary files:

- [`api/subscription.js`](/Users/nikhil/Documents/VivahGo-mobile/api/subscription.js)

Responsibilities:

- Tier status lookup
- Quote calculation
- Razorpay order creation
- Payment confirmation
- Webhook processing

### Careers

Primary files:

- [`api/careers.js`](/Users/nikhil/Documents/VivahGo-mobile/api/careers.js)
- [`api/_lib/b2.js`](/Users/nikhil/Documents/VivahGo-mobile/api/_lib/b2.js)

Responsibilities:

- Public job catalog
- Candidate submission intake
- Resume upload to private storage

## API reference

This is a lightweight route map for contributors. It is not a full OpenAPI contract yet.

### Auth and account

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Health check | Public |
| `GET` | `/api/auth/csrf` | Issue or refresh CSRF token | Public |
| `POST` | `/api/auth/google` | Sign in with Google credential | Public |
| `POST` | `/api/auth/clerk` | Sign in with Clerk token | Public |
| `POST` | `/api/auth/logout` | Clear session cookie | Session |
| `DELETE` | `/api/auth/me` | Delete current account and related records | Session |

### Planner

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/api/planner/me` | Load current planner workspace | Session |
| `PUT` | `/api/planner/me` | Save planner workspace | Session |
| `GET` | `/api/planner/access` | List accessible planners | Session |
| `GET` | `/api/planner/public` | Read public wedding data | Public |
| `POST` | `/api/planner/me/rsvp-link` | Create RSVP link for a guest | Session |
| `GET` | `/api/planner/rsvp` | Resolve RSVP token to invitation data | Public |
| `POST` | `/api/planner/rsvp` | Submit RSVP response | Public |
| `GET` | `/api/planner/me/collaborators` | List plan collaborators | Session |
| `POST` | `/api/planner/me/collaborators` | Add collaborator | Session |
| `PUT` | `/api/planner/me/collaborators` | Change collaborator role | Session |
| `DELETE` | `/api/planner/me/collaborators` | Remove collaborator | Session |
| `GET` | `/api/planner/me/notifications` | Read notification preferences | Session |
| `PUT` | `/api/planner/me/notifications` | Update notification preferences | Session |
| `POST` | `/api/planner/me/notifications` | Register or upsert device token | Session |
| `DELETE` | `/api/planner/me/notifications` | Remove device token | Session |
| `POST` | `/api/planner/internal/reminder-dispatch` | Run reminder dispatch job | Internal secret or bearer access |

### Vendors and media

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/api/vendors` | Public vendor listing | Public |
| `GET` | `/api/vendor/me` | Read current vendor profile | Session |
| `POST` | `/api/vendor/me` | Create vendor profile | Session |
| `PATCH` | `/api/vendor/me` | Update vendor profile | Session |
| `POST` | `/api/media/presigned-url` | Create public vendor media upload URL | Session |
| `POST` | `/api/vendor/media` | Attach or manage vendor media metadata | Session |
| `PUT` | `/api/vendor/media` | Update vendor media metadata | Session |
| `DELETE` | `/api/vendor/media` | Remove vendor media item | Session |
| `POST` | `/api/media/verification-presigned-url` | Create private verification upload URL | Session |
| `POST` | `/api/vendor/verification` | Attach uploaded verification document | Session |
| `DELETE` | `/api/vendor/verification` | Remove verification document | Session |
| `POST` | `/api/media/app-upload` | Upload admin-managed public app or marketing images | Admin session |

### Admin

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/api/admin/me` | Read admin session and access | Staff session |
| `GET` | `/api/admin/vendors` | List vendor moderation queue | Staff session |
| `PATCH` | `/api/admin/vendors` | Approve or update vendor moderation state | Staff session |
| `GET` | `/api/admin/choice` | Read choice content/admin data | Staff session |
| `PATCH` | `/api/admin/choice` | Update choice content/admin data | Staff session |
| `POST` | `/api/admin/choice-media-upload` | Upload media for choice content | Staff session |
| `GET` | `/api/admin/staff` | List staff users | Staff session |
| `POST` | `/api/admin/staff` | Create or grant staff access | Staff session |
| `PUT` | `/api/admin/staff` | Update staff role | Staff session |
| `DELETE` | `/api/admin/staff` | Remove staff access | Staff session |
| `GET` | `/api/admin/applications` | List career applications | Staff session |
| `PATCH` | `/api/admin/applications` | Update application state | Staff session |
| `GET` | `/api/admin/resume-download` | Get resume download access | Staff session |
| `GET` | `/api/admin/subscribers` | List paid subscribers | Staff session |

### Subscription

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/api/subscription/status` | Read current subscription state | Session |
| `POST` | `/api/subscription/quote` | Calculate subscription amount | Session |
| `POST` | `/api/subscription/checkout` | Create checkout payload or Razorpay order | Session |
| `POST` | `/api/subscription/confirm` | Confirm payment and persist receipt | Session |
| `POST` | `/api/subscription/portal` | Placeholder for self-serve management | Session |
| `POST` | `/api/subscription/webhook` | Razorpay webhook endpoint | Razorpay webhook secret |

### Careers and feedback

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/api/careers` | Read public job catalog and limits | Public |
| `POST` | `/api/careers` | Submit career application | Public |
| `POST` | `/api/feedback` | Submit product feedback | Public or app-defined |

## Storage and integrations

- MongoDB is the primary application datastore.
- Cloudflare R2 stores public vendor and marketing media.
- Backblaze B2 stores private resume and verification documents.
- Razorpay handles paid checkout and webhook callbacks.
- Firebase Cloud Messaging powers browser push and reminder delivery.
- Resend is used for billing or outbound email flows.

## Security model

- Session verification and shared CORS/CSRF behavior live in [`api/_lib/core.js`](/Users/nikhil/Documents/VivahGo-mobile/api/_lib/core.js).
- Most mutating endpoints require both a valid session and CSRF protection.
- Admin routes additionally enforce staff-role authorization.
- Reminder dispatch uses internal authorization rather than a normal user session.
- File upload endpoints validate MIME types and file-size limits before issuing upload URLs.

## Related docs

- [`README.md`](/Users/nikhil/Documents/VivahGo-mobile/README.md)
- [`docs/premium-reminders-setup.md`](/Users/nikhil/Documents/VivahGo-mobile/docs/premium-reminders-setup.md)
- [`SECURITY.md`](/Users/nikhil/Documents/VivahGo-mobile/SECURITY.md)
