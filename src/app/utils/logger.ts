import { isDevelopment } from "../config/environment";

type CrudOperation = "CREATE" | "READ" | "UPDATE" | "DELETE" | "AUTH";

const SENSITIVE_KEYS = [
    "password", "token", "secret", "accesstoken", "refreshtoken",
    "sessiontoken", "otp", "newpassword", "oldpassword", "currentpassword",
    "authorization", "cookie",
];

const sanitize = (data: unknown): unknown => {
    if (typeof data !== "object" || data === null) return data;
    if (Array.isArray(data)) return data.map(sanitize);

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
            result[key] = "[REDACTED]";
        } else if (typeof value === "object" && value !== null) {
            result[key] = sanitize(value);
        } else {
            result[key] = value;
        }
    }
    return result;
};

const log = (operation: CrudOperation, message: string, data?: unknown) => {
    if (!isDevelopment) return;
    if (data !== undefined) {
        console.log(`[${operation}] ${message}`, sanitize(data));
    } else {
        console.log(`[${operation}] ${message}`);
    }
};

const logError = (message: string, context?: unknown) => {
    if (!isDevelopment) return;
    if (context !== undefined) {
        console.error(`[ERROR] ${message}`, sanitize(context));
    } else {
        console.error(`[ERROR] ${message}`);
    }
};

export const logger = {
    create: (message: string, data?: unknown) => log("CREATE", message, data),
    read: (message: string, data?: unknown) => log("READ", message, data),
    update: (message: string, data?: unknown) => log("UPDATE", message, data),
    delete: (message: string, data?: unknown) => log("DELETE", message, data),
    auth: (message: string, data?: unknown) => log("AUTH", message, data),
    error: (message: string, context?: unknown) => logError(message, context),
};
