import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Post from "@/models/post";
import PostInfo from "@/models/post_info";

export const dynamic = "force-dynamic";

function getWordCount(html: string): number {
    if (!html) return 0;
    const plain = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!plain) return 0;
    return plain.split(" ").filter(Boolean).length;
}

function isHtmlEmpty(html: string): boolean {
    if (!html) return true;
    const plain = html.replace(/<[^>]*>/g, "").trim();
    return plain.length === 0;
}

export async function GET(req: Request) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
        const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
        const filter = searchParams.get("filter") || "missing"; // "missing" | "all" | "completed"
        const search = searchParams.get("search")?.trim() || "";
        const category = searchParams.get("category")?.trim() || "";

        // Base query for products
        const query: Record<string, any> = {
            type: "product",
            status: { $ne: "trash" },
        };

        if (search) {
            query.title = { $regex: search, $options: "i" };
        }

        if (category && category !== "all") {
            query.category = category;
        }

        // Handle missing / completed short description filters
        if (filter === "missing") {
            const completedDocs = await PostInfo.find({
                name: "shortDescription",
                value: { $exists: true, $ne: "" },
            }).select("postId value").lean();

            // Filter out docs that have non-empty text
            const completedPostIds = completedDocs
                .filter((d: any) => !isHtmlEmpty(String(d.value || "")))
                .map((d: any) => d.postId);

            query._id = { $nin: completedPostIds };
        } else if (filter === "completed") {
            const completedDocs = await PostInfo.find({
                name: "shortDescription",
                value: { $exists: true, $ne: "" },
            }).select("postId value").lean();

            const completedPostIds = completedDocs
                .filter((d: any) => !isHtmlEmpty(String(d.value || "")))
                .map((d: any) => d.postId);

            query._id = { $in: completedPostIds };
        }

        const total = await Post.countDocuments(query);
        const skip = (page - 1) * limit;

        const posts = await Post.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select("_id title slug category status createdAt")
            .lean();

        // Fetch shortDescription info for current page
        const postIds = posts.map((p: any) => p._id);
        const infoDocs = await PostInfo.find({
            postId: { $in: postIds },
            name: "shortDescription",
        }).lean();

        const descMap = new Map<string, string>();
        infoDocs.forEach((d: any) => {
            descMap.set(String(d.postId), String(d.value || ""));
        });

        const items = posts.map((p: any) => {
            const shortDesc = descMap.get(String(p._id)) || "";
            const hasShortDesc = !isHtmlEmpty(shortDesc);
            const wordCount = getWordCount(shortDesc);

            return {
                id: String(p._id),
                title: String(p.title || ""),
                slug: String(p.slug || ""),
                category: String(p.category || ""),
                status: String(p.status || "draft"),
                shortDescription: shortDesc,
                hasShortDesc,
                wordCount,
                createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : "",
            };
        });

        // Calculate total missing count across all products
        const totalMissingCount = await (async () => {
            try {
                const totalProducts = await Post.countDocuments({ type: "product", status: { $ne: "trash" } });
                const completedDocs = await PostInfo.find({
                    name: "shortDescription",
                    value: { $exists: true, $ne: "" },
                }).select("postId value").lean();

                const validCompleted = completedDocs.filter((d: any) => !isHtmlEmpty(String(d.value || ""))).length;
                return Math.max(0, totalProducts - validCompleted);
            } catch {
                return 0;
            }
        })();

        return NextResponse.json({
            posts: items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
                totalMissingCount,
            },
        });
    } catch (err: any) {
        console.error("Error fetching products for bulk short description:", err);
        return NextResponse.json(
            { error: err?.message || "Failed to load products" },
            { status: 500 }
        );
    }
}
