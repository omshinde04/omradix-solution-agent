import { speechToText } from "../services/stt.service.js";
import { handleAsk } from "./ask.controller.js";
import { getSession } from "../utils/sessionStore.js";

// ===============================
// 🧠 SMART LANGUAGE DETECTION (CRITICAL)
// ===============================
const detectLanguageSmart = (text = "", prevLang = "en") => {
    const lower = text.toLowerCase();

    // Marathi script
    if (/[\u0900-\u097F]/.test(text)) return "mr";

    // Marathi roman (HINGLISH FIX 🔥)
    const marathiWords = [
        "mahiti", "baddal", "kay", "kasa", "kashi",
        "tumhi", "mala", "pahije", "sanga", "madat",
        "internship", "course", "kaay", "aahe"
    ];

    if (marathiWords.some(word => lower.includes(word))) {
        return "mr";
    }

    // Keep previous language if unsure
    return prevLang;
};

export const handleVoice = async (req, res) => {
    try {
        console.log("\n==============================");
        console.log("🎤 /api/voice REQUEST");

        const file = req.file;
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "Session ID required",
            });
        }

        const session = getSession(sessionId);

        // ===============================
        // 🤖 GREETING
        // ===============================
        if (!file) {
            console.log("🤖 Greeting flow");

            return handleAsk(
                { body: { query: "__start__", sessionId } },
                res
            );
        }

        // ===============================
        // 🎤 STT
        // ===============================
        console.log("🎤 Running STT...");

        const sttResult = await speechToText(
            file.path,
            session.language
        );

        let userText = sttResult?.text?.trim() || "";

        console.log("📝 User:", userText);

        // ===============================
        // ❗ EMPTY INPUT (NO LOOP)
        // ===============================
        if (!userText || userText.length < 2) {
            console.log("⚠️ Empty voice input");

            return res.json({
                success: true,
                userText: "",
                text:
                    session.language === "mr"
                        ? "माफ करा, मला समजले नाही. कृपया पुन्हा स्पष्ट बोला."
                        : "Sorry, I didn’t catch that. Please speak clearly.",
                language: session.language,
            });
        }

        // ===============================
        // 🌐 LANGUAGE CONTROL (FIXED)
        // ===============================
        let detectedLang = detectLanguageSmart(
            userText,
            session.language
        );

        // 🔥 FORCE LANGUAGE SWITCH COMMANDS
        if (userText.toLowerCase().includes("marathi")) {
            detectedLang = "mr";
        }

        if (userText.toLowerCase().includes("english")) {
            detectedLang = "en";
        }

        // 🔥 SAVE IN SESSION (CRITICAL)
        session.language = detectedLang;

        console.log("🌐 Language:", detectedLang);

        // ===============================
        // 🔥 FORWARD TO AI
        // ===============================
        const fakeReq = {
            body: {
                query: userText,
                sessionId,
            },
        };

        const fakeRes = {
            json: (data) => {
                return res.json({
                    success: true,
                    userText,
                    text: data.text,
                    language: session.language,
                });
            },
            status: (code) => res.status(code),
        };

        return handleAsk(fakeReq, fakeRes);

    } catch (error) {
        console.error("\n❌ VOICE ERROR:", error.message);
        console.log("==============================\n");

        return res.status(500).json({
            success: false,
            message: "Voice processing failed",
        });
    }
};