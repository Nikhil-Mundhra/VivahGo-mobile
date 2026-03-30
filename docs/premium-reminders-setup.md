# Premium Reminders Setup

This repo now includes:

- Premium-gated scheduled reminder settings on each wedding plan
- Browser push token registration from the planner account screen
- Reminder job generation on planner save
- An internal dispatch endpoint at `/api/planner/internal/reminder-dispatch`
- A sample Cloudflare cron worker in [`cloudflare/reminder-dispatcher.js`](/Users/nikhil/Documents/VivahGo-mobile/cloudflare/reminder-dispatcher.js)

## 1. Firebase setup

Create or reuse a Firebase project.

Enable:

- Cloud Messaging

Create a Firebase Web App and copy these values into Vercel:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Generate a Web Push certificate in Firebase Cloud Messaging and set:

- `VITE_FIREBASE_VAPID_KEY`

Create a service account with Firebase Messaging access and set:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Or set:

- `FIREBASE_SERVICE_ACCOUNT_JSON`

Notes:

- `FIREBASE_PRIVATE_KEY` must be the full `private_key` value from a Firebase service account JSON. It must keep newline characters and include the `BEGIN PRIVATE KEY` / `END PRIVATE KEY` block intact.
- `FIREBASE_SERVICE_ACCOUNT_JSON` can be the raw downloaded service-account JSON as a single env var if you prefer not to split the fields manually.
- The web push `VAPID` key is not the same thing as the server `private_key`. Do not paste the Cloud Messaging Web Push key into `FIREBASE_PRIVATE_KEY`.
- `FIREBASE_PROJECT_ID` should match the Firebase project used by the web app config.

## 2. Vercel setup

Add this secret env var:

- `REMINDER_DISPATCH_SECRET`

This is used by Cloudflare cron to call the internal dispatch endpoint safely.

Deploy after setting the env vars.

## 3. Cloudflare Worker setup

Create a Worker using:

- [`cloudflare/reminder-dispatcher.js`](/Users/nikhil/Documents/VivahGo-mobile/cloudflare/reminder-dispatcher.js)
- [`cloudflare/wrangler.example.toml`](/Users/nikhil/Documents/VivahGo-mobile/cloudflare/wrangler.example.toml)

Set the following worker vars/secrets:

- `PLANNER_DISPATCH_URL`
  Example: `https://planner.vivahgo.com/api/planner/internal/reminder-dispatch`
- `REMINDER_DISPATCH_LIMIT`
  Example: `25`
- `REMINDER_DISPATCH_SECRET`
  Must exactly match the Vercel env var

The example cron runs every 5 minutes.

## 4. How Premium gating works

- `Starter`: reminder settings can exist in local UI state, but backend save forces `enabled: false`
- `Premium` / `Studio`: reminder jobs are generated from saved planner data
- If a workspace owner downgrades from Premium or Studio, future reminder jobs for that workspace are deleted on the next save or dispatch cycle

## 5. What reminders are live right now

Scheduled reminders currently generate jobs for:

- events: `1 day before`
- events: `3 hours before`
- budget payments: `3 days before`
- budget payments: `day of due date`

The current implementation assumes Indian Standard Time for reminder scheduling.

## 6. How to test

1. Set all Firebase and Vercel env vars.
2. Deploy the planner.
3. Open Account & Settings.
4. Click `Enable Browser Notifications`.
5. Turn on scheduled reminders for the active wedding plan.
6. Add an event with a future date/time or a budget item with a future `expenseDate`.
7. Make sure the notification service worker is being served at `/firebase-messaging-sw.js` from the frontend host.
8. Trigger the dispatch endpoint manually:

```bash
curl -X POST "https://planner.vivahgo.com/api/planner/internal/reminder-dispatch" \
  -H "x-reminder-secret: YOUR_SECRET" \
  -H "content-type: application/json" \
  -d '{"limit":25}'
```

## 7. Mobile later

This backend is ready for Android and iOS device tokens later.

When you add mobile clients:

- register each device’s FCM token against `/api/planner/me/notifications`
- keep using the same dispatch endpoint
- add APNs credentials in Firebase before iOS push goes live
