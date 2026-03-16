# CareerBangla Backend

The backend of **CareerBangla** is a job portal platform built with **Node.js, Express.js, Prisma ORM, and PostgreSQL**. It provides REST APIs for authentication, job management, application management, resume/ATS profiles, a coin-based credit system, subscription plans, coupons/gift vouchers, and admin control.

---

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Express.js (v5)
- **ORM:** Prisma (v7)
- **Database:** PostgreSQL
- **Authentication:** Better-Auth + JWT
- **Payments:** Stripe
- **Email:** Nodemailer + EJS templates
- **File Uploads:** Cloudinary + Multer
- **Validation:** Zod

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env

# Run Prisma migrations
npx prisma migrate deploy

# Seed initial data (super admin)
npx prisma db seed

# Start development server
pnpm dev
```

---

## Folder Structure

```
src/
├── app/
│   ├── config/              # env, auth, stripe, multer, cloudinary
│   ├── errorHelpers/        # AppError, Prisma/Zod error handlers
│   ├── interfaces/          # Shared TypeScript interfaces
│   ├── lib/                 # Prisma client, Better-Auth setup
│   ├── middleware/           # checkAuth, validateRequest, globalErrorHandler
│   ├── module/              # Feature modules (controller/service/route/validation)
│   │   ├── admin/
│   │   ├── application/
│   │   ├── auth/
│   │   ├── coupon/
│   │   ├── job/
│   │   ├── notification/
│   │   ├── payment/
│   │   ├── recruiter/
│   │   ├── resume/
│   │   ├── stats/
│   │   ├── subscription/
│   │   ├── user/
│   │   └── wallet/
│   ├── routes/              # Central route aggregation
│   ├── shared/              # catchAsync, sendResponse
│   ├── templates/           # EJS email templates
│   └── utils/               # QueryBuilder, email, jwt, cookie
├── generated/               # Prisma generated client
├── app.ts                   # Express app setup
└── server.ts                # Server entry point
```

---

## Key Features & Workflows

### 1. Recruiter Approval Workflow

```
Register as Recruiter → Status: PENDING → Admin reviews → APPROVED / REJECTED
```

- Recruiters register and start in `PENDING` status
- Admin can approve (`PATCH /recruiters/approve/:id`) or reject (`PATCH /recruiters/reject/:id`)
- **Only APPROVED recruiters can post jobs** — attempting to post with PENDING/REJECTED status returns 403
- Email + in-app notifications are sent on approval/rejection

### 2. Profile Completion Requirement

- Users **must complete their ATS resume** before applying to any job
- The system checks for resume existence and that `skills` array is non-empty
- Without a completed resume, the apply endpoint returns 400 with a descriptive message

### 3. Application Status Lifecycle

```
PENDING → SHORTLISTED → INTERVIEW → HIRED
   └─────────┴──────────────┴─────→ REJECTED
```

- Status transitions are **strictly validated** — invalid transitions (e.g., HIRED → PENDING) are rejected
- Each transition triggers:
  - In-app notification to the applicant
  - Email notification with status-specific message
  - Interview date/note tracking for INTERVIEW status

### 4. Coin-Based Credit System

| Action | Coins | Role |
|--------|-------|------|
| Apply for a Job | 10 | User |
| View Recruiter Email | 15 | User |
| Post a Job | 15 | Recruiter |
| View Candidate Resume | 10 | Recruiter |

- All coin deductions happen inside **database transactions** (atomic with the action)
- Each deduction creates a `CoinTransaction` record and an in-app `COIN_DEBITED` notification
- Insufficient balance returns 400 before the action is attempted

### 5. Candidate Search (Recruiter)

`GET /api/v1/resumes/search-candidates`

| Query Param | Description |
|-------------|-------------|
| `searchTerm` | Free text search across title, summary, address, skills |
| `skills` | Comma-separated skill filter (e.g., `React,Node.js`) |
| `location` | Address-based location filter |
| `experience` | Filter for candidates with work experience |
| `education` | Filter for candidates with education entries |
| `page`, `limit` | Pagination |

### 6. Gift Voucher & Coupon Rules

- **maxUsage** — configurable usage limit per voucher/coupon (default: 1, supports multi-use)
- **usageCount** — tracks how many times redeemed; auto-marks as `USED` when limit reached
- **expiresAt** — expiry date; auto-marks as `EXPIRED` when redeemed after expiry
- **recipientEmail** — gift vouchers can be targeted to specific users
- Redemption credits coins to wallet within a transaction

### 7. Job Search Filters

`GET /api/v1/jobs`

| Query Param | Description |
|-------------|-------------|
| `searchTerm` | Search across title, description, location, company, category |
| `jobType` | FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP, REMOTE |
| `location` | Filter by location |
| `categoryId` | Filter by job category |
| `experience` | Filter by experience level |
| `education` | Filter by education requirement |
| `salaryMin[gte]` | Minimum salary filter |
| `salaryMax[lte]` | Maximum salary filter |
| `sortBy`, `sortOrder` | Sorting |
| `page`, `limit` | Pagination |

### 8. Notification System (Email + In-App)

**In-app notifications** are created for:
- Application submitted (to recruiter)
- Application status changes (to applicant)
- Coin credited/debited
- Recruiter approved/rejected
- Job posted
- Subscription purchase

**Email notifications** are sent for:
- Application submitted
- Application status changes (shortlisted, interview, hired, rejected)
- Recruiter account approved/rejected
- Email verification OTP
- Password reset OTP

---

## API Endpoints

### Authentication — `/api/v1/auth`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register a new user |
| POST | `/login` | Login |
| GET | `/me` | Get current user profile |
| POST | `/refresh-token` | Refresh access token |
| POST | `/change-password` | Change password |
| POST | `/logout` | Logout |
| POST | `/verify-email` | Verify email with OTP |
| POST | `/forget-password` | Request password reset OTP |
| POST | `/reset-password` | Reset password with OTP |
| GET | `/login/google` | Google OAuth login |

### Users — `/api/v1/users`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/create-recruiter` | Create recruiter account (Admin) |

### Recruiters — `/api/v1/recruiters`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all recruiters |
| GET | `/my-profile` | Get my recruiter profile |
| GET | `/:id` | Get recruiter by ID |
| PATCH | `/update-my-profile` | Update my profile |
| PATCH | `/:id` | Update recruiter (Admin) |
| DELETE | `/:id` | Delete recruiter (Admin) |
| PATCH | `/approve/:id` | Approve recruiter (Admin) |
| PATCH | `/reject/:id` | Reject recruiter (Admin) |

### Jobs — `/api/v1/jobs`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create job (Recruiter, requires APPROVED status) |
| GET | `/` | Get all active jobs (public, with filters) |
| GET | `/my-jobs` | Get my posted jobs (Recruiter) |
| GET | `/categories` | Get all job categories |
| POST | `/categories` | Create category (Admin) |
| DELETE | `/categories/:id` | Delete category (Admin) |
| GET | `/:id` | Get job by ID |
| PATCH | `/:id` | Update job |
| DELETE | `/:id` | Delete job |

### Applications — `/api/v1/applications`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/apply` | Apply for job (requires completed resume) |
| GET | `/my-applications` | Get my applications |
| GET | `/all` | Get all applications (Admin) |
| GET | `/job/:jobId` | Get applications for a job (Recruiter) |
| PATCH | `/status/:id` | Update application status (validated lifecycle) |

### Resumes — `/api/v1/resumes`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/my-resume` | Get my resume |
| PATCH | `/my-resume` | Create/update my resume |
| GET | `/search-candidates` | Search candidates with filters (Recruiter) |
| GET | `/user/:userId` | View candidate resume (costs 10 coins for Recruiter) |
| GET | `/view-recruiter-email/:recruiterId` | View recruiter email (costs 15 coins) |

### Wallet — `/api/v1/wallet`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get my wallet |
| GET | `/transactions` | Get transaction history |

### Subscriptions — `/api/v1/subscriptions`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/plans` | Get subscription plans and coin costs |
| POST | `/purchase` | Purchase a subscription (Stripe checkout) |
| GET | `/my-subscriptions` | Get my subscription history |

### Coupons — `/api/v1/coupons`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create coupon with maxUsage (Admin) |
| GET | `/` | Get all coupons (Admin) |
| DELETE | `/:id` | Delete coupon (Admin) |
| POST | `/gift-voucher` | Create gift voucher with maxUsage (Admin) |
| GET | `/gift-vouchers` | Get all gift vouchers (Admin) |
| DELETE | `/gift-voucher/:id` | Delete gift voucher (Admin) |
| POST | `/redeem` | Redeem coupon code |
| POST | `/redeem-gift-voucher` | Redeem gift voucher code |

### Notifications — `/api/v1/notifications`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get my notifications |
| GET | `/unread-count` | Get unread notification count |
| PATCH | `/read/:id` | Mark notification as read |
| PATCH | `/read-all` | Mark all as read |
| DELETE | `/:id` | Delete notification |

### Admin — `/api/v1/admins`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all admins |
| GET | `/jobs` | Get all jobs (including deleted) |
| GET | `/:id` | Get admin by ID |
| PATCH | `/:id` | Update admin (Super Admin) |
| DELETE | `/:id` | Delete admin (Super Admin) |
| PATCH | `/change-user-status` | Block/unblock user |
| PATCH | `/change-user-role` | Change user role (Super Admin) |

### Stats — `/api/v1/stats`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Get role-based dashboard statistics |

### Payments — `/api/v1/payments`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook` | Stripe webhook handler |

---

## Database Schema

### Enums

- **Role:** SUPER_ADMIN, ADMIN, RECRUITER, USER
- **RecruiterStatus:** PENDING, APPROVED, REJECTED
- **JobStatus:** ACTIVE, CLOSED, DRAFT
- **JobType:** FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP, REMOTE
- **ApplicationStatus:** PENDING, SHORTLISTED, INTERVIEW, HIRED, REJECTED
- **TransactionPurpose:** APPLY_JOB, VIEW_RECRUITER_EMAIL, POST_JOB, VIEW_CANDIDATE, SUBSCRIPTION_PURCHASE, COUPON_REDEEM, GIFT_VOUCHER_REDEEM, ADMIN_ADJUSTMENT
- **NotificationType:** APPLICATION_SUBMITTED, APPLICATION_SHORTLISTED, APPLICATION_INTERVIEW, APPLICATION_HIRED, APPLICATION_REJECTED, RECRUITER_APPROVED, RECRUITER_REJECTED, JOB_POSTED, COIN_CREDITED, COIN_DEBITED, GENERAL

---

## Error Handling

- **Global error handler** catches all unhandled errors
- Prisma errors mapped to meaningful HTTP responses
- Zod validation errors formatted with field-level details
- Custom `AppError` class for business logic errors
- Response format:
  ```json
  {
    "success": false,
    "message": "Error description",
    "errorSources": [{ "path": "field", "message": "detail" }]
  }
  ```

---

## Deployment

- Host on **Render** or **Railway**
- Set all environment variables (see `.env.example`)
- Run `npx prisma migrate deploy` before deployment
- Seed initial data: `npx prisma db seed`
