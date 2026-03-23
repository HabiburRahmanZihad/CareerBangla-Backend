import { NextFunction, Request, Response } from "express";
import status from "http-status";
import { Role, UserStatus } from "../../generated/prisma/enums";
import AppError from "../errorHelpers/AppError";
import { auth } from "../lib/auth";
import { CookieUtils } from "../utils/cookie";
import { logger } from "../utils/logger";

export const checkAuth = (...authRoles: Role[]) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Session Token Verification
        const sessionToken = CookieUtils.getCookie(req, "better-auth.session_token");

        logger.auth("Session token check", { present: !!sessionToken });

        if (!sessionToken) {
            throw new AppError(status.UNAUTHORIZED, "Unauthorized access! No session token provided.");
        }

        // Use better-auth's getSession to validate the token.
        // Pass both cookie and authorization headers so the bearer() plugin
        // can convert the raw token into a properly signed cookie.
        const reqHeaders = new Headers({
            cookie: req.headers.cookie || ""
        });
        // Forward Authorization header so the bearer plugin can sign the token
        if (req.headers.authorization) {
            reqHeaders.set("authorization", req.headers.authorization);
        } else if (sessionToken) {
            // If no Authorization header but we have the raw session token,
            // send it as Bearer so the bearer plugin can sign it properly
            reqHeaders.set("authorization", `Bearer ${sessionToken}`);
        }

        const sessionData = await auth.api.getSession({
            headers: reqHeaders
        });

        logger.auth("Session validation", { valid: !!sessionData });

        if (!sessionData || !sessionData.user) {
            throw new AppError(status.UNAUTHORIZED, "Unauthorized access! Invalid or expired session.");
        }

        const user = sessionData.user;
        const session = sessionData.session;

        // Session expiry warning headers
        const now = new Date();
        const expiresAt = new Date(session.expiresAt);
        const createdAt = new Date(session.createdAt);

        const sessionLifeTime = expiresAt.getTime() - createdAt.getTime();
        const timeRemaining = expiresAt.getTime() - now.getTime();
        const percentRemaining = (timeRemaining / sessionLifeTime) * 100;

        if (percentRemaining < 20) {
            res.setHeader("X-Session-Refresh", "true");
            res.setHeader("X-Session-Expires-At", expiresAt.toISOString());
            res.setHeader("X-Time-Remaining", timeRemaining.toString());
        }

        if (user.status === UserStatus.BLOCKED || user.status === UserStatus.DELETED) {
            throw new AppError(status.UNAUTHORIZED, "Unauthorized access! User is not active.");
        }

        if (user.isDeleted) {
            throw new AppError(status.UNAUTHORIZED, "Unauthorized access! User is deleted.");
        }

        if (authRoles.length > 0 && !authRoles.includes(user.role as Role)) {
            throw new AppError(status.FORBIDDEN, "Forbidden access! You do not have permission to access this resource.");
        }

        // Set user context from the authoritative session source
        req.user = {
            userId: user.id,
            role: user.role as Role,
            email: user.email,
        };

        next();
    } catch (error) {
        logger.error("Auth middleware error", error);
        next(error);
    }
};
