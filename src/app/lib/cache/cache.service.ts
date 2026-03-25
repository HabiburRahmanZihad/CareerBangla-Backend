/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "../../utils/logger";
import { CacheEntry, CacheStats, ICacheConfig } from "./cache.types";

/**
 * In-Memory Cache Service
 * Provides TTL-based caching for user data and other frequently accessed resources
 */
class InMemoryCacheService {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private stats: CacheStats = {
        hits: 0,
        misses: 0,
        size: 0,
        hitRate: 0,
    };
    private config: ICacheConfig;

    constructor(config: ICacheConfig = { ttl: 900, useMemory: true }) {
        this.config = config;
        this.startCleanupInterval();
    }

    /**
     * Get value from cache
     */
    get<T>(key: string): T | null {
        // Clean up expired entries
        this.cleanupExpiredEntry(key);

        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            this.updateHitRate();
            return null;
        }

        // Check if entry has expired
        if (entry.expiresAt < Date.now()) {
            this.cache.delete(key);
            this.stats.misses++;
            this.updateHitRate();
            return null;
        }

        this.stats.hits++;
        this.updateHitRate();
        logger.read(`✅ Cache HIT: ${key}`);
        return entry.value as T;
    }

    /**
     * Set value in cache with TTL
     */
    set<T>(key: string, value: T, ttl: number = this.config.ttl): void {
        const now = Date.now();
        const entry: CacheEntry<T> = {
            value,
            expiresAt: now + ttl * 1000,
            createdAt: now,
        };

        this.cache.set(key, entry);
        this.stats.size = this.cache.size;
        logger.create(`📝 Cache SET: ${key} (TTL: ${ttl}s)`);
    }

    /**
     * Delete specific key from cache
     */
    delete(key: string): boolean {
        const deleted = this.cache.delete(key);
        this.stats.size = this.cache.size;
        if (deleted) {
            logger.delete(`🗑️  Cache DELETE: ${key}`);
        }
        return deleted;
    }

    /**
     * Delete multiple keys matching pattern
     */
    deletePattern(pattern: string): number {
        let deletedCount = 0;
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                deletedCount++;
            }
        }

        this.stats.size = this.cache.size;
        if (deletedCount > 0) {
            logger.delete(`🗑️  Cache DELETE PATTERN: ${pattern} (${deletedCount} keys)`);
        }
        return deletedCount;
    }

    /**
     * Clear all cache
     */
    clear(): void {
        this.cache.clear();
        this.stats.size = 0;
        logger.delete("🧹 Cache CLEARED");
    }

    /**
     * Check if key exists
     */
    exists(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;
        if (entry.expiresAt < Date.now()) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        return {
            ...this.stats,
            size: this.cache.size,
        };
    }

    /**
     * Get memory usage estimate (approximate)
     */
    getMemoryUsage(): string {
        let totalSize = 0;
        for (const entry of this.cache.values()) {
            totalSize += JSON.stringify(entry).length;
        }
        return `${(totalSize / 1024 / 1024).toFixed(2)} MB`;
    }

    /**
     * Private: Clean up expired entry
     */
    private cleanupExpiredEntry(key: string): void {
        const entry = this.cache.get(key);
        if (entry && entry.expiresAt < Date.now()) {
            this.cache.delete(key);
            this.stats.size = this.cache.size;
        }
    }

    /**
     * Private: Cleanup all expired entries periodically
     */
    private startCleanupInterval(): void {
        // Run cleanup every 5 minutes
        setInterval(() => {
            let cleanedCount = 0;
            const now = Date.now();

            for (const [key, entry] of this.cache.entries()) {
                if (entry.expiresAt < now) {
                    this.cache.delete(key);
                    cleanedCount++;
                }
            }

            this.stats.size = this.cache.size;

            if (cleanedCount > 0) {
                logger.read(
                    `🧹 Cache Cleanup: ${cleanedCount} expired entries removed. Cache size: ${this.stats.size}`
                );
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Private: Update cache hit rate
     */
    private updateHitRate(): void {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.stats = {
            hits: 0,
            misses: 0,
            size: this.cache.size,
            hitRate: 0,
        };
    }

    /**
     * Get all keys in cache
     */
    getKeys(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Get size of cache
     */
    getSize(): number {
        return this.cache.size;
    }
}

// Export singleton instance
export const cacheService = new InMemoryCacheService({
    ttl: 15 * 60, // 15 minutes default TTL
    useMemory: true,
});

export default InMemoryCacheService;
