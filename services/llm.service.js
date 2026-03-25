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
// 🧹 CLEAN OUTPUT (HARD FILTER)
// ===============================
const cleanOutput = (text) => {
    if (!text) return "";

    return text
        .replace(/<think[\s\S]*?<\/think>/gi, "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/<[^>]*>/g, "")
        .replace(/okay[, ]?the user[\s\S]*$/gi, "")
        .replace(/let me[\s\S]*$/gi, "")
        .replace(/i think[\s\S]*$/gi, "")
        .replace(/based on the context[\s\S]*$/gi, "")
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
// 🧠 GENERATE RESPONSE (ULTRA FINAL)
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
- Keep it simple and human-like
`
                : `
Respond ONLY in English.
- Be clear, natural, and conversational
`;

        // ===============================
        // 🧠 ULTRA PROMPT (SAAS LEVEL)
        // ===============================
        const finalSystemPrompt = `
You are a highly intelligent AI assistant for a website.

━━━━━━━━━━━━━━━━━━━━━━━
🎯 CORE OBJECTIVE
━━━━━━━━━━━━━━━━━━━━━━━
Help users understand the website clearly using ONLY provided context.

━━━━━━━━━━━━━━━━━━━━━━━
🚨 STRICT RULES (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━
- NEVER hallucinate or guess
- NEVER use outside knowledge
- NEVER mention another company
- NEVER show reasoning or thinking
- NEVER output analysis like:
  "Okay, the user..."
  "Let me check..."
  "Based on reasoning..."

- ONLY give FINAL answer

━━━━━━━━━━━━━━━━━━━━━━━
🧠 RESPONSE LOGIC
━━━━━━━━━━━━━━━━━━━━━━━

IF question is:
- Pricing → extract numbers EXACTLY
- Services → summarize clearly
- Projects → give examples if available
- General → explain simply

━━━━━━━━━━━━━━━━━━━━━━━
⚠️ IF DATA IS MISSING
━━━━━━━━━━━━━━━━━━━━━━━
Say:
${lang === "mr"
                ? "या वेबसाइटवर त्या बद्दल स्पष्ट माहिती उपलब्ध नाही, पण मी संबंधित माहिती देऊ शकतो."
                : "I don’t see exact information on that page, but I can help with related details."
            }

DO NOT:
- invent data
- give fake pricing
- give generic answers repeatedly

━━━━━━━━━━━━━━━━━━━━━━━
💬 STYLE
━━━━━━━━━━━━━━━━━━━━━━━
- 2–4 sentences ONLY
- Human-like tone
- Clear & confident
- No repetition

- Ask 1 natural follow-up question

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
                temperature: 0.3, // 🔥 stable answers
                max_tokens: 180,
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

        console.log("📥 RAW:", aiText.slice(0, 100));

        // ===============================
        // 🧹 CLEAN + FIX
        // ===============================
        aiText = cleanOutput(aiText);
        aiText = fixNumbers(aiText);

        // ===============================
        // 🚨 FINAL SAFETY
        // ===============================
        if (!aiText || aiText.length < 10) {
            aiText =
                lang === "mr"
                    ? "मी मदत करू शकतो. कृपया तुमचा प्रश्न स्पष्टपणे विचारा."
                    : "I can help you. Please ask your question clearly.";
        }

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