import fs from "fs";

export const loadWebsiteContent = () => {
    try {
        const raw = fs.readFileSync("./data/websiteContent.json");
        const data = JSON.parse(raw);

        // 🔥 FIX: handle new structure
        return data.data
            ?.map((page) => page.content)
            .join("\n\n") || "";

    } catch (error) {
        console.error("❌ Error loading content:", error.message);
        return "";
    }
};