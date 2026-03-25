/**
 * Cache Types and Interfaces
 */

export interface ICacheConfig {
    ttl: number; // Time to live in seconds
    useMemory: boolean; // Use in-memory cache
    useRedis?: boolean; // Use Redis (optional)
    redisUrl?: string; // Redis connection URL
}

export interface CacheEntry<T> {
    value: T;
    expiresAt: number;
    createdAt: number;
}

export interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
}

/**
 * Cache key patterns for different data types
 */
export const CACHE_KEYS = {
    // User cache keys
    USER: (userId: string) => `user:${userId}`,
    USER_BY_EMAIL: (email: string) => `user:email:${email}`,
    USER_BY_PHONE: (phone: string) => `user:phone:${phone}`,

    // Recruiter cache keys
    RECRUITER: (recruiterId: string) => `recruiter:${recruiterId}`,
    RECRUITER_BY_USER: (userId: string) => `recruiter:user:${userId}`,
    RECRUITERS_LIST: (page: number, limit: number, filters: string) =>
        `recruiters:list:page:${page}:limit:${limit}:${filters}`,
    RECRUITER_JOBS: (recruiterId: string) => `recruiter:${recruiterId}:jobs`,

    // Admin cache keys
    ADMIN: (adminId: string) => `admin:${adminId}`,
    ADMIN_BY_USER: (userId: string) => `admin:user:${userId}`,
    ADMINS_LIST: () => `admins:list`,
    USERS_LIST: (page: number, limit: number, filters: string) =>
        `users:list:page:${page}:limit:${limit}:${filters}`,

    // Resume cache keys
    RESUME: (resumeId: string) => `resume:${resumeId}`,
    RESUME_BY_USER: (userId: string) => `resume:user:${userId}`,

    // Job cache keys
    JOB: (jobId: string) => `job:${jobId}`,
    JOBS_LIST: (page: number, limit: number, filters: string) =>
        `jobs:list:page:${page}:limit:${limit}:${filters}`,

    // Subscription cache keys
    SUBSCRIPTION: (subscriptionId: string) => `subscription:${subscriptionId}`,
    USER_SUBSCRIPTION: (userId: string) => `subscription:user:${userId}`,

    // Application cache keys
    APPLICATION: (applicationId: string) => `application:${applicationId}`,
    USER_APPLICATIONS: (userId: string) => `applications:user:${userId}`,
    JOB_APPLICATIONS: (jobId: string) => `applications:job:${jobId}`,

    // Referral cache keys
    REFERRAL_CODE: (code: string) => `referral:code:${code}`,
    USER_REFERRAL_HISTORY: (userId: string) => `referral:history:${userId}`,
} as const;

/**
 * Cache timeout defaults (in seconds)
 */
export const CACHE_TTL = {
    SHORT: 5 * 60, // 5 minutes - for frequently changing data
    MEDIUM: 15 * 60, // 15 minutes - for moderately stable data
    LONG: 60 * 60, // 1 hour - for stable data
    VERY_LONG: 24 * 60 * 60, // 24 hours - for rarely changing data
} as const;

/**
 * Cache invalidation patterns
 */
export const CACHE_INVALIDATION = {
    USER_UPDATED: (userId: string) => [
        CACHE_KEYS.USER(userId),
        CACHE_KEYS.USER_BY_EMAIL(`*`),
        CACHE_KEYS.USER_BY_PHONE(`*`),
    ],
    RECRUITER_UPDATED: (recruiterId: string, userId: string) => [
        CACHE_KEYS.RECRUITER(recruiterId),
        CACHE_KEYS.RECRUITER_BY_USER(userId),
        `recruiters:list:*`,
        CACHE_KEYS.RECRUITER_JOBS(recruiterId),
    ],
    JOB_UPDATED: (jobId: string, recruiterId: string) => [
        CACHE_KEYS.JOB(jobId),
        CACHE_KEYS.RECRUITER_JOBS(recruiterId),
        `jobs:list:*`,
    ],
    ADMIN_UPDATED: (adminId: string, userId: string) => [
        CACHE_KEYS.ADMIN(adminId),
        CACHE_KEYS.ADMIN_BY_USER(userId),
        CACHE_KEYS.ADMINS_LIST(),
    ],
    SUBSCRIPTION_UPDATED: (userId: string) => [
        CACHE_KEYS.USER_SUBSCRIPTION(userId),
        CACHE_KEYS.USER(userId),
    ],
    APPLICATION_UPDATED: (applicationId: string, userId: string, jobId: string) => [
        CACHE_KEYS.APPLICATION(applicationId),
        CACHE_KEYS.USER_APPLICATIONS(userId),
        CACHE_KEYS.JOB_APPLICATIONS(jobId),
    ],
} as const;
