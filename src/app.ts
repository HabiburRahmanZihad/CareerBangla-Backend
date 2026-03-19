import { toNodeHandler } from "better-auth/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import path from "path";
import qs from "qs";
import { envVars } from "./app/config/env";
import { auth } from "./app/lib/auth";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { IndexRoutes } from "./app/routes";

const app: Application = express();
app.set("query parser", (str: string) => qs.parse(str));

app.set("view engine", "ejs");
app.set("views", path.resolve(process.cwd(), `src/app/templates`))

// CORS Configuration - Production Ready
const allowedOrigins = [
    envVars.FRONTEND_URL,
    envVars.BETTER_AUTH_URL,
    ...(process.env.NODE_ENV === 'development' ? ["http://localhost:3000", "http://localhost:5000"] : [])
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
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware to parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Better-auth handles its own routes (/api/auth/*)
app.use("/api/auth", toNodeHandler(auth))

app.use("/api/v1", IndexRoutes);

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
