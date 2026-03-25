const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_SIZE = 500; // 🔥 prevent memory overflow

const cache = new Map();

/**
 * ===============================
 * 📥 GET CACHE
 * ===============================
 */
export const getCache = (key) => {
    const entry = cache.get(key);

    if (!entry) return null;

    const { value, expiry } = entry;

    // ❌ expired
    if (Date.now() > expiry) {
        cache.delete(key);
        return null;
    }

    // 🔥 refresh order (LRU behavior)
    cache.delete(key);
    cache.set(key, entry);

    return value;
};

/**
 * ===============================
 * 📤 SET CACHE
 * ===============================
 */
export const setCache = (key, value, ttl = CACHE_TTL) => {
    // 🔥 LRU eviction if limit reached
    if (cache.size >= MAX_CACHE_SIZE) {
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);

        console.log("🧹 Cache evicted (LRU):", oldestKey);
    }

    const expiry = Date.now() + ttl;

    cache.set(key, {
        value,
        expiry,
    });
};

/**
 * ===============================
 * 🧹 CLEAR CACHE (manual)
 * ===============================
 */
export const clearCache = () => {
    cache.clear();
    console.log("🧹 Cache cleared");
};

/**
 * ===============================
 * 📊 CACHE STATS (debug)
 * ===============================
 */
export const getCacheStats = () => {
    return {
        size: cache.size,
        maxSize: MAX_CACHE_SIZE,
    };
};