import express from "express";
import multer from "multer";
import { handleVoice } from "../controllers/voice.controller.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const router = express.Router();

// ===============================
// 📁 MULTER CONFIG (PRODUCTION SAFE)
// ===============================
const upload = multer({
    dest: "uploads/", // temp storage
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});

// ===============================
// 🎤 VOICE ROUTE
// ===============================
router.post(
    "/",
    upload.single("audio"), // 🔥 IMPORTANT (field name = audio)
    asyncHandler(handleVoice)
);

export default router;