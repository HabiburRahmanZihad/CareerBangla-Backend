# CareerBangla Backend Documentation

## Project Overview

The backend of **CareerBangla** is built with **Node.js, Express.js, Prisma ORM, and PostgreSQL**.
It provides REST APIs for authentication, user & recruiter management, job posting, application management, resume/ATS profiles, a coin-based credit system, subscription plans, coupons/gift vouchers, and admin control.

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Authentication:** JWT (access + refresh tokens)
- **Password Hashing:** bcrypt
- **Payments:** Stripe
- **Email Service:** Nodemailer
- **Deployment:** Render / Railway

---

## Folder Structure

The project follows a **modular folder structure** (same architecture as the previous healthcare project, adapted for job portal modules).

```
src/
├── app/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── auth.validation.ts
│   │   ├── user/
│   │   ├── recruiter/
│   │   ├── job/
│   │   ├── jobCategory/
│   │   ├── application/
│   │   ├── resume/
│   │   ├── wallet/
│   │   ├── subscription/
│   │   ├── coupon/
│   │   ├── giftVoucher/
│   │   ├── notification/
│   │   └── admin/
│   ├── middlewares/
│   │   ├── auth.ts
│   │   ├── globalErrorHandler.ts
│   │   └── validateRequest.ts
│   ├── errors/
│   ├── helpers/
│   ├── interfaces/
│   └── shared/
├── config/
│   └── index.ts
├── app.ts
└── server.ts
```

Each module contains its own **controller, service, routes, and validation** files for clean separation of concerns.

---

## Database Main Models

| Model        | Description                                                            |
| ------------ | ---------------------------------------------------------------------- |
| User         | Job seekers who register and apply for jobs                            |
| Recruiter    | Company representatives who post jobs and manage applicants            |
| Job          | Job listings posted by recruiters                                      |
| JobCategory  | Categories for organizing jobs (e.g., Software Engineering, Marketing) |
| Application  | Job applications submitted by users                                    |
| Resume       | User resumes / ATS profiles with skills, education, and experience     |
| CoinWallet   | Coin balance and transaction history for the credit system             |
| Subscription | Subscription plans and user subscriptions                              |
| Coupon       | Discount coupons for subscription purchases                            |
| GiftVoucher  | Redeemable vouchers that add coins to user wallets                     |
| Notification | Email and in-app notifications for application status updates          |

---

## Authentication Flow

1. User registers with email, name, and password
2. Email verification via OTP
3. Password is hashed using **bcrypt** before storing
4. JWT **access token** and **refresh token** generated on login
5. Access token sent in Authorization header; refresh token stored in HTTP-only cookie
6. Protected routes require authentication middleware
7. Forgot password flow: request OTP → verify OTP → reset password

---

## Role Based Access Control (RBAC)

| Role            | Permissions                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| **User**        | Register, login, apply for jobs, manage resume, view wallet, redeem vouchers                            |
| **Recruiter**   | Post jobs, view applicants, change application status, manage job listings                              |
| **Admin**       | Full system control — manage users, recruiters, job categories, coupons, subscriptions, dashboard stats |
| **Super Admin** | All admin permissions plus system-level configuration                                                   |

---

## API Endpoints

### Authentication

| Method | Endpoint                       | Description                                 |
| ------ | ------------------------------ | ------------------------------------------- |
| POST   | `/api/v1/auth/register`        | Register a new user                         |
| POST   | `/api/v1/auth/login`           | Login (returns access + refresh tokens)     |
| GET    | `/api/v1/auth/me`              | Get current logged-in user profile          |
| POST   | `/api/v1/auth/refresh-token`   | Refresh the access token                    |
| POST   | `/api/v1/auth/change-password` | Change password (requires current password) |
| POST   | `/api/v1/auth/logout`          | Logout and invalidate refresh token         |
| POST   | `/api/v1/auth/verify-email`    | Verify email with OTP                       |
| POST   | `/api/v1/auth/forget-password` | Request password reset OTP                  |
| POST   | `/api/v1/auth/reset-password`  | Reset password with OTP                     |
| GET    | `/api/v1/auth/login/google`    | Google OAuth login                          |

### Users

| Method | Endpoint                         | Description                            |
| ------ | -------------------------------- | -------------------------------------- |
| POST   | `/api/v1/users/create-recruiter` | Create a new recruiter account (Admin) |

### Recruiters

| Method | Endpoint             | Description                                              |
| ------ | -------------------- | -------------------------------------------------------- |
| GET    | `/api/v1/recruiters` | Get all recruiters (with filtering, pagination, sorting) |

### Job Categories

| Method | Endpoint                     | Description                   |
| ------ | ---------------------------- | ----------------------------- |
| POST   | `/api/v1/job-categories`     | Create a job category (Admin) |
| GET    | `/api/v1/job-categories`     | Get all job categories        |
| DELETE | `/api/v1/job-categories/:id` | Delete a job category (Admin) |

### Jobs

| Method | Endpoint               | Description                                    |
| ------ | ---------------------- | ---------------------------------------------- |
| POST   | `/api/v1/jobs`         | Create a new job posting (Recruiter)           |
| GET    | `/api/v1/jobs`         | Get all jobs (with search, filter, pagination) |
| GET    | `/api/v1/jobs/:id`     | Get a single job by ID                         |
| PATCH  | `/api/v1/jobs/:id`     | Update a job posting (Recruiter)               |
| DELETE | `/api/v1/jobs/:id`     | Delete a job posting (Recruiter/Admin)         |
| GET    | `/api/v1/jobs/my-jobs` | Get jobs posted by the logged-in recruiter     |

### Applications

| Method | Endpoint                                             | Description                                         |
| ------ | ---------------------------------------------------- | --------------------------------------------------- |
| POST   | `/api/v1/applications/submit-application`            | Submit a job application (User)                     |
| GET    | `/api/v1/applications/my-applications`               | Get logged-in user's applications                   |
| GET    | `/api/v1/applications/my-single-application/:id`     | Get a single application detail                     |
| GET    | `/api/v1/applications/all-applications`              | Get all applications (Admin)                        |
| PATCH  | `/api/v1/applications/change-application-status/:id` | Change application status (Recruiter)               |
| GET    | `/api/v1/applications/job/:jobId`                    | Get all applications for a specific job (Recruiter) |

### Resume / ATS Profile

| Method | Endpoint                    | Description                                 |
| ------ | --------------------------- | ------------------------------------------- |
| POST   | `/api/v1/resumes`           | Create a resume                             |
| GET    | `/api/v1/resumes/my-resume` | Get logged-in user's resume                 |
| PATCH  | `/api/v1/resumes/my-resume` | Update resume                               |
| DELETE | `/api/v1/resumes/my-resume` | Delete resume                               |
| POST   | `/api/v1/resumes/ats-score` | Check ATS compatibility score against a job |

### Wallet / Coins

| Method | Endpoint                              | Description                       |
| ------ | ------------------------------------- | --------------------------------- |
| GET    | `/api/v1/wallet/my-wallet`            | Get wallet balance                |
| POST   | `/api/v1/wallet/add-coins`            | Add coins to wallet (via payment) |
| GET    | `/api/v1/wallet/transactions`         | Get transaction history           |
| POST   | `/api/v1/wallet/initiate-payment/:id` | Initiate a payment transaction    |

### Subscriptions

| Method | Endpoint                                | Description                        |
| ------ | --------------------------------------- | ---------------------------------- |
| GET    | `/api/v1/subscriptions/plans`           | Get all subscription plans         |
| POST   | `/api/v1/subscriptions/plans`           | Create a subscription plan (Admin) |
| POST   | `/api/v1/subscriptions/subscribe`       | Subscribe to a plan                |
| GET    | `/api/v1/subscriptions/my-subscription` | Get current subscription status    |
| POST   | `/api/v1/subscriptions/cancel`          | Cancel active subscription         |

### Coupons / Gift Vouchers

| Method | Endpoint                       | Description                   |
| ------ | ------------------------------ | ----------------------------- |
| POST   | `/api/v1/coupons`              | Create a coupon (Admin)       |
| GET    | `/api/v1/coupons`              | Get all coupons               |
| POST   | `/api/v1/coupons/apply`        | Apply a coupon code           |
| DELETE | `/api/v1/coupons/:id`          | Delete a coupon (Admin)       |
| POST   | `/api/v1/gift-vouchers`        | Create a gift voucher (Admin) |
| POST   | `/api/v1/gift-vouchers/redeem` | Redeem a gift voucher         |

### Admin

| Method | Endpoint                              | Description                    |
| ------ | ------------------------------------- | ------------------------------ |
| GET    | `/api/v1/admin/users`                 | Get all users (with filtering) |
| PATCH  | `/api/v1/admin/users/:id/status`      | Block/unblock a user           |
| DELETE | `/api/v1/admin/users/:id`             | Delete a user                  |
| PATCH  | `/api/v1/admin/recruiters/:id/verify` | Verify a recruiter             |
| GET    | `/api/v1/admin/dashboard`             | Get dashboard statistics       |

---

## Credit System

| Action                          | Coins Required |
| ------------------------------- | -------------- |
| Apply for a Job                 | 10             |
| View Recruiter Email            | 15             |
| Post a Job (Recruiter)          | 15             |
| View Candidate Profile Manually | 10             |

- Every new user receives a **welcome bonus** of coins upon registration
- Coins can be purchased via the Wallet system or earned through gift vouchers
- Coin transactions are logged in the wallet transaction history

---

## Subscription System

- **Plans** are created by Admin with name, price, duration, and feature list
- Users and recruiters can subscribe to plans for premium features
- Payments are handled via **Stripe**
- Coupons can be applied for discounts during subscription purchase
- Subscription status can be checked and cancelled at any time

---

## Email Notifications

Users receive email notifications (via **Nodemailer**) when:

- Account registration (welcome email)
- Email verification OTP sent
- Password reset OTP sent
- Application submitted successfully
- Application shortlisted by recruiter
- Interview invitation sent
- Application status changed to hired
- Subscription activated/cancelled

---

## Error Handling

- **Global error handler middleware** catches all unhandled errors
- Input validation using **Zod** schemas before database operations
- Consistent error response format:
  ```json
  {
    "success": false,
    "message": "Error description",
    "errorDetails": {}
  }
  ```
- Custom error classes for `AppError`, `ValidationError`, `NotFoundError`, `UnauthorizedError`

---

## Environment Variables

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/careerbangla
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

---

## Deployment

- Host backend using **Render** or **Railway**
- Use environment variables for all secrets and configuration
- Ensure **Prisma database migrations** are applied before deployment:
  ```bash
  npx prisma migrate deploy
  ```
- Seed initial data (admin user, default subscription plans) if needed:
  ```bash
  npx prisma db seed
  ```
