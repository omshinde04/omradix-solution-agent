import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { execSync } from "child_process";

const SARVAM_API_KEY = process.env.SARVAM_API_KEY?.trim();

// ===============================
// 📡 AXIOS CLIENT
// ===============================
const sttClient = axios.create({
    baseURL: "https://api.sarvam.ai",
    timeout: 25000,
});

// ===============================
// 🔍 LANGUAGE DETECTOR
// ===============================
const detectLanguage = (text = "") => {
    return /[\u0900-\u097F]/.test(text) ? "mr" : "en";
};

// ===============================
// 🔥 PERFECT WAV CONVERSION
// ===============================
const convertToWav = (inputPath) => {
    try {
        const outputPath = `${inputPath}.wav`;

        console.log("🔄 Converting → CLEAN WAV (STRICT)");

        execSync(
            `ffmpeg -y -i "${inputPath}" \
            -vn \
            -acodec pcm_s16le \
            -ar 16000 \
            -ac 1 \
            -f wav \
            "${outputPath}"`,
            { stdio: "ignore" }
        );

        if (!fs.existsSync(outputPath)) {
            throw new Error("WAV file not created");
        }

        console.log("✅ WAV READY:", outputPath);

        return outputPath;

    } catch (err) {
        console.error("❌ FFmpeg FAILED:", err.message);
        return null;
    }
};

// ===============================
// 🎤 FINAL STT (PRODUCTION)
// ===============================
export const speechToText = async (filePath, language = "en") => {
    const startTime = Date.now();
    let processedPath = null;

    try {
        if (!SARVAM_API_KEY) throw new Error("Missing API key");
        if (!filePath || !fs.existsSync(filePath))
            throw new Error("Audio file missing");

        console.log("\n==============================");
        console.log("🎤 STT START");
        console.log("📂 Input:", filePath);

        // ===============================
        // 🔄 CONVERT TO PERFECT WAV
        // ===============================
        processedPath = convertToWav(filePath);

        if (!processedPath) {
            throw new Error("Audio conversion failed");
        }

        console.log("📦 Using:", processedPath);
        console.log(
            "📏 Size:",
            fs.statSync(processedPath).size,
            "bytes"
        );

        // ===============================
        // 📤 FORM DATA (CRITICAL FIX)
        // ===============================
        const formData = new FormData();

        formData.append("file", fs.createReadStream(processedPath), {
            filename: "audio.wav",          // ✅ REQUIRED
            contentType: "audio/wav",       // ✅ REQUIRED
        });

        formData.append("model", "saarika:v2.5");
        formData.append(
            "language_code",
            language === "mr" ? "mr-IN" : "en-IN"
        );

        console.log("📤 Sending to Sarvam...");

        // ===============================
        // 🚀 API CALL
        // ===============================
        const response = await sttClient.post(
            "/speech-to-text",
            formData,
            {
                headers: {
                    "api-subscription-key": SARVAM_API_KEY,
                    ...formData.getHeaders(),
                },
                maxBodyLength: Infinity,
            }
        );

        let transcript = response?.data?.transcript || "";

        // ===============================
        // 🧹 CLEAN TEXT
        // ===============================
        transcript = transcript
            .replace(/\n+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        if (!transcript || transcript.length < 2) {
            console.log("⚠️ Empty STT result");

            return {
                text: "",
                language,
            };
        }

        const detectedLang = detectLanguage(transcript);
        const duration = Date.now() - startTime;

        console.log(`✅ STT DONE (${duration}ms)`);
        console.log("📝 Transcript:", transcript);
        console.log("==============================\n");

        return {
            text: transcript,
            language: detectedLang,
        };

    } catch (error) {
        console.error("\n❌ STT ERROR:");
        console.error(error.response?.data || error.message);
        console.log("==============================\n");

        return {
            text: "",
            language,
        };

    } finally {
        // ===============================
        // 🧹 CLEANUP
        // ===============================
        try {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            if (processedPath && fs.existsSync(processedPath)) {
                fs.unlinkSync(processedPath);
            }
        } catch (err) {
            console.warn("Cleanup error:", err.message);
        }
    }
};