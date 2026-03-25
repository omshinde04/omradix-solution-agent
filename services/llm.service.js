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
// 🧹 ADVANCED CLEAN OUTPUT
// ===============================
const cleanOutput = (text) => {
    if (!text) return "";

    return text
        // remove hidden reasoning
        .replace(/<think[\s\S]*?<\/think>/gi, "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/<[^>]*>/g, "")

        // 🔥 kill reasoning leaks aggressively
        .replace(/(okay|let me|i think|based on|the user is asking)[\s\S]*?:/gi, "")
        .replace(/(the user is asking)[\s\S]*/gi, "")

        // clean spaces
        .replace(/\n+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
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
- Keep it human and conversational
`
                : `
Respond ONLY in English.
- Be natural, clear, and conversational
`;

        // ===============================
        // 🧠 SMART LENGTH CONTROL
        // ===============================
        const lengthControl = `
- If question is simple → give short answer (2–3 sentences)
- If user asks "more", "details", or complex query → give detailed answer (4–6 sentences)
`;

        // ===============================
        // 🧠 FINAL SYSTEM PROMPT
        // ===============================
        const finalSystemPrompt = `
You are an advanced AI assistant for a website.

━━━━━━━━━━━━━━━━━━━━━━━
🎯 OBJECTIVE
━━━━━━━━━━━━━━━━━━━━━━━
Help users clearly understand the website using ONLY provided context.

━━━━━━━━━━━━━━━━━━━━━━━
🚨 STRICT RULES
━━━━━━━━━━━━━━━━━━━━━━━
- NEVER hallucinate
- NEVER use outside knowledge
- NEVER mention another company
- NEVER show thinking or reasoning steps
- NEVER output phrases like:
  "Okay, the user..."
  "Let me think..."
  "Based on reasoning..."

- ONLY give FINAL answer

━━━━━━━━━━━━━━━━━━━━━━━
🧠 RESPONSE BEHAVIOR
━━━━━━━━━━━━━━━━━━━━━━━
${lengthControl}

- Services → explain clearly
- Pricing → extract numbers exactly
- Projects → give examples
- General → summarize properly

- If user asks again → expand answer

━━━━━━━━━━━━━━━━━━━━━━━
⚠️ IF DATA IS LIMITED
━━━━━━━━━━━━━━━━━━━━━━━
Say:
${lang === "mr"
                ? "पूर्ण माहिती उपलब्ध नाही, पण मी संबंधित माहिती देऊ शकतो."
                : "Exact information is limited, but I can help with related details."
            }

━━━━━━━━━━━━━━━━━━━━━━━
💬 STYLE
━━━━━━━━━━━━━━━━━━━━━━━
- Human-like tone
- Clear and confident
- No repetition
- No robotic replies

- Always ask 1 natural follow-up question

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
                temperature: 0.4, // slightly more natural
                max_tokens: 250, // 🔥 increased for better answers
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
        // 🧹 CLEAN OUTPUT
        // ===============================
        aiText = cleanOutput(aiText);
        aiText = fixNumbers(aiText);

        // ===============================
        // 🚨 FALLBACK
        // ===============================
        if (!aiText || aiText.length < 10) {
            aiText =
                lang === "mr"
                    ? "मी मदत करू शकतो. कृपया तुमचा प्रश्न स्पष्टपणे विचारा."
                    : "I can help you. Please ask your question clearly.";
        }

        // ensure sentence end
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