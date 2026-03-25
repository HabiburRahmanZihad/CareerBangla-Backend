/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "../../utils/logger";
import { cacheService } from "./cache.service";
import { CACHE_INVALIDATION, CACHE_KEYS, CACHE_TTL } from "./cache.types";

/**
 * Cache Manager - High-level API for cache operations
 * Simplifies cache usage across the application
 */
class CacheManager {
    /**
     * Get or set cache (cache-aside pattern)
     */
    async getOrSet<T>(
        key: string,
        fetchFn: () => Promise<T>,
        ttl: number = CACHE_TTL.MEDIUM
    ): Promise<T> {
        // Try to get from cache first
        const cached = cacheService.get<T>(key);
        if (cached !== null) {
            return cached;
        }

        // If not in cache, fetch the data
        logger.read(`📡 Fetching data for key: ${key}`);
        const data = await fetchFn();

        // Store in cache
        cacheService.set(key, data, ttl);

        return data;
    }

    /**
     * User data cache operations
     */
    user = {
        get: (userId: string) => cacheService.get(CACHE_KEYS.USER(userId)),
        set: (userId: string, data: any) =>
            cacheService.set(CACHE_KEYS.USER(userId), data, CACHE_TTL.LONG),
        delete: (userId: string) => cacheService.delete(CACHE_KEYS.USER(userId)),
        getOrSet: (userId: string, fetchFn: () => Promise<any>) =>
            this.getOrSet(CACHE_KEYS.USER(userId), fetchFn, CACHE_TTL.LONG),
    };

    /**
     * Recruiter data cache operations
     */
    recruiter = {
        get: (recruiterId: string) => cacheService.get(CACHE_KEYS.RECRUITER(recruiterId)),
        set: (recruiterId: string, data: any) =>
            cacheService.set(CACHE_KEYS.RECRUITER(recruiterId), data, CACHE_TTL.LONG),
        delete: (recruiterId: string) =>
            cacheService.delete(CACHE_KEYS.RECRUITER(recruiterId)),
        getByUser: (userId: string) =>
            cacheService.get(CACHE_KEYS.RECRUITER_BY_USER(userId)),
        setByUser: (userId: string, data: any) =>
            cacheService.set(CACHE_KEYS.RECRUITER_BY_USER(userId), data, CACHE_TTL.LONG),
        getOrSetByUser: (userId: string, fetchFn: () => Promise<any>) =>
            this.getOrSet(CACHE_KEYS.RECRUITER_BY_USER(userId), fetchFn, CACHE_TTL.LONG),
        getJobs: (recruiterId: string) =>
            cacheService.get(CACHE_KEYS.RECRUITER_JOBS(recruiterId)),
        setJobs: (recruiterId: string, data: any) =>
            cacheService.set(CACHE_KEYS.RECRUITER_JOBS(recruiterId), data, CACHE_TTL.MEDIUM),
        deleteJobs: (recruiterId: string) =>
            cacheService.delete(CACHE_KEYS.RECRUITER_JOBS(recruiterId)),
    };

    /**
     * Admin data cache operations
     */
    admin = {
        get: (adminId: string) => cacheService.get(CACHE_KEYS.ADMIN(adminId)),
        set: (adminId: string, data: any) =>
            cacheService.set(CACHE_KEYS.ADMIN(adminId), data, CACHE_TTL.LONG),
        delete: (adminId: string) => cacheService.delete(CACHE_KEYS.ADMIN(adminId)),
        getByUser: (userId: string) => cacheService.get(CACHE_KEYS.ADMIN_BY_USER(userId)),
        setByUser: (userId: string, data: any) =>
            cacheService.set(CACHE_KEYS.ADMIN_BY_USER(userId), data, CACHE_TTL.LONG),
        getList: () => cacheService.get(CACHE_KEYS.ADMINS_LIST()),
        setList: (data: any) =>
            cacheService.set(CACHE_KEYS.ADMINS_LIST(), data, CACHE_TTL.MEDIUM),
        deleteList: () => cacheService.delete(CACHE_KEYS.ADMINS_LIST()),
    };

    /**
     * Resume data cache operations
     */
    resume = {
        get: (resumeId: string) => cacheService.get(CACHE_KEYS.RESUME(resumeId)),
        set: (resumeId: string, data: any) =>
            cacheService.set(CACHE_KEYS.RESUME(resumeId), data, CACHE_TTL.LONG),
        delete: (resumeId: string) => cacheService.delete(CACHE_KEYS.RESUME(resumeId)),
        getByUser: (userId: string) => cacheService.get(CACHE_KEYS.RESUME_BY_USER(userId)),
        setByUser: (userId: string, data: any) =>
            cacheService.set(CACHE_KEYS.RESUME_BY_USER(userId), data, CACHE_TTL.LONG),
        getOrSetByUser: (userId: string, fetchFn: () => Promise<any>) =>
            this.getOrSet(CACHE_KEYS.RESUME_BY_USER(userId), fetchFn, CACHE_TTL.LONG),
    };

    /**
     * Subscription data cache operations
     */
    subscription = {
        get: (subscriptionId: string) =>
            cacheService.get(CACHE_KEYS.SUBSCRIPTION(subscriptionId)),
        set: (subscriptionId: string, data: any) =>
            cacheService.set(CACHE_KEYS.SUBSCRIPTION(subscriptionId), data, CACHE_TTL.LONG),
        delete: (subscriptionId: string) =>
            cacheService.delete(CACHE_KEYS.SUBSCRIPTION(subscriptionId)),
        getByUser: (userId: string) =>
            cacheService.get(CACHE_KEYS.USER_SUBSCRIPTION(userId)),
        setByUser: (userId: string, data: any) =>
            cacheService.set(CACHE_KEYS.USER_SUBSCRIPTION(userId), data, CACHE_TTL.LONG),
        getOrSetByUser: (userId: string, fetchFn: () => Promise<any>) =>
            this.getOrSet(CACHE_KEYS.USER_SUBSCRIPTION(userId), fetchFn, CACHE_TTL.LONG),
        deleteByUser: (userId: string) =>
            cacheService.delete(CACHE_KEYS.USER_SUBSCRIPTION(userId)),
    };

    /**
     * Application data cache operations
     */
    application = {
        get: (applicationId: string) =>
            cacheService.get(CACHE_KEYS.APPLICATION(applicationId)),
        set: (applicationId: string, data: any) =>
            cacheService.set(CACHE_KEYS.APPLICATION(applicationId), data, CACHE_TTL.MEDIUM),
        delete: (applicationId: string) =>
            cacheService.delete(CACHE_KEYS.APPLICATION(applicationId)),
        getUserApplications: (userId: string) =>
            cacheService.get(CACHE_KEYS.USER_APPLICATIONS(userId)),
        setUserApplications: (userId: string, data: any) =>
            cacheService.set(CACHE_KEYS.USER_APPLICATIONS(userId), data, CACHE_TTL.MEDIUM),
        deleteUserApplications: (userId: string) =>
            cacheService.delete(CACHE_KEYS.USER_APPLICATIONS(userId)),
        getJobApplications: (jobId: string) =>
            cacheService.get(CACHE_KEYS.JOB_APPLICATIONS(jobId)),
        setJobApplications: (jobId: string, data: any) =>
            cacheService.set(CACHE_KEYS.JOB_APPLICATIONS(jobId), data, CACHE_TTL.MEDIUM),
        deleteJobApplications: (jobId: string) =>
            cacheService.delete(CACHE_KEYS.JOB_APPLICATIONS(jobId)),
    };

    /**
     * Job data cache operations
     */
    job = {
        get: (jobId: string) => cacheService.get(CACHE_KEYS.JOB(jobId)),
        set: (jobId: string, data: any) =>
            cacheService.set(CACHE_KEYS.JOB(jobId), data, CACHE_TTL.MEDIUM),
        delete: (jobId: string) => cacheService.delete(CACHE_KEYS.JOB(jobId)),
    };

    /**
     * Invalidate cache based on operation type
     */
    invalidate = {
        userUpdated: (userId: string) => {
            const patterns = CACHE_INVALIDATION.USER_UPDATED(userId);
            patterns.forEach((pattern) => {
                if (pattern.includes("*")) {
                    cacheService.deletePattern(pattern);
                } else {
                    cacheService.delete(pattern);
                }
            });
            logger.update(`🔄 Cache invalidated for user: ${userId}`);
        },

        recruiterUpdated: (recruiterId: string, userId: string) => {
            const patterns = CACHE_INVALIDATION.RECRUITER_UPDATED(recruiterId, userId);
            patterns.forEach((pattern) => {
                if (pattern.includes("*")) {
                    cacheService.deletePattern(pattern);
                } else {
                    cacheService.delete(pattern);
                }
            });
            logger.update(`🔄 Cache invalidated for recruiter: ${recruiterId}`);
        },

        jobUpdated: (jobId: string, recruiterId: string) => {
            const patterns = CACHE_INVALIDATION.JOB_UPDATED(jobId, recruiterId);
            patterns.forEach((pattern) => {
                if (pattern.includes("*")) {
                    cacheService.deletePattern(pattern);
                } else {
                    cacheService.delete(pattern);
                }
            });
            logger.update(`🔄 Cache invalidated for job: ${jobId}`);
        },

        adminUpdated: (adminId: string, userId: string) => {
            const patterns = CACHE_INVALIDATION.ADMIN_UPDATED(adminId, userId);
            patterns.forEach((pattern) => {
                if (pattern.includes("*")) {
                    cacheService.deletePattern(pattern);
                } else {
                    cacheService.delete(pattern);
                }
            });
            logger.update(`🔄 Cache invalidated for admin: ${adminId}`);
        },

        subscriptionUpdated: (userId: string) => {
            const patterns = CACHE_INVALIDATION.SUBSCRIPTION_UPDATED(userId);
            patterns.forEach((pattern) => {
                if (pattern.includes("*")) {
                    cacheService.deletePattern(pattern);
                } else {
                    cacheService.delete(pattern);
                }
            });
            logger.update(`🔄 Cache invalidated for subscriptions of user: ${userId}`);
        },

        applicationUpdated: (applicationId: string, userId: string, jobId: string) => {
            const patterns = CACHE_INVALIDATION.APPLICATION_UPDATED(
                applicationId,
                userId,
                jobId
            );
            patterns.forEach((pattern) => {
                if (pattern.includes("*")) {
                    cacheService.deletePattern(pattern);
                } else {
                    cacheService.delete(pattern);
                }
            });
            logger.update(`🔄 Cache invalidated for application: ${applicationId}`);
        },

        clearAll: () => {
            cacheService.clear();
            logger.delete("🧹 All caches cleared");
        },
    };

    /**
     * Get cache statistics
     */
    getStats() {
        return cacheService.getStats();
    }

    /**
     * Get memory usage
     */
    getMemoryUsage() {
        return cacheService.getMemoryUsage();
    }

    /**
     * Get all cache keys
     */
    getKeys() {
        return cacheService.getKeys();
    }
}

export const cacheManager = new CacheManager();
export default CacheManager;
