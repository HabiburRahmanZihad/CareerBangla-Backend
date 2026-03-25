/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "../../utils/logger";
import { cacheManager } from "./cache.manager";

/**
 * Caching Decorator - Wraps methods to add TTL-based caching
 * Usage: @Cacheable({ key: 'user:id', ttl: 3600 })
 */
export function Cacheable(options: { key: string | ((args: any[]) => string); ttl?: number }) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            try {
                // Generate cache key
                const cacheKey =
                    typeof options.key === "function" ? options.key(args) : options.key;

                // Try to get from cache
                const cached = cacheManager.user.get?.(cacheKey);
                if (cached) {
                    logger.read(`✅ Cache HIT for method: ${propertyKey}`);
                    return cached;
                }

                // Call original method
                const result = await originalMethod.apply(this, args);

                // Store in cache
                cacheManager.user.set?.(cacheKey, result);

                return result;
            } catch (error) {
                logger.error(`Error in cacheable decorator for ${propertyKey}`, error);
                // On error, call original method without caching
                return await originalMethod.apply(this, args);
            }
        };

        return descriptor;
    };
}

/**
 * Cache Invalidation Decorator - Clears cache after method execution
 * Usage: @CacheInvalidate({ patterns: ['user:*'] })
 */
export function CacheInvalidate(options: { patterns: string[] }) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            try {
                // Call original method
                const result = await originalMethod.apply(this, args);

                // Invalidate cache
                options.patterns.forEach((pattern) => {
                    if (pattern.includes("*")) {
                        // Use pattern matching for wildcards
                        const keys = cacheManager.getKeys();
                        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
                        keys.forEach((key) => {
                            if (regex.test(key)) {
                                logger.delete(`🗑️  Invalidating cache: ${key}`);
                            }
                        });
                    }
                });

                return result;
            } catch (error) {
                logger.error(`Error in cache invalidation for ${propertyKey}`, error);
                throw error;
            }
        };

        return descriptor;
    };
}

/**
 * Combined Cacheable + CacheInvalidate pattern
 * Useful when a method updates data and should invalidate related caches
 */
export function CacheAside(options: {
    getKey: (args: any[]) => string;
    invalidatePatterns?: string[];
    ttl?: number;
}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            try {
                const cacheKey = options.getKey(args);

                // For read operations, check cache first
                if (propertyKey.includes("get") || propertyKey.includes("fetch")) {
                    const cached = cacheManager.user.get?.(cacheKey);
                    if (cached) {
                        return cached;
                    }
                }

                // Call original method
                const result = await originalMethod.apply(this, args);

                // For write operations, invalidate related caches
                if (
                    propertyKey.includes("update") ||
                    propertyKey.includes("create") ||
                    propertyKey.includes("delete")
                ) {
                    if (options.invalidatePatterns) {
                        options.invalidatePatterns.forEach((pattern) => {
                            const keys = cacheManager.getKeys();
                            const regex = new RegExp(pattern.replace(/\*/g, ".*"));
                            keys.forEach((key) => {
                                if (regex.test(key)) {
                                    logger.delete(`🗑️  Invalidating cache via CacheAside: ${key}`);
                                }
                            });
                        });
                    }
                } else {
                    // For read operations, cache the result
                    cacheManager.user.set?.(cacheKey, result);
                }

                return result;
            } catch (error) {
                logger.error(`Error in CacheAside for ${propertyKey}`, error);
                throw error;
            }
        };

        return descriptor;
    };
}
