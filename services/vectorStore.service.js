import { generateEmbedding } from "./embedding.service.js";
import { loadWebsiteContent } from "./context.service.js";

// ===============================
// 🧠 IN-MEMORY VECTOR STORE
// ===============================
let vectorStore = [];

// ===============================
// 🧹 CLEAR VECTOR STORE (CRITICAL)
// ===============================
export const clearVectorStore = () => {
    vectorStore = [];
    console.log("🧹 Vector store cleared");
};

// ===============================
// 🧠 SPLIT INTO CHUNKS
// ===============================
const splitIntoChunks = (text, chunkSize = 300) => {
    const words = text.split(" ");
    const chunks = [];

    for (let i = 0; i < words.length; i += chunkSize) {
        const chunk = words.slice(i, i + chunkSize).join(" ").trim();

        if (chunk.length > 50) {
            chunks.push(chunk);
        }
    }

    return chunks;
};

// ===============================
// 🚀 BUILD VECTOR STORE
// ===============================
export const buildVectorStore = async () => {
    console.log("📦 Building vector store...");

    // 🔥 VERY IMPORTANT: clear old data
    clearVectorStore();

    const content = loadWebsiteContent();

    if (!content || content.length < 100) {
        throw new Error("❌ No valid content to build vector store");
    }

    const chunks = splitIntoChunks(content);

    for (let i = 0; i < chunks.length; i++) {
        try {
            const embedding = await generateEmbedding(chunks[i]);

            vectorStore.push({
                id: i,
                content: chunks[i],
                embedding,
            });

            console.log(`✅ Chunk ${i + 1}/${chunks.length} embedded`);
        } catch (err) {
            console.warn(`⚠️ Failed embedding chunk ${i}`);
        }
    }

    console.log(`🚀 Vector store ready with ${vectorStore.length} chunks`);
};

// ===============================
// 🔍 COSINE SIMILARITY
// ===============================
const cosineSimilarity = (a, b) => {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);

    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    return dot / (magA * magB);
};

// ===============================
// 🔎 SEARCH SIMILAR CHUNKS
// ===============================
export const searchSimilar = async (query, topK = 5) => {
    if (!vectorStore.length) {
        console.warn("⚠️ Vector store is empty");
        return [];
    }

    const queryEmbedding = await generateEmbedding(query);

    const scored = vectorStore.map((item) => ({
        content: item.content,
        score: cosineSimilarity(queryEmbedding, item.embedding),
    }));

    // sort descending
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK);
};