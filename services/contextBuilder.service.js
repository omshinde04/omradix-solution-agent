import { searchSimilar } from "./vectorStore.service.js";

// ===============================
// 🌍 LANGUAGE NORMALIZATION
// ===============================
const normalizeQuery = (query, language) => {
    let q = query.toLowerCase();

    // Marathi → English mapping (lightweight)
    if (language === "mr") {
        const map = {
            "माहिती": "information",
            "किंमत": "price",
            "सेवा": "services",
            "प्रोजेक्ट": "projects",
        };

        Object.keys(map).forEach((k) => {
            q = q.replace(new RegExp(k, "gi"), map[k]);
        });
    }

    return q;
};

// ===============================
// 🧠 REMOVE NOISE (GENERIC)
// ===============================
const isGarbage = (text) => {
    const t = text.toLowerCase();

    return (
        t.includes("cookie") ||
        t.includes("privacy policy") ||
        t.includes("terms of use") ||
        t.includes("all rights reserved") ||
        t.length < 40
    );
};

// ===============================
// 🧠 SEMANTIC BOOST (GENERIC)
// ===============================
const semanticBoost = (chunk, query) => {
    const text = chunk.content.toLowerCase();
    const q = query.toLowerCase();

    let boost = 0;

    const words = q.split(" ").filter(w => w.length > 3);

    words.forEach(word => {
        if (text.includes(word)) boost += 0.2;
    });

    // detect numbers (pricing / stats)
    if (/\d/.test(text)) boost += 0.1;

    // detect headings
    if (text.length < 300) boost += 0.1;

    return chunk.score + boost;
};

// ===============================
// 🧠 BUILD CONTEXT (UNIVERSAL)
// ===============================
export const buildContext = async (query, language = "en") => {
    const startTime = Date.now();

    try {
        const searchQuery = normalizeQuery(query, language);

        // ===============================
        // 🔍 VECTOR SEARCH
        // ===============================
        let chunks = await searchSimilar(searchQuery, 12);

        // ===============================
        // 🔥 CLEAN + FILTER
        // ===============================
        chunks = chunks.filter(c => {
            const text = c.content || "";
            return !isGarbage(text);
        });

        // ===============================
        // 🔥 SEMANTIC RANKING (KEY)
        // ===============================
        chunks = chunks
            .map(c => ({
                ...c,
                finalScore: semanticBoost(c, searchQuery)
            }))
            .sort((a, b) => b.finalScore - a.finalScore);

        // ===============================
        // 🔥 FALLBACK (CRITICAL)
        // ===============================
        if (chunks.length < 3) {
            const fallback = await searchSimilar(query, 6);
            chunks = [...chunks, ...fallback];
        }

        // ===============================
        // 🔥 REMOVE DUPLICATES
        // ===============================
        chunks = [
            ...new Map(chunks.map(c => [c.content, c])).values()
        ];

        // ===============================
        // 🧹 BUILD CONTEXT
        // ===============================
        let context = chunks
            .slice(0, 6)
            .map(c => c.content)
            .join("\n\n")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 1800);

        // ===============================
        // 🌐 LANGUAGE
        // ===============================
        const isMarathi = language === "mr";

        const languageRule = isMarathi
            ? "Respond ONLY in Marathi. Be natural and conversational."
            : "Respond ONLY in English. Be natural and conversational.";

        // ===============================
        // 🧠 FINAL SYSTEM PROMPT (GENERIC)
        // ===============================
        const systemPrompt = `
You are an intelligent AI assistant for a website.

🎯 OBJECTIVE:
Help users understand the website content clearly and naturally.

📌 RULES:
- Use CONTEXT as main source
- If context is weak → still guide user intelligently
- NEVER hallucinate fake details
- Keep answers SHORT (2–4 sentences)
- Sound human, friendly, and confident
- Avoid robotic or repetitive replies

- If user asks:
  → about services → explain clearly
  → about pricing → mention numbers if present
  → about projects/products → give examples
  → general question → summarize relevant info

- If info not clearly available:
  ${isMarathi
                ? "पूर्ण माहिती उपलब्ध नाही, पण मी मदत करण्याचा प्रयत्न करतो."
                : "Exact information is limited, but I’ll help based on available content."
            }

- ALWAYS ask 1 follow-up question

🌐 LANGUAGE:
${languageRule}

📚 CONTEXT:
${context}
`;

        console.log(`⚡ Context built (${Date.now() - startTime}ms)`);

        return {
            systemPrompt,
            userQuery: query.trim(),
        };

    } catch (error) {
        console.error("❌ Context Builder Error:", error.message);

        return {
            systemPrompt: "You are a helpful assistant.",
            userQuery: query,
        };
    }
};