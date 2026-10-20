import { NextResponse } from "next/server";
import { Settings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function resolveModelsUrl(baseUrl: string): string {
    let clean = (baseUrl || "").trim().replace(/\/+$/, "");
    if (clean.endsWith("/chat/completions")) {
        clean = clean.replace(/\/chat\/completions$/, "");
    }
    if (clean.endsWith("/models")) {
        return clean;
    }
    return `${clean}/models`;
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const settings = await Settings();
        const provider = searchParams.get("provider") || settings.product_ai_provider || "gemini";

        if (provider === "custom") {
            const apiKey =
                searchParams.get("apiKey") ||
                settings.product_custom_api_key ||
                settings.openai_api_key ||
                process.env.OPENAI_API_KEY ||
                process.env.OPENROUTER_API_KEY ||
                "";

            const baseUrl =
                searchParams.get("baseUrl") ||
                settings.product_custom_base_url ||
                settings.openai_base_url ||
                "https://openrouter.ai/api/v1";

            if (!apiKey?.trim()) {
                return NextResponse.json(
                    { error: "API key is required to fetch models." },
                    { status: 400 }
                );
            }

            const modelsUrl = resolveModelsUrl(baseUrl);
            const headers: Record<string, string> = {
                Authorization: `Bearer ${apiKey.trim()}`,
            };
            if (modelsUrl.includes("openrouter.ai")) {
                headers["HTTP-Referer"] = "https://ephotovn.com";
                headers["X-Title"] = "CMS Product Short Description Generator";
            }

            const res = await fetch(modelsUrl, {
                headers,
                cache: "no-store",
            });
            const data = await res.json();

            if (!res.ok) {
                return NextResponse.json(
                    { error: data?.error?.message || data?.error || `Failed to fetch models from ${baseUrl}` },
                    { status: res.status }
                );
            }

            const rawList = Array.isArray(data?.data)
                ? data.data
                : Array.isArray(data?.models)
                ? data.models
                : [];

            const models = rawList
                .map((m: any) => (typeof m === "string" ? m : m.id || m.name || ""))
                .filter(Boolean)
                .slice(0, 100);

            return NextResponse.json({ models });
        } else {
            // Gemini
            const apiKey =
                searchParams.get("apiKey") ||
                settings.product_gemini_api_key ||
                settings.gemini_api_key ||
                settings.seo_api_key ||
                process.env.GEMINI_API_KEY ||
                "";

            if (!apiKey?.trim()) {
                return NextResponse.json({ error: "Gemini API key is not configured" }, { status: 400 });
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
            const res = await fetch(url, { cache: "no-store" });
            const data = await res.json();

            if (!res.ok) {
                return NextResponse.json(
                    { error: data?.error?.message || "Failed to fetch models from Google Gemini API" },
                    { status: res.status }
                );
            }

            const models = (data.models || [])
                .map((m: any) => m.name.replace(/^models\//, ""))
                .filter((name: string) => name.toLowerCase().includes("gemini") && !name.includes("embedding"));

            return NextResponse.json({ models });
        }
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Network error fetching AI models" },
            { status: 500 }
        );
    }
}

