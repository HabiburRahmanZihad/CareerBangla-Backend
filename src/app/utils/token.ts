import crypto from "crypto";
import { Response } from "express";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import { envVars } from "../config/env";
import { CookieUtils } from "./cookie";
import { jwtUtils } from "./jwt";


//Creating access token
const getAccessToken = (payload: JwtPayload) => {
    const accessToken = jwtUtils.createToken(
        payload,
        envVars.ACCESS_TOKEN_SECRET,
        { expiresIn: envVars.ACCESS_TOKEN_EXPIRES_IN } as SignOptions
    );

    return accessToken;
}

const getRefreshToken = (payload: JwtPayload) => {
    const refreshToken = jwtUtils.createToken(
        payload,
        envVars.REFRESH_TOKEN_SECRET,
        { expiresIn: envVars.REFRESH_TOKEN_EXPIRES_IN } as SignOptions
    );
    return refreshToken;
}


const isProduction = envVars.NODE_ENV === "production";

const setAccessTokenCookie = (res: Response, token: string) => {
    CookieUtils.setCookie(res, 'accessToken', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: '/',
        //1 day
        maxAge: 60 * 60 * 24 * 1000,
    });
}

const setRefreshTokenCookie = (res: Response, token: string) => {
    CookieUtils.setCookie(res, 'refreshToken', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: '/',
        //7d
        maxAge: 60 * 60 * 24 * 1000 * 7,
    });
}

const setBetterAuthSessionCookie = (res: Response, token: string) => {
    CookieUtils.setCookie(res, "better-auth.session_token", token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: '/',
        //1 day
        maxAge: 60 * 60 * 24 * 1000,
    });
}

/**
 * Sign a raw session token with HMAC-SHA256 to match better-auth's signed cookie format.
 * Result format: {rawToken}.{base64Signature}
 */
const signSessionToken = (rawToken: string): string => {
    if (!rawToken) return rawToken;
    // Check if already signed (has a valid HMAC-SHA256 base64 signature after the last dot)
    const lastDot = rawToken.lastIndexOf(".");
    if (lastDot > 0) {
        const sig = rawToken.substring(lastDot + 1);
        if (sig.length === 44 && sig.endsWith("=")) {
            return rawToken; // Already signed
        }
    }
    const signature = crypto
        .createHmac("sha256", envVars.BETTER_AUTH_SECRET)
        .update(rawToken)
        .digest("base64");
    return `${rawToken}.${signature}`;
};

/**
 * Extract the raw session token from a signed cookie value.
 * If the value is not signed, returns it as-is.
 */
const extractRawSessionToken = (signedToken: string): string => {
    if (!signedToken) return signedToken;
    const lastDot = signedToken.lastIndexOf(".");
    if (lastDot < 1) return signedToken;
    const possibleSig = signedToken.substring(lastDot + 1);
    // HMAC-SHA256 base64 is always 44 chars ending with '='
    if (possibleSig.length === 44 && possibleSig.endsWith("=")) {
        return signedToken.substring(0, lastDot);
    }
    return signedToken;
};

export const tokenUtils = {
    getAccessToken,
    getRefreshToken,
    setAccessTokenCookie,
    setRefreshTokenCookie,
    setBetterAuthSessionCookie,
    signSessionToken,
    extractRawSessionToken,
}