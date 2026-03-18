/**
 * Environment Configuration Helper
 * Manages environment-specific behavior for development vs production
 */

import { envVars } from "./env";

export const isDevelopment = envVars.NODE_ENV === "development";
export const isProduction = envVars.NODE_ENV === "production";
export const isTest = envVars.NODE_ENV === "test";

/**
 * Log only in development mode
 */
export const devLog = (label: string, data?: any) => {
    if (isDevelopment) {
        if (data) {
            console.log(`🔵 [DEV] ${label}`, data);
        } else {
            console.log(`🔵 [DEV] ${label}`);
        }
    }
};

/**
 * Log warnings
 */
export const warnLog = (label: string, data?: any) => {
    console.warn(`⚠️  [WARN] ${label}`, data || "");
};

/**
 * Log errors
 */
export const errorLog = (label: string, error?: any) => {
    console.error(`🔴 [ERROR] ${label}`, error || "");
};

/**
 * Log success messages
 */
export const successLog = (label: string, data?: any) => {
    if (isDevelopment) {
        console.log(`✅ [SUCCESS] ${label}`, data || "");
    }
};

/**
 * Get error message based on environment
 * In production, hide internal details
 */
export const getSafeErrorMessage = (error: any, defaultMessage = "An error occurred"): string => {
    if (isProduction) {
        // In production, return generic message
        return defaultMessage;
    }

    // In development, return detailed message
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === "string") {
        return error;
    }

    return JSON.stringify(error);
};

/**
 * Get error details based on environment
 * In production, return minimal information
 */
export const getSafeErrorDetails = (error: any): any => {
    if (isProduction) {
        // In production, return minimal error info
        return {
            message: "Internal server error",
            code: "INTERNAL_ERROR",
        };
    }

    // In development, return full details
    if (error instanceof Error) {
        return {
            message: error.message,
            stack: error.stack,
            name: error.name,
        };
    }

    return {
        message: JSON.stringify(error),
        error,
    };
};

/**
 * Check if sensitive logging is allowed
 */
export const canLogSensitiveData = (): boolean => {
    return isDevelopment;
};

/**
 * Configuration object for environment-specific behavior
 */
export const environmentConfig = {
    isDevelopment,
    isProduction,
    isTest,

    // Logging levels
    logging: {
        verbose: isDevelopment,
        errorDetails: isDevelopment,
        requestLogging: isDevelopment,
        queryLogging: isDevelopment,
    },

    // Security settings
    security: {
        hideErrorDetails: isProduction,
        restrictCors: isProduction,
        enforceHttps: isProduction,
        enableRateLimiting: isProduction,
    },

    // Performance settings
    performance: {
        enableCaching: isProduction,
        enableCompression: isProduction,
        optimizeQueries: isProduction,
    },

    // API settings
    api: {
        requireApiKey: isProduction,
        enableVersioning: true,
        enableMetrics: isDevelopment,
    },
};

/**
 * Log configuration on startup (only in development)
 */
export const logEnvironmentConfig = () => {
    if (isDevelopment) {
        console.log("🔧 Environment Configuration:");
        console.log(`   NODE_ENV: ${envVars.NODE_ENV}`);
        console.log(`   DATABASE: ${envVars.DATABASE_URL.substring(0, 50)}...`);
        console.log(`   FRONTEND_URL: ${envVars.FRONTEND_URL}`);
        console.log(`   Logging: Verbose`);
        console.log(`   Error Details: Included`);
    } else if (isProduction) {
        console.log("✅ Production environment configured");
        console.log("   Security: Enabled");
        console.log("   Error Details: Hidden");
        console.log("   Performance: Optimized");
    }
};
