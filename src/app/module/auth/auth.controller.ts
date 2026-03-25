import { Request, Response } from "express";
import status from "http-status";
import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { auth } from "../../lib/auth";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CookieUtils } from "../../utils/cookie";
import { tokenUtils } from "../../utils/token";
import { AuthService } from "./auth.service";

const registerUser = catchAsync(
    async (req: Request, res: Response) => {
        const payload = req.body;

        const result = await AuthService.registerUser(payload);

        const { accessToken, refreshToken, token, ...rest } = result
        const signedToken = token ? tokenUtils.signSessionToken(token) : token;

        tokenUtils.setAccessTokenCookie(res, accessToken);
        tokenUtils.setRefreshTokenCookie(res, refreshToken);
        if (signedToken) tokenUtils.setBetterAuthSessionCookie(res, signedToken);

        sendResponse(res, {
            httpStatusCode: status.CREATED,
            success: true,
            message: "User registered successfully",
            data: {
                token: signedToken,
                accessToken,
                refreshToken,
                ...rest,
            }
        })
    }
)

const loginUser = catchAsync(
    async (req: Request, res: Response) => {
        const payload = req.body;
        const result = await AuthService.loginUser(payload);
        const { accessToken, refreshToken, token, ...rest } = result
        const signedToken = tokenUtils.signSessionToken(token);

        tokenUtils.setAccessTokenCookie(res, accessToken);
        tokenUtils.setRefreshTokenCookie(res, refreshToken);
        tokenUtils.setBetterAuthSessionCookie(res, signedToken);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "User logged in successfully",
            data: {
                token: signedToken,
                accessToken,
                refreshToken,
                ...rest,
            },
        })
    }
)

const getMe = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await AuthService.getMe(user);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "User profile fetched successfully",
            data: result,
        })
    }
)

const getNewToken = catchAsync(
    async (req: Request, res: Response) => {
        const refreshToken = req.cookies.refreshToken;
        const betterAuthSessionToken = req.cookies["better-auth.session_token"];
        if (!refreshToken) {
            throw new AppError(status.UNAUTHORIZED, "Refresh token is missing");
        }
        if (!betterAuthSessionToken) {
            throw new AppError(status.UNAUTHORIZED, "Session token is missing");
        }
        // Extract raw token from signed cookie for DB lookups
        const rawSessionToken = tokenUtils.extractRawSessionToken(betterAuthSessionToken);
        const result = await AuthService.getNewToken(refreshToken, rawSessionToken);

        const { accessToken, refreshToken: newRefreshToken, sessionToken } = result;
        const signedSessionToken = tokenUtils.signSessionToken(sessionToken);

        tokenUtils.setAccessTokenCookie(res, accessToken);
        tokenUtils.setRefreshTokenCookie(res, newRefreshToken);
        tokenUtils.setBetterAuthSessionCookie(res, signedSessionToken);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "New tokens generated successfully",
            data: {
                accessToken,
                refreshToken: newRefreshToken,
                sessionToken: signedSessionToken,
            },
        });
    }
)

const changePassword = catchAsync(
    async (req: Request, res: Response) => {
        const payload = req.body;
        const betterAuthSessionToken = req.cookies["better-auth.session_token"];
        // Extract raw token for better-auth API calls
        const rawSessionToken = tokenUtils.extractRawSessionToken(betterAuthSessionToken);

        const result = await AuthService.changePassword(payload, rawSessionToken);

        const { accessToken, refreshToken, token } = result;
        const signedToken = token ? tokenUtils.signSessionToken(token as string) : token;

        tokenUtils.setAccessTokenCookie(res, accessToken);
        tokenUtils.setRefreshTokenCookie(res, refreshToken);
        if (signedToken) tokenUtils.setBetterAuthSessionCookie(res, signedToken as string);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Password changed successfully",
            data: { ...result, token: signedToken },
        });
    }
)

const logoutUser = catchAsync(
    async (req: Request, res: Response) => {
        const betterAuthSessionToken = req.cookies["better-auth.session_token"];
        // Extract raw token for better-auth API calls
        const rawSessionToken = tokenUtils.extractRawSessionToken(betterAuthSessionToken);
        const result = await AuthService.logoutUser(rawSessionToken);
        const isProduction = envVars.NODE_ENV === "production";
        const cookieClearOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" as const : "lax" as const,
            path: "/",
        };
        CookieUtils.clearCookie(res, 'accessToken', cookieClearOptions);
        CookieUtils.clearCookie(res, 'refreshToken', cookieClearOptions);
        CookieUtils.clearCookie(res, 'better-auth.session_token', cookieClearOptions);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "User logged out successfully",
            data: result,
        });
    }
)

const verifyEmail = catchAsync(
    async (req: Request, res: Response) => {
        const { email, otp } = req.body;
        const result = await AuthService.verifyEmail(email, otp);

        const { accessToken, refreshToken, token, ...rest } = result
        const signedToken = token ? tokenUtils.signSessionToken(token) : token;

        if (accessToken) tokenUtils.setAccessTokenCookie(res, accessToken);
        if (refreshToken) tokenUtils.setRefreshTokenCookie(res, refreshToken);
        if (signedToken) tokenUtils.setBetterAuthSessionCookie(res, signedToken);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Email verified successfully",
            data: {
                token: signedToken,
                accessToken,
                refreshToken,
                ...rest,
            },
        });
    }
)

const resendVerificationEmail = catchAsync(
    async (req: Request, res: Response) => {
        const { email } = req.body;
        await AuthService.resendVerificationEmail(email);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Verification OTP resent successfully",
        });
    }
)

const forgetPassword = catchAsync(
    async (req: Request, res: Response) => {
        const { email, phone } = req.body;
        await AuthService.forgetPassword({ email, phone });

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Password reset OTP sent to email successfully",
        });
    }
)

const resetPassword = catchAsync(
    async (req: Request, res: Response) => {
        const { email, otp, newPassword } = req.body;
        await AuthService.resetPassword(email, otp, newPassword);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Password reset successfully",
        });
    }
)

// /api/v1/auth/login/google?redirect=/profile
const googleLogin = catchAsync((req: Request, res: Response) => {
    const redirectPath = req.query.redirect || "/dashboard";
    const referralCode = req.query.ref as string | undefined;

    const encodedRedirectPath = encodeURIComponent(redirectPath as string);

    const callbackURL = `${envVars.BETTER_AUTH_URL}/api/v1/auth/google/success?redirect=${encodedRedirectPath}`;

    // Store referral code in a cookie so it survives the OAuth redirect chain
    // without modifying the callbackURL (which breaks better-auth state validation)
    if (referralCode) {
        res.cookie("oauth_referral_code", referralCode, {
            httpOnly: true,
            maxAge: 10 * 60 * 1000, // 10 minutes
            sameSite: "lax",
            path: "/",
        });
    }

    res.render("googleRedirect", {
        callbackURL: callbackURL,
        betterAuthUrl: envVars.BETTER_AUTH_URL,
    })
})

const googleLoginSuccess = catchAsync(async (req: Request, res: Response) => {
    const redirectPath = req.query.redirect as string || "/dashboard";
    const referralCode = req.cookies.oauth_referral_code as string | undefined;

    // Clear the referral cookie regardless of outcome
    res.clearCookie("oauth_referral_code", { path: "/" });

    const sessionToken = req.cookies["better-auth.session_token"];

    if (!sessionToken) {
        return res.redirect(`${envVars.FRONTEND_URL}/login?error=oauth_failed`);
    }

    const session = await auth.api.getSession({
        headers: {
            "Cookie": `better-auth.session_token=${sessionToken}`
        }
    })

    if (!session) {
        return res.redirect(`${envVars.FRONTEND_URL}/login?error=no_session_found`);
    }


    if (session && !session.user) {
        return res.redirect(`${envVars.FRONTEND_URL}/login?error=no_user_found`);
    }

    const result = await AuthService.googleLoginSuccess(session, referralCode);

    const { accessToken, refreshToken } = result;

    // ?redirect=//profile -> /profile
    const isValidRedirectPath = redirectPath.startsWith("/") && !redirectPath.startsWith("//");
    const finalRedirectPath = isValidRedirectPath ? redirectPath : "/dashboard";

    // Clear all Better-Auth cookies set during OAuth flow on the backend domain
    // Must match exact attributes Better-Auth used when setting them
    const clearOptions = {
        path: "/",
        httpOnly: true,
        secure: envVars.NODE_ENV === "production",
        sameSite: (envVars.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
    };
    res.clearCookie("better-auth.session_token", clearOptions);
    res.clearCookie("better-auth.session_data", clearOptions);

    // Redirect to frontend callback route which sets cookies on the frontend domain
    const callbackParams = new URLSearchParams({
        accessToken,
        refreshToken,
        sessionToken,
        redirect: finalRedirectPath,
    });

    res.redirect(`${envVars.FRONTEND_URL}/api/auth/social-callback?${callbackParams.toString()}`);
})

const handleOAuthError = catchAsync((req: Request, res: Response) => {
    const error = req.query.error as string || "oauth_failed";
    res.redirect(`${envVars.FRONTEND_URL}/login?error=${error}`);
})

const updateProfile = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const payload = req.body;
        const result = await AuthService.updateProfile(user, payload);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Profile updated successfully",
            data: result,
        })
    }
)

const logoutAllDevices = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await AuthService.logoutAllDevices(user);
        const isProduction = envVars.NODE_ENV === "production";
        const cookieClearOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" as const : "lax" as const,
            path: "/",
        };
        CookieUtils.clearCookie(res, 'accessToken', cookieClearOptions);
        CookieUtils.clearCookie(res, 'refreshToken', cookieClearOptions);
        CookieUtils.clearCookie(res, 'better-auth.session_token', cookieClearOptions);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Logged out from all devices successfully",
            data: result,
        });
    }
)

const getActiveSessions = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await AuthService.getActiveSessions(user);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Active sessions fetched successfully",
            data: result,
        });
    }
)

const revokeSession = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { sessionId } = req.params;
        const result = await AuthService.revokeSession(user, sessionId as string);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Session revoked successfully",
            data: result,
        });
    }
)

const deleteMyAccount = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        await AuthService.deleteMyAccount(user);

        const isProduction = envVars.NODE_ENV === "production";
        const cookieClearOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" as const : "lax" as const,
            path: "/",
        };
        CookieUtils.clearCookie(res, "accessToken", cookieClearOptions);
        CookieUtils.clearCookie(res, "refreshToken", cookieClearOptions);
        CookieUtils.clearCookie(res, "better-auth.session_token", cookieClearOptions);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Account deleted successfully",
        });
    }
)

export const AuthController = {
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
    googleLogin,
    googleLoginSuccess,
    handleOAuthError,
    updateProfile,
    deleteMyAccount,
};
