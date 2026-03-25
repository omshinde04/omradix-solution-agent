import express from "express";
import { handleAsk } from "../controllers/ask.controller.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const router = express.Router();

router.post("/", asyncHandler(handleAsk));

export default router;