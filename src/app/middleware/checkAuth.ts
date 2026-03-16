import { NextFunction, Request, Response } from "express";
import status from "http-status";
import { Role, UserStatus } from "../../generated/prisma/enums";
import AppError from "../errorHelpers/AppError";
import { prisma } from "../lib/prisma";
import { CookieUtils } from "../utils/cookie";

export const checkAuth = (...authRoles: Role[]) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Session Token Verification
        const sessionToken = CookieUtils.getCookie(req, "better-auth.session_token");

        if (!sessionToken) {
            throw new AppError(status.UNAUTHORIZED, "Unauthorized access! No session token provided.");
        }

        const sessionExists = await prisma.session.findFirst({
            where: {
                token: sessionToken,
                expiresAt: {
                    gt: new Date(),
                }
            },
            include: {
                user: true,
            }
        });

        if (!sessionExists || !sessionExists.user) {
            throw new AppError(status.UNAUTHORIZED, "Unauthorized access! Invalid or expired session.");
        }

        const user = sessionExists.user;

        // Session expiry warning headers
        const now = new Date();
        const expiresAt = new Date(sessionExists.expiresAt);
        const createdAt = new Date(sessionExists.createdAt);

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

        if (authRoles.length > 0 && !authRoles.includes(user.role)) {
            throw new AppError(status.FORBIDDEN, "Forbidden access! You do not have permission to access this resource.");
        }

        // Set user context from the authoritative session source
        req.user = {
            userId: user.id,
            role: user.role,
            email: user.email,
        };

        next();
    } catch (error) {
        next(error);
    }
};
