import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { URL } from "url";

// ================= CONFIG =================
const BASE_URL = "https://omradixsolutions.in"; // 🔁 change only this
const MAX_PAGES = 20;
const OUTPUT_FILE = path.resolve("./data/websiteContent.json");

// ================= STORAGE =================
const visited = new Set();
const toVisit = new Set([BASE_URL]);

// ================= UTILS =================
const cleanText = (text) =>
    text.replace(/\s+/g, " ").replace(/\n+/g, "\n").trim();

const removeDuplicates = (text) =>
    [...new Set(text.split("\n"))].join("\n");

const BASE_DOMAIN = new URL(BASE_URL).hostname.replace("www.", "");

// 🔥 Normalize URL (remove www + trailing slash)
const normalizeUrl = (base, link) => {
    try {
        const url = new URL(link, base);
        const host = url.hostname.replace("www.", "");
        return `${url.protocol}//${host}${url.pathname.replace(/\/$/, "")}`;
    } catch {
        return null;
    }
};

// 🔥 STRICT FILTER (only real HTML pages)
const isValidLink = (link) => {
    try {
        const u = new URL(link);
        const host = u.hostname.replace("www.", "");

        const isSameDomain = host === BASE_DOMAIN;

        const isAsset = link.match(
            /\.(css|js|json|png|jpg|jpeg|gif|svg|woff2?|ico|mp4|mp3)$/i
        );

        const isInternalJunk =
            link.includes("/_next/") ||
            link.includes("/static/") ||
            link.includes("/assets/");

        return (
            isSameDomain &&
            !isAsset &&
            !isInternalJunk &&
            !link.includes("mailto:") &&
            !link.includes("tel:")
        );
    } catch {
        return false;
    }
};

// ================= AUTO SCROLL =================
const autoScroll = async (page) => {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let total = 0;
            const step = 400;

            const timer = setInterval(() => {
                window.scrollBy(0, step);
                total += step;

                if (total >= document.body.scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 200);
        });
    });
};

// ================= SCRAPE PAGE =================
const scrapePage = async (browser, url) => {
    const page = await browser.newPage();

    try {
        console.log(`🔍 Scraping: ${url}`);

        // 🔥 Network interception (filtered)
        await page.setRequestInterception(true);

        page.on("request", (req) => {
            const reqUrl = normalizeUrl(BASE_URL, req.url());

            if (
                reqUrl &&
                isValidLink(reqUrl) &&
                !visited.has(reqUrl) &&
                !toVisit.has(reqUrl)
            ) {
                console.log("🌐 Page found:", reqUrl);
                toVisit.add(reqUrl);
            }

            req.continue();
        });

        await page.goto(url, {
            waitUntil: "networkidle2",
            timeout: 60000,
        });

        await page.waitForSelector("body");

        // allow JS to render
        await new Promise((r) => setTimeout(r, 3000));

        await autoScroll(page);

        // ================= EXTRACT TEXT =================
        const content = await page.evaluate(() => {
            const elements = document.querySelectorAll(
                "main, article, section, h1, h2, h3, h4, p, li"
            );

            let texts = [];

            elements.forEach((el) => {
                const text = el.innerText?.trim();
                if (text && text.length > 30) {
                    texts.push(text);
                }
            });

            return texts.join("\n");
        });

        // ================= EXTRACT LINKS =================
        const links = await page.evaluate(() =>
            Array.from(document.querySelectorAll("a"))
                .map((a) => a.href)
                .filter(Boolean)
        );

        let cleaned = removeDuplicates(cleanText(content));

        // 🔥 filter noise
        const finalContent = cleaned
            .split("\n")
            .filter((line) => {
                const t = line.toLowerCase();
                return (
                    line.length > 30 &&
                    line.length < 1000 &&
                    !t.includes("cookie") &&
                    !t.includes("privacy") &&
                    !t.includes("terms")
                );
            })
            .join("\n");

        // 🔗 add discovered links
        links.forEach((link) => {
            const normalized = normalizeUrl(url, link);

            if (
                normalized &&
                isValidLink(normalized) &&
                !visited.has(normalized) &&
                !toVisit.has(normalized)
            ) {
                toVisit.add(normalized);
            }
        });

        console.log(`📊 Queue: ${toVisit.size} | Visited: ${visited.size}`);

        await page.close();

        return {
            url,
            content: finalContent || cleaned,
        };
    } catch (err) {
        console.warn(`⚠️ Failed: ${url}`, err.message);
        await page.close();
        return null;
    }
};

// ================= MAIN =================
export const scrapeWebsite = async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox"],
    });

    try {
        console.log("🚀 Starting UNIVERSAL crawler...");

        let results = [];
        let count = 0;

        while (toVisit.size > 0 && count < MAX_PAGES) {
            const url = toVisit.values().next().value;
            toVisit.delete(url);

            if (visited.has(url)) continue;

            visited.add(url);

            console.log(`📍 [${count + 1}] Visiting: ${url}`);

            const pageData = await scrapePage(browser, url);

            if (pageData) {
                results.push(pageData);
            }

            count++;
        }

        fs.writeFileSync(
            OUTPUT_FILE,
            JSON.stringify(
                {
                    source: BASE_URL,
                    pagesScraped: visited.size,
                    totalPagesStored: results.length,
                    scrapedAt: new Date().toISOString(),
                    data: results,
                },
                null,
                2
            )
        );

        console.log("🎉 DONE");
        console.log(`✅ Pages scraped: ${visited.size}`);
        console.log(`📦 Stored pages: ${results.length}`);
    } catch (err) {
        console.error("❌ Scraper failed:", err.message);
    } finally {
        await browser.close();
    }
};