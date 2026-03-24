import status from "http-status";
import jwt, { JwtPayload } from "jsonwebtoken";
import { UserStatus } from "../../../generated/prisma/enums";
import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import { logger } from "../../utils/logger";
import { tokenUtils } from "../../utils/token";
import { IChangePasswordPayload, IForgetPasswordPayload, ILoginUserPayload, IRegisterUserPayload, IUpdateProfilePayload } from "./auth.interface";
import crypto from "crypto";

const MAX_DEVICES = 2;

/** Build the token payload from a user record — single source of truth */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildTokenPayload = (user: { id: string; role: string; name: string; email: string; status: string; isDeleted: boolean; emailVerified: boolean } & Record<string, any>) => ({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    status: user.status,
    isDeleted: user.isDeleted,
    emailVerified: user.emailVerified,
});

/** Generate access + refresh token pair for a user */
const generateTokenPair = (user: Parameters<typeof buildTokenPayload>[0]) => {
    const payload = buildTokenPayload(user);
    return {
        accessToken: tokenUtils.getAccessToken(payload),
        refreshToken: tokenUtils.getRefreshToken(payload),
    };
};

/** Extract expiry Date from a JWT token */
const getTokenExpiry = (token: string): Date | null => {
    try {
        const decoded = jwt.decode(token) as JwtPayload;
        if (decoded?.exp) {
            return new Date(decoded.exp * 1000);
        }
    } catch {
        // ignore decode errors
    }
    return null;
};

/** Store access & refresh tokens in the session record */
const storeTokensInSession = async (sessionToken: string | null | undefined, userId: string, accessToken: string, refreshToken: string) => {
    try {
        const accessTokenExpiresAt = getTokenExpiry(accessToken);
        const refreshTokenExpiresAt = getTokenExpiry(refreshToken);

        let session = null;

        // Try lookup by exact token first
        if (sessionToken) {
            session = await prisma.session.findFirst({ where: { token: sessionToken } });
        }

        // Fallback: find the most recent session for this user
        if (!session) {
            session = await prisma.session.findFirst({
                where: { userId },
                orderBy: { createdAt: "desc" },
            });
        }

        if (!session) {
            logger.error(`storeTokensInSession: no session found → userId: ${userId}`);
            return;
        }

        await prisma.session.update({
            where: { id: session.id },
            data: {
                accessToken,
                accessTokenExpiresAt,
                refreshToken,
                refreshTokenExpiresAt,
            },
        });
        logger.auth(`Tokens stored in session → sessionId: ${session.id}`);
    } catch (error) {
        logger.error("storeTokensInSession failed", error);
    }
};

/** Count active (non-expired) sessions for a user */
const countActiveSessions = async (userId: string): Promise<number> => {
    return prisma.session.count({
        where: {
            userId,
            expiresAt: { gt: new Date() },
        },
    });
};

const generateUniqueReferralCode = async (name?: string | null): Promise<string> => {
    const prefix = name
        ? name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, "").padEnd(2, "X")
        : "USER";

    for (let attempt = 0; attempt < 10; attempt++) {
        const suffix = crypto.randomInt(100000, 999999).toString();
        const code = `${prefix}${suffix}`;

        const existing = await prisma.user.findUnique({
            where: { referralCode: code },
            select: { id: true },
        });

        if (!existing) return code;
    }

    // Fallback: fully random code
    const fallback = `REF${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    return fallback;
};

const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;

const registerUser = async (payload: IRegisterUserPayload) => {
    logger.create(`User registration requested → email: ${payload.email}`);
    const { name, email, phone, password, referralCode: incomingReferralCode } = payload;

    // Validate phone format
    if (!BD_PHONE_REGEX.test(phone)) {
        throw new AppError(status.BAD_REQUEST, "Enter a valid 11-digit Bangladeshi phone number starting with 01");
    }

    // Check phone uniqueness before registration
    const existingPhone = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (existingPhone) {
        throw new AppError(status.BAD_REQUEST, "Phone number is already registered");
    }

    const data = await auth.api.signUpEmail({
        body: {
            name,
            email,
            password,
        }
    })

    logger.create(`User registered via better-auth → userId: ${data.user?.id}`);

    if (!data.user) {
        throw new AppError(status.BAD_REQUEST, "Failed to register user");
    }

    try {
        // Generate a unique referral code for the new user
        const referralCode = await generateUniqueReferralCode(data.user.name);

        // Validate incoming referral code if provided
        let validReferredBy: string | undefined;
        if (incomingReferralCode) {
            const referrer = await prisma.user.findUnique({
                where: { referralCode: incomingReferralCode },
                select: { id: true },
            });
            if (referrer && referrer.id !== data.user.id) {
                validReferredBy = incomingReferralCode;
            }
        }

        await prisma.$transaction(async (tx) => {
            // Update user with referral code, referredBy, and phone
            await tx.user.update({
                where: { id: data.user.id },
                data: {
                    referralCode,
                    phone,
                    ...(validReferredBy ? { referredBy: validReferredBy } : {}),
                },
            });

            // Create initial ReferralHistory entry (hasPaid = false until they purchase)
            if (validReferredBy) {
                const referrer = await tx.user.findUnique({
                    where: { referralCode: validReferredBy },
                    select: { id: true },
                });
                if (referrer) {
                    await tx.referralHistory.create({
                        data: {
                            referrerId: referrer.id,
                            referredUserId: data.user.id,
                            hasPaid: false,
                        },
                    });
                }
            }

            await tx.notification.create({
                data: {
                    userId: data.user.id,
                    type: "GENERAL",
                    title: "Welcome to CareerBangla!",
                    message: "Your account has been created successfully. Note down your referral code to invite friends and earn Premium!",
                }
            })
        });

        const { accessToken, refreshToken } = generateTokenPair(data.user);

        // Store tokens in the session record
        await storeTokensInSession(data.token, data.user.id, accessToken, refreshToken);

        logger.create(`User registration complete → userId: ${data.user.id}, email: ${email}`);

        return {
            user: data.user,
            token: data.token,
            accessToken,
            refreshToken,
        }

    } catch (error) {
        logger.error(`Failed to register user → email: ${email}`, error);
        await prisma.user.delete({
            where: {
                id: data.user.id
            }
        })
        throw error;
    }

}


const loginUser = async (payload: ILoginUserPayload) => {
    logger.read(`Login attempt → identifier: ${payload.identifier}`);
    const { identifier, password, logoutAllDevices } = payload;

    // Detect if identifier is a phone number or email
    let email: string;
    if (BD_PHONE_REGEX.test(identifier)) {
        const userByPhone = await prisma.user.findUnique({
            where: { phone: identifier },
            select: { email: true },
        });
        if (!userByPhone) {
            throw new AppError(status.NOT_FOUND, "No account found with this phone number");
        }
        email = userByPhone.email;
    } else {
        email = identifier;
    }

    // Check device limit before creating a new session
    const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });

    if (existingUser) {
        const activeSessions = await countActiveSessions(existingUser.id);

        if (activeSessions >= MAX_DEVICES) {
            if (logoutAllDevices) {
                // User chose to logout from all devices — clear all sessions
                await prisma.session.deleteMany({
                    where: { userId: existingUser.id },
                });
                logger.update(`All sessions cleared for user → userId: ${existingUser.id}`);
            } else {
                throw new AppError(
                    status.CONFLICT,
                    `You are already logged in on ${MAX_DEVICES} devices. Please logout from all devices to continue.`
                ).setData({ code: "DEVICE_LIMIT_EXCEEDED", activeSessions });
            }
        }
    }

    const data = await auth.api.signInEmail({
        body: {
            email,
            password,
        }
    })

    logger.read(`Login successful → userId: ${data.user?.id}`);

    if (data.user.status === UserStatus.BLOCKED) {
        throw new AppError(status.FORBIDDEN, "User is blocked");
    }

    if (data.user.isDeleted || data.user.status === UserStatus.DELETED) {
        throw new AppError(status.NOT_FOUND, "User is deleted");
    }

    // Check if email is verified
    if (!data.user.emailVerified) {
        throw new AppError(status.UNAUTHORIZED, "Email not verified").setData({ email: data.user.email });
    }

    const { accessToken, refreshToken } = generateTokenPair(data.user);

    // Store tokens in the session record
    await storeTokensInSession(data.token, data.user.id, accessToken, refreshToken);

    return {
        user: data.user,
        token: data.token,
        accessToken,
        refreshToken,
    };

}

const getMe = async (user: IRequestUser) => {
    logger.read(`Fetching user profile → userId: ${user.userId}`);
    const isUserExists = await prisma.user.findUnique({
        where: {
            id: user.userId,
        },
        include: {
            recruiter: {
                select: {
                    id: true,
                    name: true,
                    companyName: true,
                    companyLogo: true,
                    status: true,
                    designation: true,
                    _count: { select: { jobs: { where: { isDeleted: false } } } },
                }
            },
            admin: { select: { id: true, name: true, email: true } },
            resume: { select: { id: true, profilePhoto: true, professionalTitle: true, profileCompletedAt: true } },
            applications: {
                select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    job: {
                        select: {
                            id: true,
                            title: true,
                            recruiter: {
                                select: { id: true, companyName: true, companyLogo: true }
                            },
                        }
                    },
                },
                orderBy: { createdAt: "desc" },
                take: 10,
            },
        }
    })

    if (!isUserExists) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    return isUserExists;
}

const getNewToken = async (refreshToken: string, sessionToken?: string) => {
    logger.read("Token refresh requested");
    if (!sessionToken) {
        throw new AppError(status.UNAUTHORIZED, "Session token is missing");
    }

    const isSessionTokenExists = await prisma.session.findUnique({
        where: {
            token: sessionToken,
        },
        include: {
            user: true,
        }
    });

    if (!isSessionTokenExists) {
        throw new AppError(status.UNAUTHORIZED, "Invalid session token");
    }

    const verifiedRefreshToken = jwtUtils.verifyToken(refreshToken, envVars.REFRESH_TOKEN_SECRET)

    if (!verifiedRefreshToken.success && verifiedRefreshToken.error) {
        throw new AppError(status.UNAUTHORIZED, "Invalid refresh token");
    }

    const user = isSessionTokenExists.user;

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokenPair(user);

    const accessTokenExpiresAt = getTokenExpiry(newAccessToken);
    const refreshTokenExpiresAt = getTokenExpiry(newRefreshToken);

    const { token } = await prisma.session.update({
        where: {
            token: sessionToken
        },
        data: {
            token: sessionToken,
            expiresAt: new Date(Date.now() + 60 * 60 * 24 * 1000),
            updatedAt: new Date(),
            accessToken: newAccessToken,
            accessTokenExpiresAt,
            refreshToken: newRefreshToken,
            refreshTokenExpiresAt,
        }
    });

    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        sessionToken: token,
    }
}

const changePassword = async (payload: IChangePasswordPayload, sessionToken?: string) => {
    logger.update("Password change requested");
    if (!sessionToken) {
        throw new AppError(status.UNAUTHORIZED, "Session token is missing");
    }

    const session = await auth.api.getSession({
        headers: new Headers({
            Authorization: `Bearer ${sessionToken}`
        })
    })

    if (!session) {
        throw new AppError(status.UNAUTHORIZED, "Invalid session token");
    }

    const { currentPassword, newPassword } = payload;

    const result = await auth.api.changePassword({
        body: {
            currentPassword,
            newPassword,
            revokeOtherSessions: true,
        },
        headers: new Headers({
            Authorization: `Bearer ${sessionToken}`
        })
    })

    if (session.user.needPasswordChange) {
        await prisma.user.update({
            where: {
                id: session.user.id,
            },
            data: {
                needPasswordChange: false,
            }
        })
    }

    const { accessToken, refreshToken } = generateTokenPair(session.user);

    // Store fresh tokens in the current session
    if (sessionToken) {
        // After revokeOtherSessions, only the current session remains
        // Find the remaining session for this user to store tokens
        await storeTokensInSession(undefined, session.user.id, accessToken, refreshToken);
    }

    return {
        ...result,
        accessToken,
        refreshToken,
    }
}

const logoutUser = async (sessionToken?: string) => {
    logger.read("Logout requested");
    if (!sessionToken) {
        throw new AppError(status.UNAUTHORIZED, "Session token is missing");
    }

    const result = await auth.api.signOut({
        headers: new Headers({
            Authorization: `Bearer ${sessionToken}`
        })
    })

    return result;
}

const verifyEmail = async (email: string, otp: string) => {
    logger.update(`Email verification requested → email: ${email}`);

    const result = await auth.api.verifyEmailOTP({
        body: {
            email,
            otp,
        }
    })

    if (result.status && !result.user.emailVerified) {
        await prisma.user.update({
            where: {
                email,
            },
            data: {
                emailVerified: true,
            }
        })
    }

    // better-auth user type doesn't include custom fields (role, status, isDeleted) in its TS type
    // but they exist at runtime due to the additionalFields config in auth.ts
    const { accessToken, refreshToken } = generateTokenPair(result.user as unknown as Parameters<typeof buildTokenPayload>[0]);
    const sessionToken = result.token;

    // Store tokens in the session record
    await storeTokensInSession(sessionToken, result.user.id, accessToken, refreshToken);

    return {
        user: result.user,
        token: sessionToken,
        accessToken,
        refreshToken,
    }
}

const resendVerificationEmail = async (email: string) => {
    logger.create(`Resending verification email → email: ${email}`);
    const isUserExist = await prisma.user.findUnique({
        where: { email },
    });

    if (!isUserExist) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    if (isUserExist.emailVerified) {
        throw new AppError(status.BAD_REQUEST, "Email is already verified");
    }

    await auth.api.sendVerificationOTP({
        body: { 
            email, 
            type: "email-verification" 
        },
    });
};

const forgetPassword = async (payload: IForgetPasswordPayload) => {
    logger.read(`Forget password requested → email: ${payload.email}`);
    const { email, phone } = payload;

    const isUserExist = await prisma.user.findUnique({
        where: {
            email,
        }
    })

    if (!isUserExist) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    if (!isUserExist.emailVerified) {
        throw new AppError(status.BAD_REQUEST, "Email not verified");
    }

    if (isUserExist.isDeleted || isUserExist.status === UserStatus.DELETED) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    // Verify the phone number matches the account
    if (isUserExist.phone !== phone) {
        throw new AppError(status.BAD_REQUEST, "Phone number does not match our records");
    }

    await auth.api.requestPasswordResetEmailOTP({
        body: {
            email,
        }
    })
}

const resetPassword = async (email: string, otp: string, newPassword: string) => {
    logger.update(`Password reset requested → email: ${email}`);
    const isUserExist = await prisma.user.findUnique({
        where: {
            email,
        }
    })

    if (!isUserExist) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    if (!isUserExist.emailVerified) {
        throw new AppError(status.BAD_REQUEST, "Email not verified");
    }

    if (isUserExist.isDeleted || isUserExist.status === UserStatus.DELETED) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    await auth.api.resetPasswordEmailOTP({
        body: {
            email,
            otp,
            password: newPassword,
        }
    })

    if (isUserExist.needPasswordChange) {
        await prisma.user.update({
            where: {
                id: isUserExist.id,
            },
            data: {
                needPasswordChange: false,
            }
        })
    }

    await prisma.session.deleteMany({
        where: {
            userId: isUserExist.id,
        }
    })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const googleLoginSuccess = async (session: Record<string, any>) => {
    logger.read(`Google login success → userId: ${session.user?.id}`);
    // Ensure user has a referral code
    const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id }
    })

    if (dbUser && !dbUser.referralCode) {
        const referralCode = await generateUniqueReferralCode(dbUser.name);

        await prisma.user.update({
            where: { id: session.user.id },
            data: { referralCode }
        });
    }

    // Check device limit — the OAuth flow already created a session, so count includes it
    const activeSessions = await countActiveSessions(session.user.id);
    if (activeSessions > MAX_DEVICES) {
        // Delete all sessions EXCEPT the current one, then allow login
        await prisma.session.deleteMany({
            where: {
                userId: session.user.id,
                id: { not: session.session.id },
            },
        });
        logger.update(`Device limit exceeded for Google login, cleared old sessions → userId: ${session.user.id}`);
    }

    const tokens = generateTokenPair(session.user);

    // Store tokens in the session record
    await storeTokensInSession(session.session?.token, session.user.id, tokens.accessToken, tokens.refreshToken);

    return tokens;
}

const updateProfile = async (user: IRequestUser, payload: IUpdateProfilePayload) => {
    logger.update(`Profile update requested → userId: ${user.userId}`, { fields: Object.keys(payload) });
    const updateData: Record<string, string> = {};

    if (payload.name) {
        updateData.name = payload.name;
    }

    if (payload.phone !== undefined) {
        // Check if phone is already taken by another user
        if (payload.phone) {
            const existingUser = await prisma.user.findUnique({
                where: { phone: payload.phone }
            });
            if (existingUser && existingUser.id !== user.userId) {
                throw new AppError(status.CONFLICT, "Phone number is already in use");
            }
        }
        updateData.phone = payload.phone;
    }

    if (Object.keys(updateData).length === 0) {
        throw new AppError(status.BAD_REQUEST, "No valid fields to update");
    }

    const updatedUser = await prisma.user.update({
        where: { id: user.userId },
        data: updateData,
    });

    logger.update(`Profile updated → userId: ${user.userId}`);
    return updatedUser;
}

const logoutAllDevices = async (user: IRequestUser) => {
    logger.update(`Logout from all devices requested → userId: ${user.userId}`);

    const deleted = await prisma.session.deleteMany({
        where: { userId: user.userId },
    });

    logger.update(`All sessions cleared → userId: ${user.userId}, count: ${deleted.count}`);
    return { deletedSessions: deleted.count };
};

const getActiveSessions = async (user: IRequestUser) => {
    logger.read(`Fetching active sessions → userId: ${user.userId}`);

    const sessions = await prisma.session.findMany({
        where: {
            userId: user.userId,
            expiresAt: { gt: new Date() },
        },
        select: {
            id: true,
            createdAt: true,
            expiresAt: true,
            ipAddress: true,
            userAgent: true,
            accessTokenExpiresAt: true,
            refreshTokenExpiresAt: true,
        },
        orderBy: { createdAt: "desc" },
    });

    return sessions;
};

const revokeSession = async (user: IRequestUser, sessionId: string) => {
    logger.update(`Revoke session requested → userId: ${user.userId}, sessionId: ${sessionId}`);

    const session = await prisma.session.findUnique({
        where: { id: sessionId },
    });

    if (!session || session.userId !== user.userId) {
        throw new AppError(status.NOT_FOUND, "Session not found.");
    }

    await prisma.session.delete({
        where: { id: sessionId },
    });

    logger.update(`Session revoked → userId: ${user.userId}, sessionId: ${sessionId}`);
    return { revokedSessionId: sessionId };
};

export const AuthService = {
    registerUser,
    loginUser,
    getMe,
    getNewToken,
    changePassword,
    logoutUser,
    logoutAllDevices,
    getActiveSessions,
    revokeSession,
    verifyEmail,
    resendVerificationEmail,
    forgetPassword,
    resetPassword,
    googleLoginSuccess,
    updateProfile,
};
