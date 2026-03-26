import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, emailOTP } from "better-auth/plugins";
import { Role, UserStatus } from "../../generated/prisma/enums";
import { envVars } from "../config/env";
import { sendEmail } from "../utils/email";
import { logger } from "../utils/logger";
import { prisma } from "./prisma";

const sendOtpEmailSafely = async (emailOptions: Parameters<typeof sendEmail>[0]) => {
    try {
        await sendEmail(emailOptions);
    } catch (error) {
        logger.error("OTP email delivery failed", error);
    }
};

export const auth = betterAuth({
    baseURL: envVars.BETTER_AUTH_URL,
    secret: envVars.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),

    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
    },

    socialProviders: {
        google: {
            clientId: envVars.GOOGLE_CLIENT_ID,
            clientSecret: envVars.GOOGLE_CLIENT_SECRET,
            prompt: "select_account",
            mapProfileToUser: () => {
                return {
                    role: Role.USER,
                    status: UserStatus.ACTIVE,
                    needPasswordChange: false,
                    emailVerified: true,
                    isDeleted: false,
                    deletedAt: null,
                }
            }
        }
    },

    emailVerification: {
        sendOnSignUp: true,
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
    },

    user: {
        additionalFields: {
            role: {
                type: "string",
                required: true,
                defaultValue: Role.USER
            },

            status: {
                type: "string",
                required: true,
                defaultValue: UserStatus.ACTIVE
            },

            needPasswordChange: {
                type: "boolean",
                required: true,
                defaultValue: false
            },

            isDeleted: {
                type: "boolean",
                required: true,
                defaultValue: false
            },

            deletedAt: {
                type: "date",
                required: false,
                defaultValue: null
            },
        }
    },

    plugins: [
        bearer(),
        emailOTP({
            overrideDefaultEmailVerification: true,
            async sendVerificationOTP({ email, otp, type }) {
                if (type === "email-verification") {
                    const user = await prisma.user.findUnique({
                        where: {
                            email,
                        }
                    })

                    if (!user) {
                        logger.error("User not found for verification OTP", { email });
                        return;
                    }

                    if (user && (user.role === Role.SUPER_ADMIN || user.role === Role.RECRUITER)) {
                        logger.read(`Skipping OTP for ${user.role}`, { email });
                        return;
                    }

                    if (user && !user.emailVerified) {
                        await sendOtpEmailSafely({
                            to: email,
                            subject: "Verify your email - CareerBangla",
                            templateName: "otp",
                            templateData: {
                                name: user.name,
                                otp,
                            }
                        })
                    }
                } else if (type === "forget-password") {
                    const user = await prisma.user.findUnique({
                        where: {
                            email,
                        }
                    })

                    if (user) {
                        await sendOtpEmailSafely({
                            to: email,
                            subject: "Password Reset OTP - CareerBangla",
                            templateName: "otp",
                            templateData: {
                                name: user.name,
                                otp,
                            }
                        })
                    }
                }
            },
            expiresIn: 2 * 60,
            otpLength: 6,
        })
    ],

    session: {
        expiresIn: 60 * 60 * 24,
        updateAge: 60 * 60 * 24,
        cookieCache: {
            enabled: true,
            maxAge: 60 * 60 * 24,
        }
    },

    redirectURLs: {
        signIn: `${envVars.BETTER_AUTH_URL}/api/v1/auth/google/success`,
    },

    trustedOrigins: [envVars.BETTER_AUTH_URL, envVars.FRONTEND_URL],

    advanced: {
        useSecureCookies: false, // We manage secure attribute manually to keep cookie names consistent
        cookies: {
            state: {
                name: "better-auth.state",
                attributes: {
                    sameSite: envVars.NODE_ENV === "production" ? "none" : "lax",
                    secure: envVars.NODE_ENV === "production",
                    httpOnly: true,
                    path: "/",
                }
            },
            sessionToken: {
                name: "better-auth.session_token",
                attributes: {
                    sameSite: envVars.NODE_ENV === "production" ? "none" : "lax",
                    secure: envVars.NODE_ENV === "production",
                    httpOnly: true,
                    path: "/",
                }
            }
        }
    }

});
