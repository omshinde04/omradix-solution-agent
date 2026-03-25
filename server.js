import dotenv from "dotenv";
dotenv.config(); // ✅ ALWAYS FIRST

import express from "express";
import cors from "cors";
import morgan from "morgan";

import askRoutes from "./routes/ask.routes.js";
import voiceRoutes from "./routes/voice.routes.js";
import ttsRoutes from "./routes/tts.routes.js";

import { errorHandler } from "./middlewares/error.middleware.js";
import { loadModel } from "./services/embedding.service.js";
import { buildVectorStore } from "./services/vectorStore.service.js";

const app = express();

// ===============================
// 🔍 DEBUG ENV (SAFE PRINT)
// ===============================
const apiKey = process.env.SARVAM_API_KEY;

if (!apiKey) {
    console.error("❌ SARVAM_API_KEY is NOT set in .env");
} else {
    console.log("✅ API KEY LOADED:", apiKey.substring(0, 6) + "********");
}

// ===============================
// 🔐 GLOBAL SAFETY HANDLERS
// ===============================
process.on("unhandledRejection", (err) => {
    console.error("❌ Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err);
});

// ===============================
// 🔧 MIDDLEWARE (OPTIMIZED)
// ===============================
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("tiny"));

// Keep connection alive
app.use((req, res, next) => {
    res.setHeader("Connection", "keep-alive");
    next();
});

// ===============================
// ❤️ HEALTH CHECK
// ===============================
app.get("/", (req, res) => {
    res.status(200).json({
        status: "OK",
        message: "🚀 Omradix AI Assistant Running",
        uptime: process.uptime(),
        timestamp: new Date(),
    });
});

// 🔥 Ping route
app.get("/ping", (req, res) => {
    res.status(200).send("pong");
});

// ===============================
// 🛣 ROUTES
// ===============================
app.use("/api/ask", askRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/tts", ttsRoutes);

// ===============================
// ❌ 404 HANDLER
// ===============================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});

// ===============================
// 🔥 GLOBAL ERROR HANDLER
// ===============================
app.use(errorHandler);

// ===============================
// 🚀 START SERVER
// ===============================
const PORT = process.env.PORT || 10000;

const startServer = async () => {
    try {
        console.log("🚀 Starting Omradix AI Server...");

        // ===============================
        // ⚡ LOAD MODEL
        // ===============================
        console.log("⚡ Loading AI model...");
        await loadModel();

        // ===============================
        // 📦 BUILD VECTOR STORE
        // ===============================
        console.log("⚡ Building vector store...");
        await buildVectorStore();

        console.log("✅ AI system ready");

        // ===============================
        // 🚀 START SERVER
        // ===============================
        const server = app.listen(PORT, "0.0.0.0", () => {
            console.log(`🌍 Server live on port ${PORT}`);
        });

        // ===============================
        // 🛑 GRACEFUL SHUTDOWN
        // ===============================
        const shutdown = (signal) => {
            console.log(`🛑 ${signal} received. Shutting down...`);
            server.close(() => {
                console.log("✅ Server closed");
                process.exit(0);
            });
        };

        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);

    } catch (error) {
        console.error("❌ Failed to start server:", error.message);
        process.exit(1);
    }
};

startServer();