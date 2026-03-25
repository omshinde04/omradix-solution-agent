import { scrapeWebsite } from "../services/scraper.service.js";

const run = async () => {
    await scrapeWebsite();
    process.exit();
};

run();