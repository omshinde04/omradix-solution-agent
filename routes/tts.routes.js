import express from "express";
import { handleTTS, handleTTSStream } from "../controllers/tts.controller.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const router = express.Router();

router.post("/", asyncHandler(handleTTS));           // OLD
router.post("/stream", asyncHandler(handleTTSStream)); // NEW ⚡

export default router;