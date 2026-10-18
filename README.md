# Jin Sanskar Setu (जिन संस्कार सेतु)

> **"Connecting Families • Strengthening Sangh • Nurturing Sanskars"**

Jin Sanskar Setu is a production-ready, mobile-first web application designed for the Jain community survey and management initiative across six participating Sanghs. It enables authorized Sangh survey volunteers to visit families, collect verified household census details, track Pathshala attendance and interest for youth, detect duplicates in real-time, generate atomic sequential IDs, and synchronize data to a single reporting Google Sheet.

**PostgreSQL is the SINGLE SOURCE OF TRUTH.** Google Sheets operates solely as an asynchronous, synchronized reporting and export destination.

---

## 1. Participating Sanghs

The application seeds and manages exactly these six Sanghs, each with an independent sequence counter:

| # | Sangh Name | Prefix | Member ID Format |
|---|---|---|---|
| 1 | Munisuvrat Swami Jain Sangh | `MSJS` | `MSJS-000001`, `MSJS-000002`... |
| 2 | Shree Adinath Jain Sangh | `SAJS` | `SAJS-000001`, `SAJS-000002`... |
| 3 | Shree Sambhavnath Jain Sangh | `SSJS` | `SSJS-000001`, `SSJS-000002`... |
| 4 | Shree Kunthunath Jain Sangh | `SKJS` | `SKJS-000001`, `SKJS-000002`... |
| 5 | Eternia Jain Sangh | `EJS` | `EJS-000001`, `EJS-000002`... |
| 6 | NIBM Jain Sangh | `NJS` | `NJS-000001`, `NJS-000002`... |

*Global Family IDs follow the format: `FAM-000001`, `FAM-000002`...*

---

## 2. Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Actions, Route Handlers)
- **Frontend**: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Bootstrap 5](https://getbootstrap.com/), Bootstrap Icons, Custom Mobile-First Jain Visual Tokens
- **Database**: [PostgreSQL](https://www.postgresql.org/) / [Neon PostgreSQL](https://neon.tech/)
- **ORM**: [Prisma ORM](https://www.prisma.io/)
- **Authentication**: [NextAuth.js / Auth.js](https://next-auth.js.org/) with Google OAuth (Strict Whitelist Verification)
- **Validation**: [Zod](https://zod.dev/)
- **Analytics Charts**: [Recharts](https://recharts.org/)
- **Google Sheets Integration**: Google Sheets API v4 via official Google APIs service account
- **Deployment**: [Vercel](https://vercel.com/)

---

## 3. Security & Access Architecture

- **No Public Registration**: There is no public signup or registration button. Google authentication strictly serves identity verification.
- **Whitelist Enforcement**: After Google authentication, the email is normalized (lowercase trimmed) and queried against the PostgreSQL `users` table. If the user does not exist or has `status: DISABLED`, access is denied with:
  > *"Your account is not authorized to access Jin Sanskar Setu. Please contact the administrator."*
- **Role-Based Access Control (RBAC)**:
  - `ADMIN`: Full access to user management, Sangh assignments, audit logs, sync management, settings, analytics, and CSV exports.
  - `VOLUNTEER`: Access to register families, search permitted records, view dashboard and analytics. Volunteers assigned to a specific Sangh are restricted to that Sangh on the server.
- **Server-Side Validation**: All permissions, duplicate checks, and sequence generations are enforced server-side inside PostgreSQL transactions.
- **Credential Protection**: Database passwords and Google service account keys remain exclusively server-side. No secrets are committed to Git.

---

## 4. Key Architectural Features

### A. Concurrency-Safe ID Generation
Member IDs and Family IDs are generated inside an atomic PostgreSQL `$transaction` utilizing atomic increment and row locking on the `id_counters` table. When two volunteers submit families simultaneously, ID collisions are prevented at the database engine level.

### B. Two-Tier Duplicate Prevention
1. **Exact Duplicate (Normalized Mobile + Sangh)**:
   - Mobile numbers are normalized by stripping spaces, hyphens, and country prefixes (`+91` or `0`).
   - Exact duplicates block submission and display existing household details with a direct link to open the existing record.
2. **Member Warnings**:
   - Matches on name, age, and relationship within the same household trigger a warning and require explicit volunteer confirmation before saving.

### C. Head of Family Circular Relation
The Head of Family is recorded as Member #1 (`relationship: "HEAD"`). Inside the database transaction, the Family record is created, the Head Member is created, and the family's `headMemberId` foreign key is updated atomically.

### D. Single Google Sheet Synchronized Reporting
- Member ID serves as the external unique key across 17 standardized columns.
- Existing rows are updated in place; new members are appended.
- Failures in Google Sheets API do **not** rollback or corrupt PostgreSQL transactions; the sync record is marked as `FAILED` and can be retried individually or in batch from `/admin/sync`.

### E. Pathshala Potential Report
Volunteers can instantly filter for children (`Age < 18` and `pathshalaStatus: NO`) to identify youth candidates for Pathshala enrollment, tracking preferred day and time.

---

## 5. Prerequisites

- **Node.js**: `v18.17.0` or higher (`v20.x` or `v24.x` recommended)
- **npm**: `v9.x` or higher
- **PostgreSQL**: An active PostgreSQL database (e.g., [Neon](https://neon.tech/), Supabase, AWS RDS, or local PostgreSQL)

---

## 6. Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Populate the required environment variables in `.env`:

```env
# PostgreSQL Connection (Neon or local)
DATABASE_URL="postgresql://user:password@ep-cool-frost-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"

# NextAuth / Auth.js
NEXTAUTH_URL="http://localhost:3000"
AUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Google OAuth (Identity Verification)
GOOGLE_CLIENT_ID="your-google-oauth-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"

# First Administrator Seed Email
ADMIN_EMAIL="admin@example.com"

# Google Sheets API (Optional for reporting sync)
GOOGLE_SERVICE_ACCOUNT_EMAIL="sync@your-project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID="your-google-spreadsheet-id"
```

---

## 7. Step-by-Step Local Setup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Generate Prisma Client
```bash
npx prisma generate
```

### Step 3: Run Database Migrations
Apply the schema directly to your PostgreSQL instance:
```bash
npx prisma db push
# or for migration history:
npx prisma migrate dev --name init
```

### Step 4: Seed the Six Sanghs and Initial Administrator
Execute the seed script to create the 6 Sanghs, ID counters, and first Admin:
```bash
npx prisma db seed
```
*Console output will confirm:*
```
🌸 [SEED] Starting Jin Sanskar Setu database seed...
✓ Seeded Sangh: Munisuvrat Swami Jain Sangh (MSJS)
✓ Seeded Sangh: Shree Adinath Jain Sangh (SAJS)
✓ Seeded Sangh: Shree Sambhavnath Jain Sangh (SSJS)
✓ Seeded Sangh: Shree Kunthunath Jain Sangh (SKJS)
✓ Seeded Sangh: Eternia Jain Sangh (EJS)
✓ Seeded Sangh: NIBM Jain Sangh (NJS)
✓ Initialized Global Family ID Counter
✓ Seeded First Administrator: admin@example.com (Role: ADMIN, Status: ACTIVE)
✨ [SEED] Jin Sanskar Setu database successfully seeded.
```

### Step 5: Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 8. Google OAuth Setup Guide

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `Jin Sanskar Setu`.
3. Under **APIs & Services** > **OAuth consent screen**:
   - User Type: **External**
   - App Name: `Jin Sanskar Setu`
   - User support email: Select your admin email.
   - Authorized domains: Add `vercel.app` (and your custom domain if applicable).
4. Under **APIs & Services** > **Credentials**:
   - Click **Create Credentials** > **OAuth client ID**.
   - Application type: **Web application**.
   - Authorized JavaScript origins:
     - `http://localhost:3000` (Local)
     - `https://your-production-domain.vercel.app` (Production)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (Local)
     - `https://your-production-domain.vercel.app/api/auth/callback/google` (Production)
5. Copy the **Client ID** and **Client Secret** into your `.env`.

---

## 9. Google Sheets API Setup Guide

1. In the same Google Cloud project, navigate to **APIs & Services** > **Library**.
2. Search for **Google Sheets API** and click **Enable**.
3. Under **APIs & Services** > **Credentials**, click **Create Credentials** > **Service Account**.
   - Service account name: `jin-sanskar-setu-sync`
   - Grant role: **Editor** or basic Viewer.
4. Click on the created service account > **Keys** tab > **Add Key** > **Create new key** (JSON).
5. Open the downloaded JSON:
   - Copy `client_email` to `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
   - Copy `private_key` to `GOOGLE_PRIVATE_KEY` (ensure `\n` linebreaks are preserved).
6. Create a blank Google Sheet in your Google Drive:
   - Copy the Sheet ID from the URL (`https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`).
   - Click **Share** on the Google Sheet and add your service account email (`GOOGLE_SERVICE_ACCOUNT_EMAIL`) as **Editor**.
   - Paste the Sheet ID into `GOOGLE_SHEET_ID`.

---

## 10. Verification & Test Suite

Run the automated verification suite to test ID generation concurrency, mobile/name normalization, and Zod validation:

```bash
npm run test:concurrency
```

---

## 11. Vercel Deployment

1. Push your repository to GitHub.
2. Log in to [Vercel](https://vercel.com/) and click **Add New Project**.
3. Import your GitHub repository.
4. In the **Environment Variables** section, enter:
   - `DATABASE_URL` (Your Neon PostgreSQL connection string with `?sslmode=require`)
   - `NEXTAUTH_URL` (`https://your-project.vercel.app`)
   - `AUTH_SECRET` (Your high-entropy secret)
   - `NEXTAUTH_SECRET` (Same as AUTH_SECRET)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `ADMIN_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GOOGLE_SHEET_ID`
5. Click **Deploy**. Vercel will build the production bundle (`next build`) and deploy the app.
6. Run the initial seed on the production database by running `npx prisma db seed` locally with the production `DATABASE_URL` or via Vercel CLI.

---

## 12. Application Route Map

- `/login` — Google OAuth authentication & authorization policy notice.
- `/unauthorized` — Blocked access notice for non-whitelisted emails.
- `/dashboard` — KPI aggregate cards, Pathshala potential alert, and 6 Sanghs summary.
- `/families` — Filterable family directory with server-side pagination & mobile cards.
- `/families/new` — 5-step mobile-first family survey registration wizard.
- `/families/[id]` — Household profile, member list, and soft archive dialog.
- `/members` — Community member directory with quick filters.
- `/members/[id]` — Detailed individual member profile and Pathshala status.
- `/search` — 16 combinable filter engine with sorting and CSV export.
- `/analytics` — 8 interactive Recharts visualizations with click-to-filter drilldowns.
- `/export` — CSV export center (Members, Pathshala Potential, Families).
- `/admin/users` — Add authorized volunteers, assign Sanghs, enable/disable access.
- `/admin/audit-logs` — Immutable event audit trail with JSON metadata.
- `/admin/sync` — Google Sheets sync status monitor and failure retry manager.
- `/settings` — Sangh entities, atomic sequence counters, and session diagnostics.

---

## 13. License

Private internal application built for the Jain Sangh Community Survey Initiative. All rights reserved.
