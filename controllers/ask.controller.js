import { buildContext } from "../services/contextBuilder.service.js";
import { generateResponse } from "../services/llm.service.js";
import { getCache, setCache } from "../utils/cache.js";
import { getSession } from "../utils/sessionStore.js";

export const handleAsk = async (req, res) => {
    const startTime = Date.now();

    try {
        const { query, sessionId } = req.body;

        if (!query || typeof query !== "string") {
            return res.status(400).json({
                success: false,
                message: "Valid query is required",
            });
        }

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "Session ID required",
            });
        }

        const cleanedQuery = query.trim();
        if (!cleanedQuery) {
            return res.status(400).json({
                success: false,
                message: "Query cannot be empty",
            });
        }

        const session = getSession(sessionId);
        const lower = cleanedQuery.toLowerCase();

        // ===============================
        // 🚀 SYSTEM START
        // ===============================
        if (cleanedQuery === "__start__") {
            session.stage = "ask_name";

            return res.json({
                success: true,
                text:
                    session.language === "mr"
                        ? "नमस्कार! मी तुमचा AI सहाय्यक आहे. तुमचे नाव काय आहे?"
                        : "Hello! I'm your AI assistant. What is your name?",
                language: session.language,
            });
        }

        // ===============================
        // 🌐 LANGUAGE SWITCH
        // ===============================
        if (lower.includes("marathi") || lower.includes("मराठी")) {
            session.language = "mr";

            return res.json({
                success: true,
                text: "ठीक आहे, आता मी मराठीत बोलेन. तुम्हाला कशाबद्दल माहिती हवी आहे?",
                language: "mr",
            });
        }

        if (lower.includes("english") || lower.includes("इंग्लिश")) {
            session.language = "en";

            return res.json({
                success: true,
                text: "Sure, switching to English. How can I help you?",
                language: "en",
            });
        }

        const lang = session.language;

        // ===============================
        // 🧠 NAME DETECTION (FIXED)
        // ===============================
        if (session.stage === "ask_name") {
            let name = cleanedQuery
                .replace(/my name is|i am|this is|it's|its/gi, "")
                .trim();

            name = name.split(" ")[0];
            name =
                name.charAt(0).toUpperCase() +
                name.slice(1).toLowerCase();

            session.userName = name || "User";
            session.stage = "chat";

            return res.json({
                success: true,
                text:
                    lang === "mr"
                        ? `${session.userName}, तुम्हाला कशाबद्दल माहिती हवी आहे?`
                        : `Hi ${session.userName}! How can I help you today?`,
                language: lang,
            });
        }

        // ===============================
        // 🧠 NORMAL MODE
        // ===============================
        const normalizedQuery = cleanedQuery
            .toLowerCase()
            .replace(/[^\w\s\u0900-\u097F]/g, "")
            .trim();

        const cacheKey = `${normalizedQuery}_${lang}`;
        const cached = getCache(cacheKey);

        if (cached?.text) {
            return res.json({
                success: true,
                text: cached.text,
                language: lang,
                cached: true,
            });
        }

        // ===============================
        // 🧠 CONTEXT
        // ===============================
        const { systemPrompt, userQuery } = await buildContext(
            cleanedQuery,
            lang
        );

        let aiText = await generateResponse(systemPrompt, userQuery);

        // ===============================
        // 🧹 CLEAN OUTPUT
        // ===============================
        aiText = aiText
            ?.replace(/<think>[\s\S]*?<\/think>/gi, "")
            .replace(/\s+/g, " ")
            .trim();

        // ===============================
        // ❗ EMPTY SAFE RESPONSE
        // ===============================
        if (!aiText || aiText.length < 3) {
            aiText =
                lang === "mr"
                    ? "मी तुम्हाला CARPS मधील ट्रेनिंग आणि इंटर्नशिप बद्दल माहिती देऊ शकतो."
                    : "I can help you with CARPS training and internship details.";
        }

        // ===============================
        // 🧠 REMOVE REPETITION (CRITICAL)
        // ===============================
        if (session.lastResponse === aiText) {
            aiText =
                lang === "mr"
                    ? "याबद्दल आणखी माहिती सांगू शकतो. तुम्हाला कोणत्या भागात रस आहे?"
                    : "I can explain this in more detail. What part are you interested in?";
        }

        session.lastResponse = aiText;

        // ===============================
        // 🧠 PERSONALIZATION
        // ===============================
        if (session.userName) {
            aiText = `${session.userName}, ${aiText}`;
        }

        // ===============================
        // 🧠 SMART FOLLOW-UP (NO SPAM)
        // ===============================
        const followUpsEn = [
            "Would you like more details?",
            "I can guide you further.",
            "Want to explore more?"
        ];

        const followUpsMr = [
            "तुम्हाला अजून माहिती हवी आहे का?",
            "मी आणखी मार्गदर्शन करू शकतो.",
            "तुम्हाला आणखी जाणून घ्यायचे आहे का?"
        ];

        // avoid adding follow-up every time
        if (Math.random() > 0.4) {
            const followUp =
                lang === "mr"
                    ? followUpsMr[Math.floor(Math.random() * followUpsMr.length)]
                    : followUpsEn[Math.floor(Math.random() * followUpsEn.length)];

            aiText = `${aiText} ${followUp}`;
        }

        // ===============================
        // 💾 CACHE
        // ===============================
        setCache(cacheKey, { text: aiText });

        const duration = Date.now() - startTime;
        console.log(`🧠 ASK DONE (${duration}ms)`);

        return res.json({
            success: true,
            text: aiText,
            language: lang,
        });

    } catch (error) {
        console.error("❌ ASK ERROR:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to process request",
        });
    }
};