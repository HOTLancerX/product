import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Settings } from "@/lib/settings";

export const dynamic = "force-dynamic";

interface SpecField {
    title: string;
    description: string;
    image?: string;
}

interface SpecBox {
    title: string;
    icon?: string;
    fields: SpecField[];
}

function resolveChatCompletionsUrl(inputUrl: string): string {
    let url = (inputUrl || "").trim().replace(/\/+$/, "");
    if (!url) return "https://openrouter.ai/api/v1/chat/completions";
    if (url.endsWith("/chat/completions")) return url;
    if (url.endsWith("/v1")) return `${url}/chat/completions`;
    if (!url.includes("/api") && !url.includes("/v1")) return `${url}/api/v1/chat/completions`;
    return `${url}/chat/completions`;
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

/** Merge AI generated field values into original template boxes */
function mergeAiResults(originalBoxes: SpecBox[], aiBoxes: any[]): SpecBox[] {
    if (!Array.isArray(aiBoxes) || aiBoxes.length === 0) {
        return originalBoxes;
    }

    // Build a map of box title -> Map of field title -> description
    const aiDataMap = new Map<string, Map<string, string>>();

    aiBoxes.forEach((ab: any, bIdx: number) => {
        if (!ab) return;
        const boxTitleKey = String(ab.title || originalBoxes[bIdx]?.title || "").toLowerCase().trim();
        const fieldMap = new Map<string, string>();

        if (Array.isArray(ab.fields)) {
            ab.fields.forEach((f: any, fIdx: number) => {
                if (!f) return;
                const fieldTitleKey = String(f.title || originalBoxes[bIdx]?.fields[fIdx]?.title || "").toLowerCase().trim();
                const desc = String(f.description ?? f.value ?? "").trim();
                if (fieldTitleKey && desc) {
                    fieldMap.set(fieldTitleKey, desc);
                }
            });
        }

        if (boxTitleKey) {
            aiDataMap.set(boxTitleKey, fieldMap);
        }
    });

    // Merge into original boxes preserving order, images, and icons
    return originalBoxes.map((box, bIdx) => {
        const boxKey = box.title.toLowerCase().trim();
        const matchedFieldMap = aiDataMap.get(boxKey) || Array.from(aiDataMap.values())[bIdx];

        const updatedFields = box.fields.map((field, fIdx) => {
            const fieldKey = field.title.toLowerCase().trim();
            const aiDesc = matchedFieldMap?.get(fieldKey);

            if (aiDesc) {
                return {
                    ...field,
                    description: aiDesc,
                };
            }

            // Index-based fallback if title had slight mismatch
            const aiFieldsArray = aiBoxes[bIdx]?.fields;
            if (Array.isArray(aiFieldsArray) && aiFieldsArray[fIdx]?.description) {
                return {
                    ...field,
                    description: String(aiFieldsArray[fIdx].description).trim(),
                };
            }

            return field;
        });

        return {
            ...box,
            fields: updatedFields,
        };
    });
}

export async function GET() {
    try {
        const settings = await Settings();
        const activeProvider = (settings.product_ai_provider || "gemini").toLowerCase();

        const hasGeminiKey = Boolean(
            settings.product_gemini_api_key ||
            settings.gemini_api_key ||
            settings.seo_api_key ||
            process.env.GEMINI_API_KEY
        );

        const hasCustomKey = Boolean(
            settings.product_custom_api_key ||
            settings.openai_api_key ||
            process.env.OPENAI_API_KEY ||
            process.env.OPENROUTER_API_KEY
        );

        return NextResponse.json({
            provider: activeProvider,
            model: activeProvider === "custom"
                ? (settings.product_custom_model || "meta-llama/llama-3.3-70b-instruct")
                : (settings.product_gemini_model || "gemini-3.8-flash"),
            hasGeminiKey,
            hasCustomKey,
            isConfigured: activeProvider === "custom" ? hasCustomKey : hasGeminiKey,
        });
    } catch {
        return NextResponse.json({
            provider: "gemini",
            model: "gemini-3.8-flash",
            hasGeminiKey: false,
            hasCustomKey: false,
            isConfigured: false,
        });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const title: string = body?.title || "";
        const boxes: SpecBox[] = Array.isArray(body?.boxes) ? body.boxes : [];
        const customData: string = typeof body?.customData === "string" ? body.customData.trim() : "";

        if (!title.trim() && !customData) {
            return NextResponse.json(
                { error: "Product title or custom specifications data is required." },
                { status: 400 }
            );
        }

        if (boxes.length === 0) {
            return NextResponse.json(
                { error: "No specification boxes found to fill." },
                { status: 400 }
            );
        }

        const settings = await Settings();
        // Provider and model strictly follow the configuration from the Settings page
        const provider = (settings.product_ai_provider || "gemini").toLowerCase();

        // Prepare minimalist prompt schema
        const structureForPrompt = boxes.map((b) => ({
            title: b.title,
            fields: b.fields.map((f) => f.title),
        }));

        let promptText = "";

        if (customData) {
            promptText = `You are an expert technical product analyst and specification parser.
Product: "${title || "Unspecified Product"}"

The user has provided the following RAW PRODUCT SPECIFICATION / REFERENCE DATA:
"""
${customData}
"""

Task: Carefully analyze the provided reference data and extract or derive the exact specification values for each requested field in each category below.
1. Prioritize extracting the real, factual values from the provided reference data.
2. For any field not mentioned in the reference data, use your technical knowledge base to provide accurate specifications for "${title}", or a standard factual value / "N/A" if not applicable.
3. For each field, provide a concise, factual value in the "description" property (e.g. "Apple", "6.9-inch Super Retina XDR OLED", "120Hz ProMotion", "4685 mAh", "45W Fast Charging", "256GB / 512GB / 1TB", "Titanium Frame", etc.).
4. Output ONLY a valid JSON array matching the exact structure below without any markdown fences, without \`\`\`json or \`\`\`, and with no conversational text:

[
  {
    "title": "Category Name",
    "fields": [
      {
        "title": "Field Name",
        "description": "Specification Value"
      }
    ]
  }
]

Requested categories and fields:
${JSON.stringify(structureForPrompt, null, 2)}`;
        } else {
            promptText = `You are an expert technical product analyst and database.
Product: "${title}"

Task: Fill in the accurate, verified, real-world technical specifications for every field in each category below for "${title}".

REQUIREMENTS:
1. Provide authentic, real-world specifications for "${title}".
2. For each field, provide a concise, factual value in the "description" property (e.g. "Apple", "6.9-inch Super Retina XDR OLED", "120Hz ProMotion", "4685 mAh", "45W Fast Charging", "256GB / 512GB / 1TB", "Titanium Frame", etc.).
3. If an exact spec is unknown or not applicable to this product, provide a concise standard value or "N/A".
4. Output ONLY a valid JSON array matching the exact structure below without any markdown fences, without \`\`\`json or \`\`\`, and with no conversational text:

[
  {
    "title": "Category Name",
    "fields": [
      {
        "title": "Field Name",
        "description": "Specification Value"
      }
    ]
  }
]

Requested categories and fields:
${JSON.stringify(structureForPrompt, null, 2)}`;
        }

        let rawResponse = "";
        let usedModel = "";

        if (provider === "custom") {
            const apiKey =
                settings.product_custom_api_key ||
                settings.openai_api_key ||
                process.env.OPENAI_API_KEY ||
                process.env.OPENROUTER_API_KEY ||
                "";

            if (!apiKey.trim()) {
                return NextResponse.json(
                    {
                        error: "Custom / OpenRouter API Key is missing. Configure it in Product Settings -> AI Settings.",
                    },
                    { status: 400 }
                );
            }

            const endpointUrl = resolveChatCompletionsUrl(
                settings.product_custom_base_url ||
                settings.openai_base_url ||
                "https://openrouter.ai/api/v1/chat/completions"
            );

            usedModel =
                settings.product_custom_model ||
                settings.openai_model ||
                "meta-llama/llama-3.3-70b-instruct";

            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey.trim()}`,
            };

            if (endpointUrl.includes("openrouter.ai")) {
                headers["HTTP-Referer"] = "https://ephotovn.com";
                headers["X-Title"] = "CMS Product Specification Generator";
            }

            const res = await fetch(endpointUrl, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    model: usedModel.trim(),
                    messages: [
                        {
                            role: "system",
                            content: "You are a professional product specifications database. Output strictly valid JSON arrays.",
                        },
                        {
                            role: "user",
                            content: promptText,
                        },
                    ],
                    temperature: 0.2,
                }),
                cache: "no-store",
            });

            const data = await res.json();
            if (!res.ok) {
                return NextResponse.json(
                    { error: data?.error?.message || data?.error || `HTTP ${res.status} from custom AI endpoint` },
                    { status: 500 }
                );
            }

            rawResponse = data?.choices?.[0]?.message?.content || "";
        } else {
            // Google Gemini
            const apiKey =
                settings.product_gemini_api_key ||
                settings.gemini_api_key ||
                settings.seo_api_key ||
                process.env.GEMINI_API_KEY ||
                "";

            if (!apiKey.trim()) {
                return NextResponse.json(
                    {
                        error: "Google Gemini API Key is missing. Configure it in Product Settings -> AI Settings.",
                    },
                    { status: 400 }
                );
            }

            const configuredModel =
                settings.product_gemini_model ||
                "gemini-2.5-flash";

            const candidateModels = [
                configuredModel,
                "gemini-2.5-flash",
                "gemini-2.0-flash",
                "gemini-1.5-flash",
                "gemini-1.5-pro",
            ];

            const uniqueCandidates = Array.from(new Set(candidateModels));
            const genAI = new GoogleGenerativeAI(apiKey.trim());

            let lastError: any = null;
            for (const candidate of uniqueCandidates) {
                try {
                    const modelInstance = genAI.getGenerativeModel({
                        model: candidate,
                        generationConfig: {
                            temperature: 0.2,
                        },
                    });

                    const result = await modelInstance.generateContent(promptText);
                    const response = await result.response;
                    const text = response.text();

                    if (text && text.trim().length > 10) {
                        rawResponse = text;
                        usedModel = candidate;
                        break;
                    }
                } catch (err: any) {
                    lastError = err;
                    console.warn(`[Gemini Specs] Model ${candidate} failed:`, err?.message);
                }
            }

            if (!rawResponse) {
                return NextResponse.json(
                    {
                        error: lastError?.message || "Failed to generate specifications with Google Gemini.",
                    },
                    { status: 500 }
                );
            }
        }

        const parsedAiBoxes = parseJsonArrayFromText(rawResponse);
        const finalMergedBoxes = mergeAiResults(boxes, parsedAiBoxes);

        const totalFilled = finalMergedBoxes.reduce(
            (acc, b) => acc + b.fields.filter((f) => f.description && f.description.trim()).length,
            0
        );

        return NextResponse.json({
            success: true,
            provider,
            model: usedModel,
            boxes: finalMergedBoxes,
            totalFilled,
        });
    } catch (err: any) {
        console.error("Specification generate error:", err);
        return NextResponse.json(
            { error: err?.message || "Internal server error generating specifications." },
            { status: 500 }
        );
    }
}
