/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import { logger } from "../../utils/logger";
import { cacheManager } from "./cache.manager";

/**
 * Cache Monitor Middleware - Logs cache statistics and performance
 */
export const cacheMonitorMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Add cache stats to response headers
    const stats = cacheManager.getStats();
    res.setHeader("X-Cache-Hits", stats.hits.toString());
    res.setHeader("X-Cache-Misses", stats.misses.toString());
    res.setHeader("X-Cache-Hit-Rate", `${stats.hitRate.toFixed(2)}%`);
    res.setHeader("X-Cache-Size", stats.size.toString());
    res.setHeader("X-Cache-Memory", cacheManager.getMemoryUsage());

    next();
};

/**
 * Cache Statistics Endpoint Middleware - Returns detailed cache stats
 * Mount at: GET /api/cache/stats (admin only)
 */
export const cacheStatsEndpoint = (
    req: Request,
    res: Response,
) => {
    const stats = cacheManager.getStats();
    const keys = cacheManager.getKeys();

    res.json({
        success: true,
        data: {
            statistics: {
                hits: stats.hits,
                misses: stats.misses,
                hitRate: `${stats.hitRate.toFixed(2)}%`,
                totalEntries: stats.size,
                memoryUsage: cacheManager.getMemoryUsage(),
            },
            cacheKeys: {
                total: keys.length,
                keys: keys.slice(0, 100), // First 100 keys
            },
            timestamp: new Date().toISOString(),
        },
    });
};

/**
 * Cache Clear Endpoint Middleware - Clears all cache (admin only)
 * Mount at: POST /api/cache/clear (admin only)
 */
export const cacheClearEndpoint = (
    req: Request,
    res: Response,
) => {
    cacheManager.invalidate.clearAll();
    res.json({
        success: true,
        message: "All caches have been cleared successfully",
        timestamp: new Date().toISOString(),
    });
};

/**
 * Cache Performance Middleware - Logs slow queries and cache efficiency
 */
export const cachePerformanceMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const startTime = Date.now();

    // Override res.json to capture response time
    const originalJson = res.json.bind(res);
    res.json = function (data: any) {
        const duration = Date.now() - startTime;
        const stats = cacheManager.getStats();

        // Log cache metrics for each request
        if (duration > 100) {
            logger.read(
                `⚠️  SLOW REQUEST: ${req.method} ${req.path} took ${duration}ms. Cache hit rate: ${stats.hitRate.toFixed(
                    2
                )}%`
            );
        }

        // Add performance headers
        res.setHeader("X-Response-Time-Ms", duration.toString());

        return originalJson(data);
    };

    next();
};

/**
 * Cache Warmup Middleware - Pre-loads common data on startup
 * Can be called in app initialization
 */
export async function warmupCache() {
    try {
        logger.read("🔥 Starting cache warmup...");

        // Note: You would implement this based on your needs
        // For example, pre-load all admins, popular jobs, etc.

        logger.read("✅ Cache warmup completed");
    } catch (error) {
        logger.error("Cache warmup failed", error);
    }
}

/**
 * Cache Validation Middleware - Ensures cache is working correctly
 */
export async function validateCache() {
    try {
        logger.read("🔍 Validating cache functionality...");

        // Test basic operations
        const testKey = "test:validation:key";
        const testValue: any = { test: "value", timestamp: Date.now() };

        // Set
        cacheManager.user.set(testKey, testValue);

        // Get
        const retrieved = cacheManager.user.get(testKey);

        if (!retrieved || (retrieved as any).timestamp !== testValue.timestamp) {
            throw new Error("Cache validation failed: Retrieved value does not match");
        }

        // Delete
        cacheManager.user.delete(testKey);

        // Verify deletion
        const deleted = cacheManager.user.get(testKey);

        if (deleted !== null) {
            throw new Error("Cache validation failed: Value was not deleted");
        }

        logger.read("✅ Cache validation passed");
        return true;
    } catch (error) {
        logger.error("Cache validation failed", error);
        return false;
    }
}
