import { pipeline } from "@xenova/transformers";

let embedder;

// load model once (important)
export const loadModel = async () => {
    if (!embedder) {
        console.log("📦 Loading embedding model...");
        embedder = await pipeline(
            "feature-extraction",
            "Xenova/all-MiniLM-L6-v2"
        );
        console.log("✅ Embedding model loaded");
    }
};

// generate embedding
export const generateEmbedding = async (text) => {
    if (!embedder) {
        throw new Error("Model not loaded");
    }

    if (!text || text.length < 5) {
        return new Array(384).fill(0); // avoid crashes
    }

    const output = await embedder(text, {
        pooling: "mean",
        normalize: true,
    });

    return Array.from(output.data);
};