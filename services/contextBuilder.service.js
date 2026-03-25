import { searchSimilar } from "./vectorStore.service.js";

// ===============================
// 🌍 LANGUAGE NORMALIZATION
// ===============================
const normalizeQuery = (query, language) => {
    let q = query.toLowerCase();

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
// 🧠 REMOVE GARBAGE CONTENT
// ===============================
const isGarbage = (text) => {
    const t = text.toLowerCase();

    return (
        t.includes("cookie") ||
        t.includes("privacy policy") ||
        t.includes("terms") ||
        t.includes("all rights reserved") ||
        t.length < 40
    );
};

// ===============================
// 🧠 SMART SEMANTIC BOOST
// ===============================
const semanticBoost = (chunk, query) => {
    const text = chunk.content.toLowerCase();
    const q = query.toLowerCase();

    let boost = 0;

    const words = q.split(" ").filter(w => w.length > 3);

    words.forEach(word => {
        if (text.includes(word)) boost += 0.25;
    });

    // numbers = pricing / stats
    if (/\d/.test(text)) boost += 0.15;

    // shorter chunks = more focused
    if (text.length < 300) boost += 0.1;

    return chunk.score + boost;
};

// ===============================
// 🧠 BUILD CONTEXT (SMART + UNIVERSAL)
// ===============================
export const buildContext = async (query, language = "en") => {
    const startTime = Date.now();

    try {
        const searchQuery = normalizeQuery(query, language);

        // ===============================
        // 🔍 VECTOR SEARCH (HIGH RECALL)
        // ===============================
        let chunks = await searchSimilar(searchQuery, 15);

        // ===============================
        // 🧹 REMOVE NOISE
        // ===============================
        chunks = chunks.filter(c => {
            const text = c.content || "";
            return !isGarbage(text);
        });

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
        // 🔥 FALLBACK SEARCH
        // ===============================
        if (chunks.length < 4) {
            const fallback = await searchSimilar(query, 8);
            chunks = [...chunks, ...fallback];
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
            .trim()
            .slice(0, 2000);

        // ===============================
        // 🌐 LANGUAGE CONTROL
        // ===============================
        const isMarathi = language === "mr";

        const languageRule = isMarathi
            ? `
Respond ONLY in Marathi.
- Use natural spoken Marathi
- Expand answers when needed
`
            : `
Respond ONLY in English.
- Be natural, clear, and conversational
- Expand answers when needed
`;

        // ===============================
        // 🧠 FINAL SYSTEM PROMPT (UPGRADED)
        // ===============================
        const systemPrompt = `
You are an intelligent AI assistant for a website.

━━━━━━━━━━━━━━━━━━━━━━━
🎯 OBJECTIVE
━━━━━━━━━━━━━━━━━━━━━━━
Help users clearly understand the website using the provided context.

━━━━━━━━━━━━━━━━━━━━━━━
📌 RULES
━━━━━━━━━━━━━━━━━━━━━━━
- Use CONTEXT as primary source
- NEVER hallucinate fake data
- NEVER repeat same sentences
- NEVER sound robotic

━━━━━━━━━━━━━━━━━━━━━━━
🧠 RESPONSE BEHAVIOR
━━━━━━━━━━━━━━━━━━━━━━━
- Simple question → short answer (2–3 sentences)
- Detailed question → longer answer (4–6 sentences)
- If user asks again → expand further

- Services → explain clearly
- Pricing → extract numbers if present
- Projects/products → give examples
- General → summarize meaningfully

━━━━━━━━━━━━━━━━━━━━━━━
⚠️ IF INFO IS LIMITED
━━━━━━━━━━━━━━━━━━━━━━━
${isMarathi
                ? "पूर्ण माहिती उपलब्ध नाही, पण मी उपलब्ध माहितीवर आधारित मदत करू शकतो."
                : "Exact information is limited, but I can guide you based on available content."
            }

━━━━━━━━━━━━━━━━━━━━━━━
💬 STYLE
━━━━━━━━━━━━━━━━━━━━━━━
- Human-like and friendly
- Clear and confident
- No unnecessary repetition

- Always ask 1 natural follow-up question

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