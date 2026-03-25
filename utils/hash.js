import crypto from "crypto";

/**
 * 🔐 Generate stable hash for caching
 * - Normalizes text (prevents duplicate cache misses)
 * - Limits length (performance + memory)
 * - Supports optional language/context
 */
export const generateHash = (text, extra = "") => {
    if (!text || typeof text !== "string") {
        throw new Error("Invalid text for hashing");
    }

    // ===============================
    // 🧠 NORMALIZATION (CRITICAL)
    // ===============================
    const normalizedText = text
        .toLowerCase()
        .replace(/[^\w\s]/g, "") // remove punctuation
        .replace(/\s+/g, " ")    // normalize spaces
        .trim();

    // ===============================
    // ⚡ LIMIT SIZE (PERFORMANCE BOOST)
    // ===============================
    const shortText = normalizedText.slice(0, 200);

    // ===============================
    // 🔑 HASH GENERATION
    // ===============================
    return crypto
        .createHash("md5")
        .update(`${shortText}_${extra}`)
        .digest("hex");
};