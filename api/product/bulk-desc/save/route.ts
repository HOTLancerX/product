import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import PostInfo from "@/models/post_info";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

function sanitizeHtml(raw: string): string {
    if (!raw) return "";
    return raw
        .replace(/\s*\/\/\s*[^<:>]*(?:words?|wards?)/gi, "")
        .replace(/\s*\/\/\s*\d+\s*(?:words?|wards?)/gi, "")
        .trim();
}

export async function POST(req: Request) {
    try {
        await connectDB();

        const body = await req.json();
        const rawItems: any[] = Array.isArray(body)
            ? body
            : Array.isArray(body?.items)
            ? body.items
            : [];

        if (rawItems.length === 0) {
            return NextResponse.json({ error: "No items provided to save" }, { status: 400 });
        }

        const validItems = rawItems
            .map((item) => {
                const postId = String(item.id || item.postId || item._id || "");
                const description = sanitizeHtml(String(item.description || item.value || ""));
                return { postId, description };
            })
            .filter((item) => item.postId && mongoose.Types.ObjectId.isValid(item.postId));

        if (validItems.length === 0) {
            return NextResponse.json({ error: "No valid product IDs in batch" }, { status: 400 });
        }

        const bulkOps = validItems.map((item) => {
            return {
                updateOne: {
                    filter: {
                        postId: new mongoose.Types.ObjectId(item.postId),
                        name: "description",
                    },
                    update: {
                        $set: {
                            postId: new mongoose.Types.ObjectId(item.postId),
                            name: "description",
                            value: item.description,
                        },
                    },
                    upsert: true,
                },
            };
        });

        const result = await PostInfo.bulkWrite(bulkOps, { ordered: false });

        return NextResponse.json({
            success: true,
            savedCount: validItems.length,
            upserted: result.upsertedCount,
            modified: result.modifiedCount,
        });
    } catch (err: any) {
        console.error("Bulk save product description error:", err);
        return NextResponse.json(
            { error: err?.message || "Failed to save product descriptions" },
            { status: 500 }
        );
    }
}
