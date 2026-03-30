<div align="center">
  <img src="src/image/carrerBanglalogo.png" alt="CareerBangla Logo" width="220" />
  <h1>CAREERBANGLA BACKEND</h1>
  <p><strong>Scalable job portal API for authentication, recruitment, resumes, subscriptions, referrals, and admin operations.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Node.js-22.x-43853D?style=for-the-badge&logo=node.js" alt="Node.js" />
    <img src="https://img.shields.io/badge/Express.js-5.2.1-000000?style=for-the-badge&logo=express" alt="Express.js" />
    <img src="https://img.shields.io/badge/Prisma-7.3.0-2D3748?style=for-the-badge&logo=prisma" alt="Prisma" />
    <img src="https://img.shields.io/badge/PostgreSQL-Relational-316192?style=for-the-badge&logo=postgresql" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Better--Auth-Session%20Auth-111111?style=for-the-badge" alt="Better Auth" />
  </p>
</div>

---

## Overview

CareerBangla Backend is the service layer behind the CareerBangla platform. It manages the complete hiring workflow for job seekers, recruiters, admins, and super admins.

The API covers:

- secure authentication with Better Auth, refresh tokens, device session control, and Google OAuth
- recruiter onboarding with approval and rejection workflow
- job posting, moderation, and application lifecycle management
- resume building, ATS score calculation, candidate search, and PDF resume download
- paid and free subscription flows through SSLCommerz
- notifications, coupons, referrals, usage tracking, and role-based dashboard stats

> [!IMPORTANT]
> This service requires a valid PostgreSQL database and a fully configured `.env` file before it can boot successfully.

---

## Core Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| Runtime | `Node.js` | Backend execution environment |
| Framework | `Express.js v5` | API routing and middleware pipeline |
| Language | `TypeScript` | Type-safe backend development |
| ORM | `Prisma` | Database access, schema management, generated client |
| Database | `PostgreSQL` | Relational storage for all platform data |
| Auth | `Better Auth` | Session-based authentication and account flows |
| Validation | `Zod` | Request payload validation |
| Uploads | `Multer` + `Cloudinary` | Profile photo and file upload handling |
| Payments | `SSLCommerz` | Subscription checkout and IPN processing |
| Mail | `Nodemailer` + `EJS` | OTP, status update, and reminder emails |
| Scheduling | `node-cron` | Subscription expiry reminder job |

---

## Key Features

### Authentication and account security

- Email/password registration and login
- Google OAuth login flow
- Email verification and password reset OTP flows
- Access token refresh
- Change password and profile update
- Active session listing, single-session revoke, and logout from all devices

### Recruiter workflow

- Recruiter account creation with multipart form upload support
- Recruiter profile completion and profile update
- Admin review flow with `PENDING`, `APPROVED`, and `REJECTED` states
- Recruiter-only features for posting jobs and browsing applicants

### Jobs and applications

- Public job listing with filters and job details
- Recruiter job creation, update, inactive cleanup, and ownership-based access
- Admin approval and rejection for pending jobs
- Application lifecycle with controlled statuses:

```text
PENDING -> SHORTLISTED -> INTERVIEW -> HIRED
                       \-> REJECTED
```

### Resume and candidate search

- Create, update, and delete personal resume
- ATS scoring endpoint
- Resume PDF download
- Recruiter candidate search
- Recruiter/admin resume access by user
- Resume/CV download flows for recruiters

### Monetization and growth

- Subscription plans, purchase flow, invoice generation, and cancellation
- Coupon validation and application
- Referral stats and referral search
- Coupon and referral tracking for admins
- Scheduled subscription expiry reminder emails and in-app notifications

### Platform administration

- Admin and super admin role management
- User status and role changes
- User detail, recruiter detail, and job management endpoints
- Subscription plan updates
- Role-based dashboard statistics

---

## API Modules

All API routes are mounted under `/api/v1`, except Better Auth internal routes under `/api/auth`.

| Module | Base Route | Responsibility |
| :--- | :--- | :--- |
| Auth | `/api/v1/auth` | registration, login, sessions, password, email verification |
| Users | `/api/v1/users` | recruiter/admin account creation |
| Admins | `/api/v1/admins` | users, recruiters, jobs, plan settings, role management |
| Recruiters | `/api/v1/recruiters` | recruiter profile and approval workflow |
| Jobs | `/api/v1/jobs` | job categories, job CRUD, pending job moderation |
| Applications | `/api/v1/applications` | apply, application status changes, job applicants |
| Resumes | `/api/v1/resumes` | resume CRUD, ATS score, PDF, candidate search |
| Subscriptions | `/api/v1/subscriptions` | plans, purchase, invoice, cancellation |
| Coupons | `/api/v1/coupons` | coupon create, validate, apply, delete |
| Notifications | `/api/v1/notifications` | read, unread count, delete |
| Referrals | `/api/v1/referrals` | referral stats and referral search |
| Tracking | `/api/v1/tracking` | referral and coupon usage tracking |
| Stats | `/api/v1/stats` | dashboard statistics by role |

### Selected endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register a new user |
| `POST` | `/api/v1/auth/login` | Login with email and password |
| `GET` | `/api/v1/auth/me` | Get the current authenticated user |
| `GET` | `/api/v1/jobs` | Public job listing |
| `POST` | `/api/v1/jobs` | Create a job as recruiter |
| `POST` | `/api/v1/applications/apply` | Apply to a job |
| `GET` | `/api/v1/resumes/my-resume` | Fetch current user's resume |
| `POST` | `/api/v1/resumes/ats-score` | Calculate ATS score |
| `GET` | `/api/v1/subscriptions/plans` | Fetch subscription plans |
| `POST` | `/api/v1/coupons/validate` | Validate a coupon |
| `GET` | `/api/v1/stats` | Fetch dashboard statistics |

For request testing, use the included [Postman collection](./CareerBangla-Backend-API.postman_collection-test.json).

---

## Project Structure

```text
Backend/
├── prisma/
│   └── schema/                     # Split Prisma schema by domain
├── src/
│   ├── app/
│   │   ├── config/                # env, cloudinary, auth, environment helpers
│   │   ├── errorHelpers/          # AppError and error mapping utilities
│   │   ├── interfaces/            # shared TypeScript contracts
│   │   ├── jobs/                  # cron jobs and background processes
│   │   ├── lib/                   # prisma, auth, cache helpers
│   │   ├── middleware/            # auth, validation, rate limit, error handler
│   │   ├── module/                # feature modules by domain
│   │   ├── routes/                # aggregated route registration
│   │   ├── shared/                # reusable helpers
│   │   ├── templates/             # email templates
│   │   └── utils/                 # logger, mail, seed, query helpers
│   ├── generated/                 # generated Prisma client
│   ├── image/                     # project assets used in docs/templates
│   ├── app.ts                     # express app configuration
│   └── server.ts                  # server bootstrap and graceful shutdown
├── render.yaml                    # Render deployment config
├── package.json
└── tsconfig.json
```

---

## Local Development

### 1. Prerequisites

- Node.js 22+ recommended
- `pnpm` installed
- PostgreSQL database
- Cloudinary account for uploads
- SSLCommerz credentials for payment flows

### 2. Installation

```bash
pnpm install
```

### 3. Environment setup

```bash
cp .env.example .env
```

Populate `.env` with real values before running the server.

### 4. Generate Prisma client

```bash
pnpm generate
```

### 5. Apply schema to database

Use the flow that matches your environment:

```bash
pnpm migrate
```

or:

```bash
pnpm push
```

### 6. Start development server

```bash
pnpm dev
```

### 7. Build production bundle

```bash
pnpm build
pnpm start
```

---

## Environment Variables

The backend validates required environment variables on startup. These categories must be configured:

### Application

```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
BETTER_AUTH_URL=http://localhost:5000
```

### Database

```env
DATABASE_URL=postgresql://user:password@host:port/database
```

### Authentication

```env
BETTER_AUTH_SECRET=your_better_auth_secret
BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN=7d
BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE=1d
ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
ACCESS_TOKEN_EXPIRES_IN=1d
REFRESH_TOKEN_EXPIRES_IN=7d
```

### OAuth, mail, storage, and payments

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/callback/google

EMAIL_SENDER_SMTP_USER=your_email@example.com
EMAIL_SENDER_SMTP_PASS=your_password
EMAIL_SENDER_SMTP_HOST=smtp.gmail.com
EMAIL_SENDER_SMTP_PORT=465
EMAIL_SENDER_SMTP_FROM=noreply@example.com

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

SSL_STORE_ID=your_sslcommerz_store_id
SSL_STORE_PASSWORD=your_sslcommerz_store_password
SSL_IS_LIVE=false
```

### Seed accounts

```env
SUPER_ADMIN_EMAIL=superadmin@careerbangla.com
SUPER_ADMIN_PASSWORD=strong_password
ADMIN_EMAIL=admin@careerbangla.com
ADMIN_PASSWORD=strong_password
```

See [`.env.example`](./.env.example) for the full template.

---

## Deployment

### Render

This repository already includes [render.yaml](./render.yaml) with:

- build command: `pnpm install --frozen-lockfile && pnpm generate && pnpm build`
- start command: `node dist/server.js`
- runtime: Node

### Production checklist

1. Add all required environment variables in your hosting provider.
2. Point `DATABASE_URL` to your production PostgreSQL instance.
3. Run Prisma generate during build.
4. Ensure your payment callback URLs and Better Auth URLs match production domains.
5. Set correct `FRONTEND_URL`, `BACKEND_URL`, and `BETTER_AUTH_URL`.
6. Confirm SMTP credentials work in production.

---

## Health and background jobs

- `GET /` returns a basic health response
- subscription expiry reminders run on a cron schedule every 5 minutes
- the server includes graceful shutdown handling for `SIGTERM`, `SIGINT`, uncaught exceptions, and unhandled rejections

---

## Notes

- Better Auth routes are mounted at `/api/auth`
- application routes are mounted at `/api/v1`
- subscription IPN handling is registered at the app level before CORS middleware
- this backend uses role-based access control for `SUPER_ADMIN`, `ADMIN`, `RECRUITER`, and `USER`

---

## Author

Developed by **[Habibur Rahman Zihad](https://habibur-rahman-zihad.vercel.app/)**.

Licensed under the **ISC License**.
