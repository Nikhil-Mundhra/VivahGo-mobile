# VivahGo Feature Guide

This guide explains each feature in VivahGo and how to access it.

## Quick Navigation Map

1. Open app -> Login
2. Login -> Splash -> Onboarding (first-time) or Home
3. In app, use bottom navigation:
   - Home
   - Events
   - Budget
   - Guests
   - Vendors
   - Tasks
4. Use top bar for:
   - Marriage plan switcher
   - Wedding date/venue quick edit
   - Account settings

## 1) Login

### How to access
- Launch the app.
- The first screen is Login.

### Walkthrough
1. Click **Continue with Google** to sign in and sync planner data to backend.
2. Or click **Login as Demo Planner With Sample Data** to explore with local sample data.

### Notes
- Google login is required for collaboration and workspace switching.
- Demo login stores planner data in local storage only.

## 2) Splash Screen

### How to access
- Appears automatically right after successful login/session restore.

### Walkthrough
1. Click **Start**.
2. If wedding profile is incomplete, app moves to Onboarding.
3. If profile exists, app opens the main planner.

## 3) Onboarding

### How to access
- First-time users after Splash when required wedding profile fields are missing.

### Walkthrough
1. Answer onboarding prompts for wedding details.
2. Provide at least bride and groom names.
3. Complete the flow to enter the planner.

### Notes
- This initializes your base wedding profile.

## 4) Home Dashboard

### How to access
- Bottom nav -> **Home**.

### Walkthrough
1. View wedding countdown and summary cards.
2. Check upcoming events.
3. Tap summary cards to jump to related sections (Budget/Guests).

### Notes
- View-only users can still see dashboard data.

## 5) Events

### How to access
- Bottom nav -> **Events**.

### Walkthrough
1. Tap **Add Event** / plus button.
2. Enter event details: name, date, time, venue, status, notes, etc.
3. Save event.
4. Edit or delete existing events from the list.

### Notes
- Owners and Editors can create/update/delete.
- Viewers can only view events.

## 6) Budget

### How to access
- Bottom nav -> **Budget**.

### Walkthrough
1. Tap **Add Expense** / plus button.
2. Fill amount, category, date, linked area/event, and notes.
3. Save expense.
4. Use summaries/charts to track spend vs total budget.

### Notes
- Owners and Editors can modify budget entries.
- Viewers have read-only access.

## 7) Guests

### How to access
- Bottom nav -> **Guests**.

### Walkthrough
1. Tap **Add Guest** / plus button.
2. Enter guest details (name, side, phone, RSVP, count).
3. Save.
4. Filter/search guest list and update RSVP status.

### Notes
- Owners and Editors can add/update/remove guests.
- Viewers can only view guest data.

## 8) Vendors

### How to access
- Bottom nav -> **Vendors**.

### Walkthrough
1. Select vendor type tabs (Venue, Photography, Catering, etc.).
2. Apply filters (city, rating, price tier).
3. Open a vendor card to view details.
4. Mark vendor as booked (local UI state).

### Notes
- Vendor catalog is curated and primarily browsing-oriented.

## 9) Tasks

### How to access
- Bottom nav -> **Tasks**.

### Walkthrough
1. Tap plus button to add a task.
2. Set task name, timeline/group, linked event, and priority.
3. Save task.
4. Mark tasks complete/incomplete.
5. Track completion progress from the progress indicator.

### Notes
- Owners and Editors can modify tasks.
- Viewers can only view tasks.

## 10) Account and Settings

### How to access
- Tap avatar/initial in the top-right corner.

### Walkthrough
1. Open **Account & Settings**.
2. Update wedding details (names, date, venue, budget, guest count).
3. Save changes.
4. Use **Log Out** to sign out.

### Notes
- Shows whether you are in Demo mode or Google account mode.

## 11) Quick Wedding Details Edit

### How to access
- In top bar, tap the **date** chip or **venue** chip.

### Walkthrough
1. Edit wedding date and/or venue.
2. Click **Save Details**.

### Notes
- Changes update top bar and dashboard countdown context.
- Disabled for users without edit permission.

## 12) Multi-Plan Management

### How to access
- Tap bride & groom title in the top bar.

### Walkthrough
1. Open **Marriage Plan Selector**.
2. Choose a plan to switch context.
3. Click **Create Plan** to add another wedding plan.
4. Fill details and choose template while creating a plan.
5. Use delete option to remove a plan (at least one must remain).

### Notes
- Best for planners handling multiple weddings.
- Editing actions require write permission.

## 13) Plan Sharing and Collaborators

### How to access
1. Open Marriage Plan Selector.
2. Click **Configure** for a plan.
3. Click **Share**.

### Walkthrough
1. Add collaborator by email.
2. Assign role: **Editor** or **Viewer**.
3. Update collaborator role when needed.
4. Remove collaborator when access is no longer needed.

### Notes
- Only Owners can manage sharing.
- Editors and Viewers can view collaborator list but cannot manage roles.

## 14) Workspace Switching (Google mode)

### How to access
1. Open Marriage Plan Selector.
2. Click **Configure**.
3. Use **Workspace** dropdown (visible when you have multiple accessible workspaces).

### Walkthrough
1. Choose target workspace (your plans or shared workspace).
2. App reloads planner context for selected workspace.

### Notes
- Available only in Google-authenticated mode.

## 15) Feedback

### How to access
- Bottom footer -> **Feedback**.

### Walkthrough
1. Open feedback modal.
2. Enter message (required), optionally add name/email.
3. Submit.

### Notes
- Useful for bug reports and product suggestions.

## 16) Legal and About

### How to access
- Bottom footer links:
  - **Terms & Conditions**
  - **About**

### Walkthrough
1. Click a link.
2. Read modal content.
3. Close to return to current screen.

## Permissions Summary

- **Owner**: full edit + collaboration management.
- **Editor**: edit planner data, cannot manage sharing ownership controls.
- **Viewer**: read-only across planner sections.

## Data Mode Summary

- **Demo Mode**
  - Fast try-out experience
  - Data stored locally
  - No real cross-user sharing/workspace switching

- **Google Mode**
  - Backend persistence
  - Collaborator sharing
  - Workspace switching across accessible planners
