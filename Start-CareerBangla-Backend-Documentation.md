# CareerBangla Backend Documentation

## Project Overview

The backend of **CareerBangla** is built with **Node.js, Express.js, Prisma ORM, and PostgreSQL**.  
It provides REST APIs for authentication, job management, application management, credit systems, subscription payments, and admin control.

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Authentication:** JWT
- **Password Hashing:** bcrypt
- **Payments:** Stripe
- **Email Service:** Nodemailer
- **Deployment:** Render

---

## Folder Structure Example

The project follows the **same folder structure used in the previous healthcare project**.

Since the architecture was already designed with **modularity and reusability in mind**, the same structure will be reused for this job portal project.

This approach ensures:

- Code consistency across projects
- Faster development using reusable modules
- Easier maintenance and scalability

Therefore, developers should **follow the existing project structure from the previous project** when implementing this system.

> **Note:**  
> Instead of creating a completely new structure,  
> we will reuse the existing architecture and replace  
> the healthcare-specific modules with job portal modules.

---

## Database Main Models

- User
- Recruiter
- Job
- Application
- CoinWallet
- Subscription
- Coupon
- GiftVoucher
- Notification
- Resume

---

## Authentication Flow

1. User registers
2. Password is hashed using **bcrypt**
3. JWT token generated on login
4. Protected routes require authentication middleware

---

## Role Based Access Control (RBAC)

- **User:** Apply for jobs
- **Recruiter:** Post jobs and manage applicants
- **Admin:** Full system control

---

## Main API Endpoints

### Authentication
POST /api/auth/register
POST /api/auth/login
GET /api/auth/me


### Jobs


GET /api/jobs
GET /api/jobs/:id
POST /api/jobs
PATCH /api/jobs/:id
DELETE /api/jobs/:id


### Applications


POST /api/applications
GET /api/applications/user
GET /api/applications/recruiter


---

## Credit System

| Action | Coins |
|------|------|
| Apply Job | 10 |
| View Recruiter Email | 15 |
| Post Job | 15 |
| View Candidate Manually | 10 |

---

## Subscription System

- Users can buy coin packages  
- Payments handled via **Stripe**  
- Coupons can apply discounts  

---

## Email Notifications

Users receive email notifications when:

- Application submitted  
- Application shortlisted  
- Interview invitation sent  
- Application hired  

---

## Error Handling

- Use **global error handler middleware**  
- Validate input before database operations  
- Return meaningful error messages  

---

## Deployment

- Host backend using **Render** or **Railway**
- Use environment variables for:
  - Database connection
  - JWT secret
  - Stripe keys
- Ensure **database migrations** are applied before deployment