import dotenv from "dotenv";
dotenv.config();

import axios from "axios";

const SARVAM_API_KEY = process.env.SARVAM_API_KEY?.trim();

// ===============================
// 📡 AXIOS CLIENT
// ===============================
const ttsClient = axios.create({
    baseURL: "https://api.sarvam.ai",
    timeout: 12000,
    headers: {
        "Content-Type": "application/json",
        "api-subscription-key": SARVAM_API_KEY,
    },
});

// ===============================
// 🔊 GENERATE SPEECH (FINAL FIX)
// ===============================
export const generateSpeech = async (text, language = "en") => {
    const startTime = Date.now();

    try {
        if (!SARVAM_API_KEY) throw new Error("Missing SARVAM_API_KEY");
        if (!text || typeof text !== "string") throw new Error("Invalid text");

        console.log("\n==============================");
        console.log("🔊 TTS START");

        // ===============================
        // 🧹 MINIMAL CLEAN (CRITICAL FIX)
        // ===============================
        let cleanedText = text
            .replace(/https?:\/\/\S+/g, "")
            .replace(/\s+/g, " ")
            .trim();

        // ❗ DO NOT REMOVE ENGLISH WORDS
        // ❗ DO NOT OVER-CLEAN MARATHI
        console.log("📝 Final text:", cleanedText);

        if (cleanedText.length < 3) {
            throw new Error("Text too short");
        }

        // ===============================
        // 🎤 VOICE CONFIG
        // ===============================
        const voiceConfig = {
            en: { speaker: "shubh", lang: "en-IN" },
            mr: { speaker: "meera", lang: "mr-IN" },
        };

        const selected =
            language === "mr" ? voiceConfig.mr : voiceConfig.en;

        console.log(`🎤 Voice: ${selected.speaker} (${selected.lang})`);

        // ===============================
        // ✂️ FAST CHUNKING (OPTIMIZED)
        // ===============================
        const splitText = (input) => {
            const maxLen = 120; // ⚡ balanced speed + quality

            const sentences = input.split(/(?<=[.?!])\s+/);
            const chunks = [];
            let current = "";

            for (const s of sentences) {
                if ((current + " " + s).length > maxLen) {
                    if (current) chunks.push(current.trim());
                    current = s;
                } else {
                    current += " " + s;
                }
            }

            if (current.trim()) chunks.push(current.trim());

            return chunks;
        };

        const chunks = splitText(cleanedText);
        console.log("🧩 Chunks:", chunks.length);

        // ===============================
        // 🔊 GENERATE AUDIO
        // ===============================
        const audioChunks = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            if (!chunk || chunk.length < 3) continue;

            console.log(`▶️ Chunk ${i + 1}/${chunks.length}`);

            try {
                const res = await ttsClient.post(
                    "/text-to-speech/stream",
                    {
                        text: chunk,
                        target_language_code: selected.lang,
                        speaker: selected.speaker,
                        model: "bulbul:v3",
                        pace: 1.0,
                        speech_sample_rate: 22050,
                        output_audio_codec: "mp3",
                    },
                    {
                        responseType: "arraybuffer",
                    }
                );

                const base64 = Buffer.from(res.data).toString("base64");

                if (base64 && base64.length > 100) {
                    audioChunks.push(base64);
                }

            } catch (err) {
                console.warn("⚠️ Chunk failed:", err.message);

                // 🔥 SMART FALLBACK (ONLY IF NEEDED)
                try {
                    const fallbackRes = await ttsClient.post(
                        "/text-to-speech/stream",
                        {
                            text: chunk,
                            target_language_code: "en-IN",
                            speaker: "shubh",
                            model: "bulbul:v3",
                        },
                        {
                            responseType: "arraybuffer",
                        }
                    );

                    const fallbackBase64 = Buffer.from(
                        fallbackRes.data
                    ).toString("base64");

                    if (fallbackBase64) {
                        audioChunks.push(fallbackBase64);
                    }

                } catch {
                    console.warn("❌ Fallback also failed");
                }
            }
        }

        // ===============================
        // 🚨 FINAL SAFETY
        // ===============================
        if (!audioChunks.length) {
            console.warn("⚠️ No audio generated");
            return [];
        }

        const duration = Date.now() - startTime;

        console.log(`✅ TTS DONE (${duration}ms)`);
        console.log("🔊 Chunks:", audioChunks.length);
        console.log("==============================\n");

        return audioChunks;

    } catch (err) {
        console.error("\n❌ TTS ERROR:", err.message);
        console.log("==============================\n");
        return [];
    }
};