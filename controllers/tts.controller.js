import crypto from "crypto";
import { generateSpeech } from "../services/tts.service.js";
import { getCache, setCache } from "../utils/cache.js";

// ===============================
// 🔤 LANGUAGE DETECT
// ===============================
const detectLanguage = (text) => {
    return /[\u0900-\u097F]/.test(text) ? "mr" : "en";
};

// ===============================
// 🔑 HASH GENERATOR
// ===============================
const getCacheKey = (text, lang) => {
    const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
    const shortKey = normalized.slice(0, 200);

    return `tts_${crypto
        .createHash("md5")
        .update(`${shortKey}_${lang}`)
        .digest("hex")}`;
};

// ===============================
// 🔊 NORMAL TTS (OLD - SAFE)
// ===============================
export const handleTTS = async (req, res) => {
    const startTime = Date.now();

    try {
        let { text, language } = req.body;

        if (!text || typeof text !== "string") {
            return res.status(400).json({
                success: false,
                message: "Valid text is required",
            });
        }

        const cleanedText = text.trim();

        if (!cleanedText) {
            return res.status(400).json({
                success: false,
                message: "Text cannot be empty",
            });
        }

        if (cleanedText.length > 1200) {
            return res.status(400).json({
                success: false,
                message: "Text too long",
            });
        }

        // 🌐 LANGUAGE DETECT
        const selectedLang = language || detectLanguage(cleanedText);

        const cacheKey = getCacheKey(cleanedText, selectedLang);

        // ⚡ CACHE
        const cached = getCache(cacheKey);
        if (cached?.audio?.length) {
            console.log("⚡ TTS CACHE HIT");

            return res.json({
                success: true,
                audio: cached.audio,
                cached: true,
                responseTime: `${Date.now() - startTime}ms`,
            });
        }

        console.log("❌ TTS CACHE MISS");

        // 🔊 GENERATE
        const audioChunks = await generateSpeech(
            cleanedText,
            selectedLang
        );

        if (!audioChunks?.length) {
            return res.json({
                success: true,
                audio: [],
                language: selectedLang,
            });
        }

        // 💾 CACHE SAVE
        setCache(cacheKey, {
            audio: audioChunks,
            createdAt: Date.now(),
        });

        console.log(`🔊 TTS DONE (${Date.now() - startTime}ms)`);

        return res.json({
            success: true,
            audio: audioChunks,
            language: selectedLang,
        });

    } catch (error) {
        console.error("❌ TTS ERROR:", error.message);

        return res.status(500).json({
            success: false,
            message: "TTS failed",
        });
    }
};

// ===============================
// 🚀 STREAMING TTS (NEW - REALTIME)
// ===============================
export const handleTTSStream = async (req, res) => {
    try {
        let { text, language } = req.body;

        if (!text || typeof text !== "string") {
            return res.status(400).json({
                success: false,
                message: "Valid text is required",
            });
        }

        const cleanedText = text.trim();
        if (!cleanedText) {
            return res.status(400).json({
                success: false,
                message: "Text cannot be empty",
            });
        }

        const selectedLang = language || detectLanguage(cleanedText);

        // 🔥 SPLIT INTO SENTENCES
        const sentences =
            cleanedText.match(/[^.!?]+[.!?]+/g) || [cleanedText];

        // ⚡ STREAM HEADERS
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Transfer-Encoding", "chunked");

        console.log("🚀 STREAM TTS START");

        for (const sentence of sentences) {
            const trimmed = sentence.trim();
            if (!trimmed) continue;

            const cacheKey = getCacheKey(trimmed, selectedLang);

            let audioChunks;

            const cached = getCache(cacheKey);

            if (cached?.audio?.length) {
                console.log("⚡ STREAM CACHE HIT");
                audioChunks = cached.audio;
            } else {
                audioChunks = await generateSpeech(
                    trimmed,
                    selectedLang
                );

                if (audioChunks?.length) {
                    setCache(cacheKey, {
                        audio: audioChunks,
                        createdAt: Date.now(),
                    });
                }
            }

            // 🔥 SEND CHUNK IMMEDIATELY
            res.write(
                JSON.stringify({
                    audio: audioChunks,
                }) + "\n"
            );
        }

        console.log("✅ STREAM END");
        res.end();

    } catch (error) {
        console.error("❌ STREAM TTS ERROR:", error.message);
        res.end();
    }
};