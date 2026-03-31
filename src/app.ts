import { toNodeHandler } from "better-auth/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import path from "path";
import qs from "qs";
import { envVars } from "./app/config/env";
import { auth } from "./app/lib/auth";
import { cacheClearEndpoint, cacheMonitorMiddleware, cacheStatsEndpoint } from "./app/lib/cache/cache.middleware";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { apiRateLimiter } from "./app/middleware/rateLimiter";
import { IndexRoutes } from "./app/routes";

const app: Application = express();

// Render sits behind a reverse proxy and forwards client IP information.
// express-rate-limit relies on this to identify users correctly in production.
app.set("trust proxy", 1);

// Security headers
app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.removeHeader("X-Powered-By");
    next();
});

app.set("query parser", (str: string) => qs.parse(str));

app.set("view engine", "ejs");
app.set("views", path.resolve(process.cwd(), `src/app/templates`))

// EXTERNAL WEBHOOK/IPN ROUTES — must be registered BEFORE CORS
import { SubscriptionController } from "./app/module/subscription/subscription.controller";
import { SubscriptionService } from "./app/module/subscription/subscription.service";
import { logger } from "./app/utils/logger";
app.post("/api/v1/subscriptions/ipn", express.urlencoded({ extended: true }), SubscriptionController.handleIpn);
// Browser redirect endpoints after SSLCommerz payment (POST redirects from payment gateway).
// Also process the payment here as a fallback in case the IPN is delayed or unreachable (e.g. localhost dev).
app.post("/api/v1/subscriptions/success", express.urlencoded({ extended: true }), async (req, res) => {
    const base = req.query.role === "RECRUITER" ? "/recruiter/dashboard/subscriptions" : "/dashboard/subscriptions";
    try {
        await SubscriptionService.handleIpn(req.body);
    } catch (err) {
        logger.error("Payment processing in success redirect failed", err);
    }
    res.redirect(`${envVars.FRONTEND_URL}${base}?payment=success`);
});
app.post("/api/v1/subscriptions/fail", express.urlencoded({ extended: true }), (req, res) => {
    const base = req.query.role === "RECRUITER" ? "/recruiter/dashboard/subscriptions" : "/dashboard/subscriptions";
    res.redirect(`${envVars.FRONTEND_URL}${base}?payment=failed`);
});
app.post("/api/v1/subscriptions/cancel", express.urlencoded({ extended: true }), (req, res) => {
    const base = req.query.role === "RECRUITER" ? "/recruiter/dashboard/subscriptions" : "/dashboard/subscriptions";
    res.redirect(`${envVars.FRONTEND_URL}${base}?payment=cancelled`);
});

// CORS Configuration - Production Ready
const allowedOrigins = [
    envVars.FRONTEND_URL,
    envVars.BETTER_AUTH_URL,
    ...(envVars.NODE_ENV === 'development' ? ["http://localhost:3000", "http://localhost:5000"] : [])
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS policy violation'));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["X-Session-Refresh", "X-Session-Expires-At", "X-Time-Remaining"],
    maxAge: 3600, // 1 hour
}))

// Parse cookies before any route handlers
app.use(cookieParser())

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Middleware to parse JSON bodies
app.use(express.json({ limit: '2mb' }));

// Cache monitoring middleware - adds cache stats to response headers
app.use(cacheMonitorMiddleware);

// Better-auth handles its own routes (/api/auth/*)
app.use("/api/auth", toNodeHandler(auth))

// Cache admin endpoints
app.get('/api/v1/admin/cache/stats', cacheStatsEndpoint);
app.post('/api/v1/admin/cache/clear', cacheClearEndpoint);

app.use("/api/v1", apiRateLimiter, IndexRoutes);

// Basic route - health check
app.get('/', async (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        message: 'CareerBangla API is running',
        timestamp: new Date().toISOString(),
    })
});

// Global error handlers (must be last)
app.use(globalErrorHandler)
app.use(notFound)

export default app;
