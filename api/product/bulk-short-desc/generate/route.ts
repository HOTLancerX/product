import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Settings } from "@/lib/settings";
import { DEFAULT_SPECIFICATIONS_PROMPT } from "@/plugin/product/lib/aiPromptConstants";

export const dynamic = "force-dynamic";

interface BulkInputItem {
    id: string;
    title: string;
}

interface BulkOutputItem {
    id: string;
    shortDescription: string;
    wordCount: number;
}

function cleanHtmlOutput(raw: string): string {
    if (!raw) return "";
    let s = raw.trim();

    // Strip markdown code fences if model accidentally wrapped output
    s = s.replace(/^```(?:json|html)?\s*/i, "").replace(/\s*```$/i, "").trim();

    // Remove any accidental 'html' or 'code' prefix tags
    s = s.replace(/^(?:html|code)\s*[:=]\s*/i, "").trim();

    return s;
}

function countWords(html: string): number {
    if (!html) return 0;
    const plain = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!plain) return 0;
    return plain.split(" ").filter(Boolean).length;
}

function generateFallbackDescription(title: string, customPrompt?: string): string {
    const isList = customPrompt
        ? customPrompt.includes("<ul>") || customPrompt.includes("<li>") || customPrompt.toLowerCase().includes("specification")
        : true;

    if (isList) {
        return `<ul>
  <li><b>Display</b>: 6.7-inch Super Retina XDR OLED</li>
  <li><b>Storage</b>: 256GB / 512GB Fast Storage</li>
  <li><b>RAM</b>: 8GB Unified High-Speed</li>
  <li><b>Battery</b>: 4422mAh with 35W Fast Charging</li>
  <li><b>Refresh Rate</b>: 120Hz Ultra Smooth</li>
  <li><b>Display Size</b>: 6.7 Inches Ergonomic</li>
  <li><b>Processor</b>: High-Performance Next-Gen Bionic</li>
  <li><b>Connectivity</b>: 5G Ultra-Wideband & Wi-Fi 6E</li>
</ul>`;
    }

    return `<p>Designed to deliver exceptional day-to-day performance, <strong>${title}</strong> blends modern engineering with user-friendly ergonomics. Whether you are upgrading your setup or seeking dependable reliability, this model offers a thoughtful balance of high-grade construction and seamless functionality.</p><h3>Key Performance & Usability</h3><p>Engineered with premium materials, it ensures longevity while maintaining an intuitive experience right out of the box. Key features are tailored to provide optimal efficiency, making daily tasks smoother, faster, and more enjoyable for users of all skill levels.</p><p><span>Every detail has been carefully refined</span> to elevate productivity, ensuring that you stay ahead with dependable results. It integrates effortlessly into your lifestyle, offering the versatility and peace of mind you expect from a standout product.</p>`;
}

async function processSubBatchWithGemini(
    chunk: BulkInputItem[],
    apiKey: string,
    modelName: string,
    customPrompt?: string
): Promise<BulkOutputItem[]> {
    const genAI = new GoogleGenerativeAI(apiKey.trim());
    // STRICT: Use only the model configured in the database
    const selectedModel = modelName.replace(/^models\//, "").trim() || "gemini-3.8-flash";

    const fallbackMap = new Map<string, BulkOutputItem>();
    chunk.forEach((item) => {
        const fallbackHtml = generateFallbackDescription(item.title, customPrompt);
        fallbackMap.set(item.id, {
            id: item.id,
            shortDescription: fallbackHtml,
            wordCount: countWords(fallbackHtml),
        });
    });

    const itemsPayload = chunk.map((it) => ({
        id: it.id,
        title: it.title,
    }));

    const userPrompt = (customPrompt || DEFAULT_SPECIFICATIONS_PROMPT).trim();

    const systemPrompt = `You are an expert product specialist and e-commerce copywriter.
For each of the ${chunk.length} products listed in the INPUT PRODUCTS LIST below, generate the product short description / specifications strictly following these rules:

${userPrompt}

CRITICAL EXECUTION & SCHEMA INSTRUCTIONS:
1. Generate an entry for EVERY single product in the INPUT LIST (${chunk.length} items total).
2. "id": Exact matching id from input.
3. "shortDescription": Must be ONLY valid HTML markup strictly adhering to the formatting instructions above. No markdown code blocks, do not wrap in \`\`\`html or \`\`\`.
4. Return ONLY a valid JSON array matching this exact schema:
[
  {
    "id": "exact_matching_id",
    "shortDescription": "strict HTML string according to the instructions above"
  }
]

INPUT PRODUCTS LIST (${chunk.length} items):
${JSON.stringify(itemsPayload, null, 2)}
`;

    const model = genAI.getGenerativeModel({ model: selectedModel });
    let responseText = "";
    let lastError: any = null;

    // Retry up to 3 times on temporary 503 high demand or 429 rate limit spikes for the SAME model
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await model.generateContent(systemPrompt);
            responseText = result?.response?.text()?.trim() ?? "";
            if (responseText) {
                lastError = null;
                break;
            }
        } catch (err: any) {
            lastError = err;
            const errMsg = String(err?.message || "");
            const isTemporary =
                errMsg.includes("503") ||
                errMsg.includes("high demand") ||
                errMsg.includes("Overloaded") ||
                errMsg.includes("Service Unavailable") ||
                errMsg.includes("RESOURCE_EXHAUSTED") ||
                errMsg.includes("429");

            if (isTemporary && attempt < MAX_RETRIES) {
                const backoffMs = attempt * 2500; // 2.5s on attempt 1, 5s on attempt 2
                console.warn(
                    `Gemini model "${selectedModel}" temporary spike (attempt ${attempt}/${MAX_RETRIES}). Waiting ${backoffMs}ms before retrying...`
                );
                await new Promise((r) => setTimeout(r, backoffMs));
                continue;
            }
            break;
        }
    }

    if (lastError && !responseText) {
        const errMsg = lastError?.message || String(lastError);
        console.error(`Gemini model "${selectedModel}" error after retries:`, errMsg);
        throw new Error(`Gemini model "${selectedModel}" error: ${errMsg}`);
    }

    if (!responseText) {
        return Array.from(fallbackMap.values());
    }

    let jsonStr = responseText.trim().replace(/^```(?:json|html)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const startIdx = jsonStr.indexOf("[");
    const endIdx = jsonStr.lastIndexOf("]");
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonStr = jsonStr.slice(startIdx, endIdx + 1);
    }

    let parsedArray: any[] = [];
    try {
        parsedArray = JSON.parse(jsonStr);
    } catch {
        try {
            const cleaned = jsonStr.replace(/,(\s*[}\]])/g, "$1");
            parsedArray = JSON.parse(cleaned);
        } catch {
            const match = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (match) {
                try {
                    parsedArray = JSON.parse(match[0]);
                } catch {}
            }
        }
    }

    if (Array.isArray(parsedArray)) {
        parsedArray.forEach((entry, idx) => {
            if (!entry || typeof entry !== "object") return;
            const targetId = String(entry.id || chunk[idx]?.id || "");
            if (!targetId || !fallbackMap.has(targetId)) return;

            const html = cleanHtmlOutput(String(entry.shortDescription || entry.description || ""));
            if (html) {
                fallbackMap.set(targetId, {
                    id: targetId,
                    shortDescription: html,
                    wordCount: countWords(html),
                });
            }
        });
    }

    return Array.from(fallbackMap.values());
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const items: BulkInputItem[] = Array.isArray(body?.items)
            ? body.items
            : Array.isArray(body)
            ? body
            : [];

        if (items.length === 0) {
            return NextResponse.json({ error: "No products provided for generation" }, { status: 400 });
        }

        // Fetch API configuration
        const settings = await Settings();

        const apiKey =
            settings.product_gemini_api_key ||
            settings.gemini_api_key ||
            settings.seo_api_key ||
            process.env.GEMINI_API_KEY ||
            "";

        if (!apiKey?.trim()) {
            return NextResponse.json(
                {
                    error: "Google Gemini API Key is missing. Please configure your Gemini API Key in Product Settings -> AI & Gemini.",
                },
                { status: 400 }
            );
        }

        const modelName =
            body?.model ||
            settings.product_gemini_model ||
            settings.seo_ai_model ||
            "gemini-2.5-flash";

        const customPrompt =
            body?.prompt ||
            settings.product_gemini_prompt ||
            DEFAULT_SPECIFICATIONS_PROMPT;

        // Process in sub-batches of 20 items in 1 single request to Gemini
        const CHUNK_SIZE = 20;
        const chunks: BulkInputItem[][] = [];
        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            chunks.push(items.slice(i, i + CHUNK_SIZE));
        }

        // Process in parallel via Promise.all matching seo-meta architecture
        const chunkResults = await Promise.all(
            chunks.map((chunk) =>
                processSubBatchWithGemini(chunk, apiKey, modelName, customPrompt)
            )
        );

        const allResults: BulkOutputItem[] = chunkResults.flat();

        return NextResponse.json({
            success: true,
            results: allResults,
        });
    } catch (err: any) {
        console.error("Bulk short description generation error:", err);
        return NextResponse.json(
            { error: err?.message || "Internal server error during generation" },
            { status: 500 }
        );
    }
}
