import { NextResponse } from "next/server";
import { Settings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const settings = await Settings();

        const apiKey =
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
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Network error fetching Gemini models" },
            { status: 500 }
        );
    }
}
