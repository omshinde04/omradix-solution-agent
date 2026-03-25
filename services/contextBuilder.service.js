import { searchSimilar } from "./vectorStore.service.js";

// ===============================
// 🌍 LANGUAGE NORMALIZATION
// ===============================
const normalizeQuery = (query, language) => {
    let q = query.toLowerCase().trim();

    if (language === "mr") {
        const map = {
            "माहिती": "information",
            "किंमत": "price",
            "सेवा": "services",
            "प्रोजेक्ट": "projects",
            "कोर्स": "course",
        };

        Object.keys(map).forEach((k) => {
            q = q.replace(new RegExp(k, "gi"), map[k]);
        });
    }

    return q;
};

// ===============================
// 🧹 REMOVE GARBAGE CONTENT
// ===============================
const isGarbage = (text = "") => {
    const t = text.toLowerCase();

    return (
        t.includes("cookie") ||
        t.includes("privacy policy") ||
        t.includes("terms") ||
        t.includes("all rights reserved") ||
        t.includes("subscribe") ||
        t.includes("login") ||
        t.length < 50
    );
};

// ===============================
// 🧠 SEMANTIC BOOST (IMPROVED)
// ===============================
const semanticBoost = (chunk, query) => {
    const text = (chunk.content || "").toLowerCase();
    const q = query.toLowerCase();

    let boost = chunk.score || 0;

    const words = q.split(" ").filter(w => w.length > 3);

    words.forEach(word => {
        if (text.includes(word)) boost += 0.3;
    });

    // numbers = pricing / stats importance
    if (/\d/.test(text)) boost += 0.2;

    // concise chunks = better answers
    if (text.length < 300) boost += 0.15;

    return boost;
};

// ===============================
// 🧠 BUILD CONTEXT (FINAL)
// ===============================
export const buildContext = async (query, language = "en") => {
    const startTime = Date.now();

    try {
        const searchQuery = normalizeQuery(query, language);

        // ===============================
        // 🔍 VECTOR SEARCH
        // ===============================
        let chunks = await searchSimilar(searchQuery, 15);

        // ===============================
        // 🧹 REMOVE NOISE
        // ===============================
        chunks = chunks.filter(c => !isGarbage(c.content));

        // ===============================
        // 🔥 SEMANTIC RANKING
        // ===============================
        chunks = chunks
            .map(c => ({
                ...c,
                finalScore: semanticBoost(c, searchQuery)
            }))
            .sort((a, b) => b.finalScore - a.finalScore);

        // ===============================
        // 🔁 FALLBACK SEARCH (SMART)
        // ===============================
        if (chunks.length < 4) {
            const fallback = await searchSimilar(query, 10);

            const cleanFallback = fallback.filter(c => !isGarbage(c.content));

            chunks = [...chunks, ...cleanFallback];
        }

        // ===============================
        // 🔁 REMOVE DUPLICATES
        // ===============================
        chunks = [
            ...new Map(chunks.map(c => [c.content, c])).values()
        ];

        // ===============================
        // 🧠 BUILD FINAL CONTEXT
        // ===============================
        let context = chunks
            .slice(0, 8)
            .map(c => c.content)
            .join("\n\n")
            .replace(/\s+/g, " ")
            .trim();

        // limit size for LLM
        context = context.slice(0, 2000);

        // ===============================
        // 🌐 LANGUAGE CONTROL
        // ===============================
        const isMarathi = language === "mr";

        const languageRule = isMarathi
            ? `
Respond ONLY in Marathi.
- Use natural spoken Marathi
- Be clear and human-like
`
            : `
Respond ONLY in English.
- Be natural, clear, and conversational
`;

        // ===============================
        // 🧠 FINAL SYSTEM PROMPT
        // ===============================
        const systemPrompt = `
You are a smart AI assistant for a website.

━━━━━━━━━━━━━━━━━━━━━━━
🎯 OBJECTIVE
━━━━━━━━━━━━━━━━━━━━━━━
Answer the user's question using ONLY the provided context.

━━━━━━━━━━━━━━━━━━━━━━━
🚨 STRICT RULES
━━━━━━━━━━━━━━━━━━━━━━━
- NEVER hallucinate
- NEVER use outside knowledge
- NEVER repeat same lines
- NEVER sound robotic

━━━━━━━━━━━━━━━━━━━━━━━
🧠 RESPONSE BEHAVIOR
━━━━━━━━━━━━━━━━━━━━━━━
- Simple question → short answer (2–3 sentences)
- Detailed question → longer answer (3–5 sentences)
- If user asks again → expand answer

- Services → explain clearly
- Pricing → extract exact numbers if present
- Projects → give examples if available
- General → summarize clearly

━━━━━━━━━━━━━━━━━━━━━━━
⚠️ IF INFO IS LIMITED
━━━━━━━━━━━━━━━━━━━━━━━
${isMarathi
                ? "पूर्ण माहिती उपलब्ध नाही, पण मी उपलब्ध माहितीवर आधारित मदत करू शकतो."
                : "I don’t see exact details, but I can guide you based on available information."
            }

━━━━━━━━━━━━━━━━━━━━━━━
💬 STYLE
━━━━━━━━━━━━━━━━━━━━━━━
- Human-like and friendly
- Clear and confident
- No unnecessary repetition

━━━━━━━━━━━━━━━━━━━━━━━
🌐 LANGUAGE
━━━━━━━━━━━━━━━━━━━━━━━
${languageRule}

━━━━━━━━━━━━━━━━━━━━━━━
📚 CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━
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
            systemPrompt: `
You are a helpful AI assistant.
Answer clearly and naturally.
`,
            userQuery: query,
        };
    }
};