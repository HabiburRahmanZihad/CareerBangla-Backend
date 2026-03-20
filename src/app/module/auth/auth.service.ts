import status from "http-status";
import { UserStatus } from "../../../generated/prisma/enums";
import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import { tokenUtils } from "../../utils/token";
import { IChangePasswordPayload, ILoginUserPayload, IRegisterUserPayload } from "./auth.interface";
import crypto from "crypto";

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

const registerUser = async (payload: IRegisterUserPayload) => {
    const { name, email, password, referralCode: incomingReferralCode } = payload;

    const data = await auth.api.signUpEmail({
        body: {
            name,
            email,
            password,
        }
    })

    console.log("[registerUser] better-auth response keys:", Object.keys(data));
    console.log("[registerUser] data.token:", data.token !== undefined ? "exists" : "undefined");
    console.log("[registerUser] data.user exists:", !!data.user);

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
            // Update user with referral code and referredBy
            await tx.user.update({
                where: { id: data.user.id },
                data: {
                    referralCode,
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

        const accessToken = tokenUtils.getAccessToken({
            userId: data.user.id,
            role: data.user.role,
            name: data.user.name,
            email: data.user.email,
            status: data.user.status,
            isDeleted: data.user.isDeleted,
            emailVerified: data.user.emailVerified,
        });

        const refreshToken = tokenUtils.getRefreshToken({
            userId: data.user.id,
            role: data.user.role,
            name: data.user.name,
            email: data.user.email,
            status: data.user.status,
            isDeleted: data.user.isDeleted,
            emailVerified: data.user.emailVerified,
        });

        console.log("[registerUser] about to return:", {
            hasToken: !!data.token,
            tokenPreview: data.token ? data.token.substring(0, 20) : "null"
        });

        return {
            user: data.user,
            token: data.token,
            accessToken,
            refreshToken,
        }

    } catch (error) {
        await prisma.user.delete({
            where: {
                id: data.user.id
            }
        })
        throw error;
    }

}


const loginUser = async (payload: ILoginUserPayload) => {
    const { email, password } = payload;

    const data = await auth.api.signInEmail({
        body: {
            email,
            password,
        }
    })

    console.log("[loginUser] better-auth response keys:", Object.keys(data));
    console.log("[loginUser] data.token:", data.token !== undefined ? "exists" : "undefined");
    console.log("[loginUser] data.user exists:", !!data.user);

    if (data.user.status === UserStatus.BLOCKED) {
        throw new AppError(status.FORBIDDEN, "User is blocked");
    }

    if (data.user.isDeleted || data.user.status === UserStatus.DELETED) {
        throw new AppError(status.NOT_FOUND, "User is deleted");
    }

    // Check if email is verified
    if (!data.user.emailVerified) {
        throw new AppError(status.UNAUTHORIZED, "Email not verified");
    }

    const accessToken = tokenUtils.getAccessToken({
        userId: data.user.id,
        role: data.user.role,
        name: data.user.name,
        email: data.user.email,
        status: data.user.status,
        isDeleted: data.user.isDeleted,
        emailVerified: data.user.emailVerified,
    });

    const refreshToken = tokenUtils.getRefreshToken({
        userId: data.user.id,
        role: data.user.role,
        name: data.user.name,
        email: data.user.email,
        status: data.user.status,
        isDeleted: data.user.isDeleted,
        emailVerified: data.user.emailVerified,
    });

    return {
        user: data.user,
        token: data.token,
        accessToken,
        refreshToken,
    };

}

const getMe = async (user: IRequestUser) => {
    const isUserExists = await prisma.user.findUnique({
        where: {
            id: user.userId,
        },
        include: {
            recruiter: {
                include: {
                    jobs: true,
                }
            },
            admin: true,
            resume: true,
            applications: {
                include: {
                    job: {
                        include: {
                            recruiter: true,
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
    if (!sessionToken) {
        throw new AppError(status.UNAUTHORIZED, "Session token is missing");
    }

    // Validate session using better-auth API (handles token hashing internally)
    const sessionData = await auth.api.getSession({
        headers: new Headers({
            Authorization: `Bearer ${sessionToken}`
        })
    });

    if (!sessionData || !sessionData.user) {
        throw new AppError(status.UNAUTHORIZED, "Invalid session token");
    }

    const verifiedRefreshToken = jwtUtils.verifyToken(refreshToken, envVars.REFRESH_TOKEN_SECRET)

    if (!verifiedRefreshToken.success && verifiedRefreshToken.error) {
        throw new AppError(status.UNAUTHORIZED, "Invalid refresh token");
    }

    const user = sessionData.user;

    const newAccessToken = tokenUtils.getAccessToken({
        userId: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        status: user.status,
        isDeleted: user.isDeleted,
        emailVerified: user.emailVerified,
    });

    const newRefreshToken = tokenUtils.getRefreshToken({
        userId: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        status: user.status,
        isDeleted: user.isDeleted,
        emailVerified: user.emailVerified,
    });

    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        sessionToken: sessionToken,
    }

}

const changePassword = async (payload: IChangePasswordPayload, sessionToken?: string) => {
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

    const accessToken = tokenUtils.getAccessToken({
        userId: session.user.id,
        role: session.user.role,
        name: session.user.name,
        email: session.user.email,
        status: session.user.status,
        isDeleted: session.user.isDeleted,
        emailVerified: session.user.emailVerified,
    });

    const refreshToken = tokenUtils.getRefreshToken({
        userId: session.user.id,
        role: session.user.role,
        name: session.user.name,
        email: session.user.email,
        status: session.user.status,
        isDeleted: session.user.isDeleted,
        emailVerified: session.user.emailVerified,
    });


    return {
        ...result,
        accessToken,
        refreshToken,
    }
}

const logoutUser = async (sessionToken?: string) => {
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

    const accessToken = tokenUtils.getAccessToken({
        userId: result.user.id,
        role: result.user.role,
        name: result.user.name,
        email: result.user.email,
        status: result.user.status,
        isDeleted: result.user.isDeleted,
        emailVerified: result.user.emailVerified,
    });

    const refreshToken = tokenUtils.getRefreshToken({
        userId: result.user.id,
        role: result.user.role,
        name: result.user.name,
        email: result.user.email,
        status: result.user.status,
        isDeleted: result.user.isDeleted,
        emailVerified: result.user.emailVerified,
    });

    return {
        user: result.user,
        token: result.token,
        accessToken,
        refreshToken,
    }
}

const resendVerificationEmail = async (email: string) => {
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

const forgetPassword = async (email: string) => {
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

    await auth.api.requestPasswordResetEmailOTP({
        body: {
            email,
        }
    })
}

const resetPassword = async (email: string, otp: string, newPassword: string) => {
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

    const accessToken = tokenUtils.getAccessToken({
        userId: session.user.id,
        role: session.user.role,
        name: session.user.name,
        email: session.user.email,
        status: session.user.status,
        isDeleted: session.user.isDeleted,
        emailVerified: session.user.emailVerified,
    });

    const refreshToken = tokenUtils.getRefreshToken({
        userId: session.user.id,
        role: session.user.role,
        name: session.user.name,
        email: session.user.email,
        status: session.user.status,
        isDeleted: session.user.isDeleted,
        emailVerified: session.user.emailVerified,
    });

    return {
        accessToken,
        refreshToken,
    }
}

export const AuthService = {
    registerUser,
    loginUser,
    getMe,
    getNewToken,
    changePassword,
    logoutUser,
    verifyEmail,
    resendVerificationEmail,
    forgetPassword,
    resetPassword,
    googleLoginSuccess,
};
