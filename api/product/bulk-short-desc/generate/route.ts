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

    // Strip accidental prompt artifacts like "//1 words", "// 1 words", "//1-4 words", etc.
    s = s.replace(/\s*\/\/\s*[^<:>]*(?:words?|wards?)/gi, "");
    s = s.replace(/\s*\/\/\s*\d+\s*(?:words?|wards?)/gi, "");

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

function parseJsonArrayFromText(responseText: string): any[] {
    if (!responseText) return [];
    let jsonStr = responseText.trim().replace(/^```(?:json|html)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const startIdx = jsonStr.indexOf("[");
    const endIdx = jsonStr.lastIndexOf("]");
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonStr = jsonStr.slice(startIdx, endIdx + 1);
    }

    try {
        return JSON.parse(jsonStr);
    } catch {
        try {
            const cleaned = jsonStr.replace(/,(\s*[}\]])/g, "$1");
            return JSON.parse(cleaned);
        } catch {
            const match = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (match) {
                try {
                    return JSON.parse(match[0]);
                } catch {}
            }
        }
    }
    return [];
}

function resolveChatCompletionsUrl(inputUrl: string): string {
    let url = (inputUrl || "").trim().replace(/\/+$/, "");
    if (!url) return "https://openrouter.ai/api/v1/chat/completions";
    if (url.endsWith("/chat/completions")) return url;
    if (url.endsWith("/v1")) return `${url}/chat/completions`;
    if (!url.includes("/api") && !url.includes("/v1")) return `${url}/api/v1/chat/completions`;
    return `${url}/chat/completions`;
}

// ── Custom / OpenAI-Compatible (OpenRouter, Groq, DeepSeek, etc.) ──────────────
async function processSubBatchWithCustom(
    chunk: BulkInputItem[],
    endpointUrl: string,
    apiKey: string,
    modelName: string,
    customPrompt?: string
): Promise<BulkOutputItem[]> {
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

    const targetEndpoint = resolveChatCompletionsUrl(endpointUrl);
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
    };
    if (targetEndpoint.includes("openrouter.ai")) {
        headers["HTTP-Referer"] = "https://ephotovn.com";
        headers["X-Title"] = "CMS Product Short Description Generator";
    }

    const payload = {
        model: modelName.trim(),
        messages: [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: `Generate short descriptions for the ${chunk.length} products listed in the system instructions. Respond ONLY with the JSON array matching the schema.`,
            },
        ],
        temperature: 0.3,
    };

    let responseText = "";
    let lastError: any = null;

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await fetch(targetEndpoint, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
                cache: "no-store",
            });

            const data = await res.json();
            if (!res.ok) {
                const errMsg =
                    data?.error?.message ||
                    data?.error ||
                    `HTTP ${res.status} from ${targetEndpoint}`;

                const isTemporary =
                    res.status === 429 ||
                    res.status === 503 ||
                    res.status === 502 ||
                    res.status === 504 ||
                    errMsg.toLowerCase().includes("rate limit") ||
                    errMsg.toLowerCase().includes("overloaded");

                if (isTemporary && attempt < MAX_RETRIES) {
                    const backoffMs = attempt * 2500;
                    console.warn(
                        `AI endpoint spike (${res.status}, attempt ${attempt}/${MAX_RETRIES}). Waiting ${backoffMs}ms...`
                    );
                    await new Promise((r) => setTimeout(r, backoffMs));
                    continue;
                }
                throw new Error(errMsg);
            }

            responseText =
                data?.choices?.[0]?.message?.content?.trim() ||
                data?.choices?.[0]?.text?.trim() ||
                "";
            if (responseText) {
                lastError = null;
                break;
            }
        } catch (err: any) {
            lastError = err;
            const errMsg = String(err?.message || "");
            const isTemporary =
                errMsg.includes("503") ||
                errMsg.includes("429") ||
                errMsg.includes("ETIMEDOUT") ||
                errMsg.includes("fetch failed");

            if (isTemporary && attempt < MAX_RETRIES) {
                const backoffMs = attempt * 2500;
                await new Promise((r) => setTimeout(r, backoffMs));
                continue;
            }
            break;
        }
    }

    if (lastError && !responseText) {
        const errMsg = lastError?.message || String(lastError);
        console.error(`Custom AI model "${modelName}" error:`, errMsg);
        throw new Error(`AI model "${modelName}" error: ${errMsg}`);
    }

    if (!responseText) {
        return Array.from(fallbackMap.values());
    }

    const parsedArray = parseJsonArrayFromText(responseText);
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

// ── Google Gemini ─────────────────────────────────────────────────────────────
async function processSubBatchWithGemini(
    chunk: BulkInputItem[],
    apiKey: string,
    modelName: string,
    customPrompt?: string
): Promise<BulkOutputItem[]> {
    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const selectedModel = modelName.replace(/^models\//, "").trim() || "gemini-2.5-flash";

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
                const backoffMs = attempt * 2500;
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

    const parsedArray = parseJsonArrayFromText(responseText);
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

        // Fetch settings
        const settings = await Settings();
        const activeProvider = (settings.product_ai_provider || "gemini").toLowerCase();

        const customPrompt =
            body?.prompt ||
            settings.product_gemini_prompt ||
            DEFAULT_SPECIFICATIONS_PROMPT;

        const CHUNK_SIZE = 20;
        const chunks: BulkInputItem[][] = [];
        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            chunks.push(items.slice(i, i + CHUNK_SIZE));
        }

        if (activeProvider === "custom") {
            const apiKey =
                settings.product_custom_api_key ||
                settings.openai_api_key ||
                process.env.OPENAI_API_KEY ||
                process.env.OPENROUTER_API_KEY ||
                "";

            if (!apiKey?.trim()) {
                return NextResponse.json(
                    {
                        error: "Custom / OpenRouter API Key is missing. Please configure your API key in Product Settings -> AI Settings.",
                    },
                    { status: 400 }
                );
            }

            const endpointUrl =
                settings.product_custom_base_url ||
                settings.openai_base_url ||
                "https://openrouter.ai/api/v1/chat/completions";

            const modelName =
                body?.model ||
                settings.product_custom_model ||
                settings.openai_model ||
                "meta-llama/llama-3.3-70b-instruct";

            const chunkResults = await Promise.all(
                chunks.map((chunk) =>
                    processSubBatchWithCustom(chunk, endpointUrl, apiKey, modelName, customPrompt)
                )
            );

            const allResults: BulkOutputItem[] = chunkResults.flat();

            return NextResponse.json({
                success: true,
                provider: "custom",
                model: modelName,
                results: allResults,
            });
        } else {
            // Gemini
            const apiKey =
                settings.product_gemini_api_key ||
                settings.gemini_api_key ||
                settings.seo_api_key ||
                process.env.GEMINI_API_KEY ||
                "";

            if (!apiKey?.trim()) {
                return NextResponse.json(
                    {
                        error: "Google Gemini API Key is missing. Please configure your Gemini API Key in Product Settings -> AI Settings.",
                    },
                    { status: 400 }
                );
            }

            const modelName =
                body?.model ||
                settings.product_gemini_model ||
                settings.seo_ai_model ||
                "gemini-2.5-flash";

            const chunkResults = await Promise.all(
                chunks.map((chunk) =>
                    processSubBatchWithGemini(chunk, apiKey, modelName, customPrompt)
                )
            );

            const allResults: BulkOutputItem[] = chunkResults.flat();

            return NextResponse.json({
                success: true,
                provider: "gemini",
                model: modelName,
                results: allResults,
            });
        }
    } catch (err: any) {
        console.error("Bulk short description generation error:", err);
        return NextResponse.json(
            { error: err?.message || "Internal server error during generation" },
            { status: 500 }
        );
    }
}

