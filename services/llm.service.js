import dotenv from "dotenv";
dotenv.config();

import axios from "axios";

const SARVAM_API_KEY = process.env.SARVAM_API_KEY?.trim();

// ===============================
// 🔧 AXIOS CLIENT
// ===============================
const sarvamClient = axios.create({
    baseURL: "https://api.sarvam.ai/v1",
    timeout: 20000,
    headers: { "Content-Type": "application/json" },
});

// ===============================
// 🌐 LANGUAGE DETECTION
// ===============================
const detectLanguage = (text) => {
    if (!text) return "en";
    return /[\u0900-\u097F]/.test(text) ? "mr" : "en";
};

// ===============================
// 🧹 ULTRA CLEAN OUTPUT (STRICT)
// ===============================
const cleanOutput = (text) => {
    if (!text) return "";

    let cleaned = text
        // remove hidden reasoning blocks
        .replace(/<think[\s\S]*?<\/think>/gi, "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/<[^>]*>/g, "")

        // 🚨 kill reasoning leaks completely
        .replace(/okay[, ]?the user[\s\S]*/gi, "")
        .replace(/let me[\s\S]*/gi, "")
        .replace(/i think[\s\S]*/gi, "")
        .replace(/hmm[\s\S]*/gi, "")
        .replace(/based on[\s\S]*/gi, "")
        .replace(/looking at[\s\S]*/gi, "")
        .replace(/since the context[\s\S]*/gi, "")
        .replace(/the user might[\s\S]*/gi, "")
        .replace(/the assistant['’]s rules[\s\S]*/gi, "")

        // clean formatting
        .replace(/\n+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return cleaned;
};

// ===============================
// 🔢 SMART NUMBER FIX
// ===============================
const fixNumbers = (text) => {
    return text
        .replace(/₹\s?(\d)\.(\d)/g, "₹$1,$20,000")
        .replace(/₹\s+/g, "₹")
        .replace(/(\d)\s+,/g, "$1,");
};

// ===============================
// 🔊 TTS CLEANER
// ===============================
export const prepareForTTS = (text) => {
    return text
        .replace(/₹/g, "rupees ")
        .replace(/,/g, "")
        .replace(/\*\*/g, "")
        .replace(/[^\w\s.?!]/g, "");
};

// ===============================
// 🧠 GENERATE RESPONSE (FINAL PRO)
// ===============================
export const generateResponse = async (systemPrompt, userQuery) => {
    const startTime = Date.now();

    try {
        if (!SARVAM_API_KEY) throw new Error("Missing API key");

        const lang = detectLanguage(userQuery);

        // ===============================
        // 🌐 LANGUAGE CONTROL
        // ===============================
        const languageInstruction =
            lang === "mr"
                ? `
Respond ONLY in Marathi.
- Use natural spoken Marathi
- Be clear and human-like
`
                : `
Respond ONLY in English.
- Be clear, natural, and conversational
`;

        // ===============================
        // 🧠 RESPONSE CONTROL
        // ===============================
        const finalSystemPrompt = `
You are a smart AI assistant for a website.

━━━━━━━━━━━━━━━━━━━━━━━
🎯 OBJECTIVE
━━━━━━━━━━━━━━━━━━━━━━━
Answer the user using ONLY the provided context.

━━━━━━━━━━━━━━━━━━━━━━━
🚨 STRICT RULES
━━━━━━━━━━━━━━━━━━━━━━━
- NEVER hallucinate
- NEVER use outside knowledge
- NEVER show internal thinking
- NEVER output:
  "Okay, the user..."
  "Let me think..."
  "Based on reasoning..."

- ONLY give final clean answer

━━━━━━━━━━━━━━━━━━━━━━━
🧠 RESPONSE STYLE
━━━━━━━━━━━━━━━━━━━━━━━
- Be clear and helpful
- Use 2–5 sentences (expand if needed)
- Avoid repeating same lines
- Sound natural and human

- If user asks again → give more detail

━━━━━━━━━━━━━━━━━━━━━━━
⚠️ IF INFO IS LIMITED
━━━━━━━━━━━━━━━━━━━━━━━
Say:
${lang === "mr"
                ? "पूर्ण माहिती उपलब्ध नाही, पण मी संबंधित माहिती देऊ शकतो."
                : "I don’t see exact details, but I can guide you based on available information."
            }

━━━━━━━━━━━━━━━━━━━━━━━
🌐 LANGUAGE
━━━━━━━━━━━━━━━━━━━━━━━
${languageInstruction}

━━━━━━━━━━━━━━━━━━━━━━━
📚 CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━
${systemPrompt}
`;

        // ===============================
        // 📡 API CALL
        // ===============================
        const response = await sarvamClient.post(
            "/chat/completions",
            {
                model: "sarvam-m",
                messages: [
                    { role: "system", content: finalSystemPrompt },
                    { role: "user", content: userQuery },
                ],
                temperature: 0.4,
                max_tokens: 250,
                top_p: 0.9,
            },
            {
                headers: {
                    Authorization: `Bearer ${SARVAM_API_KEY}`,
                },
            }
        );

        let aiText =
            response?.data?.choices?.[0]?.message?.content || "";

        console.log("📥 RAW:", aiText.slice(0, 120));

        // ===============================
        // 🧹 CLEAN + FIX
        // ===============================
        aiText = cleanOutput(aiText);
        aiText = fixNumbers(aiText);

        // ===============================
        // 🚨 HARD SAFETY FILTER
        // ===============================
        const lower = aiText.toLowerCase();

        if (
            lower.includes("the user") ||
            lower.includes("let me") ||
            lower.includes("i think") ||
            lower.includes("okay")
        ) {
            aiText =
                lang === "mr"
                    ? "मी तुमच्या प्रश्नाचे स्पष्ट उत्तर देतो."
                    : "Here’s a clear answer to your question.";
        }

        // ===============================
        // 🚨 FALLBACK
        // ===============================
        if (!aiText || aiText.length < 10) {
            aiText =
                lang === "mr"
                    ? "मी मदत करू शकतो. कृपया तुमचा प्रश्न स्पष्टपणे विचारा."
                    : "I can help you. Please ask your question clearly.";
        }

        // ensure proper ending
        if (!/[.!?]$/.test(aiText)) {
            aiText += ".";
        }

        const duration = Date.now() - startTime;
        console.log(`✅ DONE (${duration}ms)`);

        return aiText;

    } catch (err) {
        console.error("❌ ERROR:", err.message);
        return "Sorry, I am facing a temporary issue.";
    }
};