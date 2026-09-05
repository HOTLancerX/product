/**
 * plugin/product/lib/serverHooks.ts — Server-only hook registration.
 *
 * Auto-discovered by hook/serverDataHooks.ts via require.context.
 *
 * Registers data providers for:
 *   - "product"          → ancestors + seller + any registered product enrichers
 *   - "product-category" → full category page data + any category enrichers
 *   - "brands"           → same as product-category
 *
 * Other plugins (compare, flash-sale, etc.) call registerProductEnricher()
 * or registerCategoryEnricher() in their own lib/serverHooks.ts files.
 * Those files are also auto-discovered — zero manual imports here.
 *
 * NEVER import this from plugin/index.ts or any client component.
 */

import { registerServerDataHook, runProductEnrichers, runCategoryEnrichers } from "@/hook/serverDataHooks";
import { getCategoryPageData, getCategoryAncestors } from "./category";
import connectDB from "@/lib/mongodb";
import User from "@/models/Users";
import UserInfo from "@/models/Users_info";
import Post from "@/models/post";
import PostInfo from "@/models/post_info";
import Cat from "@/models/cat";
import Comment from "@/models/Comment";
import { Settings } from "@/lib/settings";

// ── Category types ────────────────────────────────────────────────────────────

registerServerDataHook("product-category", async (catId, catSlug, catData) => {
    const base = await getCategoryPageData(catId, catSlug);
    // Run all registered category enrichers (e.g. flash-sale adds flashSaleCampaign)
    return runCategoryEnrichers(base as unknown as Record<string, any>, catData ?? { _id: catId, slug: catSlug });
});

registerServerDataHook("brands", async (catId, catSlug, catData) => {
    const base = await getCategoryPageData(catId, catSlug);
    return runCategoryEnrichers(base as unknown as Record<string, any>, catData ?? { _id: catId, slug: catSlug });
});

// ── Product post type ─────────────────────────────────────────────────────────

registerServerDataHook("product", async (id, _slug, data) => {
    await connectDB();

    const categoryId = data?.category ? String(data.category) : null;

    // ── Always: category breadcrumb ancestors ─────────────────────────────
    const ancestors = categoryId ? await getCategoryAncestors(categoryId) : [];

    // ── Always: seller info ───────────────────────────────────────────────
    const userIdInfo = data?.info?.userId as string | undefined;
    let seller: Record<string, string> | null = null;

    if (userIdInfo) {
        try {
            const sellerUser = await User.findById(userIdInfo).lean() as any;
            if (sellerUser) {
                const uiDocs = await UserInfo.find({ userId: sellerUser._id }).lean() as any[];
                const uiMap: Record<string, string> = {};
                uiDocs.forEach((d: any) => { uiMap[d.name] = String(d.value ?? ""); });
                seller = {
                    _id:     String(sellerUser._id),
                    name:    String(sellerUser.name    ?? ""),
                    image:   String(sellerUser.image   ?? ""),
                    slug:    String(sellerUser.slug    ?? ""),
                    city:    String(sellerUser.city    ?? ""),
                    state:   String(sellerUser.state   ?? ""),
                    bio:     String(uiMap.bio     ?? ""),
                    website: String(uiMap.website ?? ""),
                    twitter: String(uiMap.twitter ?? ""),
                };
            }
        } catch { /* non-critical */ }
    }

    // ── Related products in same category ─────────────────────────────────
    let categoryProducts: any[] = [];
    if (categoryId) {
        try {
            const settingsObj = await Settings();
            const limit = Math.max(36, parseInt((settingsObj?.related_products_total as string) ?? "36", 10) || 36);

            const catPosts = await Post.find({
                category: categoryId,
                type: "product",
                status: "published",
                _id: { $ne: id },
            }).limit(limit).lean() as any[];

            if (catPosts.length > 0) {
                const postIds = catPosts.map((p) => p._id);
                const infoDocs = await PostInfo.find({ postId: { $in: postIds } }).lean() as any[];
                const infoByPost: Record<string, Record<string, string>> = {};
                infoDocs.forEach((d) => {
                    const pid = String(d.postId);
                    if (!infoByPost[pid]) infoByPost[pid] = {};
                    infoByPost[pid][d.name] = String(d.value ?? "");
                });

                categoryProducts = catPosts.map((p) => ({
                    _id:       String(p._id),
                    title:     String(p.title    ?? ""),
                    slug:      String(p.slug     ?? ""),
                    type:      String(p.type     ?? ""),
                    status:    String(p.status   ?? ""),
                    category:  p.category ? String(p.category) : null,
                    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt ?? ""),
                    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt ?? ""),
                    info:      infoByPost[String(p._id)] || {},
                }));
            }
        } catch { /* non-critical */ }
    }

    // ── Brand Info ────────────────────────────────────────────────────────
    const brandId = data?.info?.brand || data?.info?.brandId || (data as any)?.brand;
    let brand: { _id: string; title: string; slug: string } | null = null;
    if (brandId) {
        try {
            let catDoc = await Cat.findOne({ _id: brandId, type: "brands" }).lean() as any;
            if (!catDoc) {
                catDoc = await Cat.findOne({ slug: String(brandId), type: "brands" }).lean() as any;
            }
            if (!catDoc) {
                catDoc = await Cat.findOne({ title: String(brandId), type: "brands" }).lean() as any;
            }
            if (catDoc) {
                brand = {
                    _id:   String(catDoc._id),
                    title: String(catDoc.title ?? ""),
                    slug:  String(catDoc.slug  ?? ""),
                };
            }
        } catch { /* non-critical */ }
    }

    // ── Approved Product Reviews & Rating Summary ─────────────────────────
    let reviewsData: {
        reviews: any[];
        averageRating: number;
        totalReviews: number;
        distribution: Record<number, number>;
    } = {
        reviews: [],
        averageRating: 0,
        totalReviews: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };

    try {
        const approvedComments = await Comment.find({
            targetType: "product",
            targetId: String(id),
            status: "approved",
        }).sort({ createdAt: -1 }).lean() as any[];

        if (approvedComments && approvedComments.length > 0) {
            const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
            let ratingSum = 0;
            let ratingCount = 0;

            const sanitizedReviews = approvedComments.map((c) => {
                const r = Number(c.rating) || 5;
                if (r >= 1 && r <= 5) {
                    distribution[r as 1 | 2 | 3 | 4 | 5] = (distribution[r as 1 | 2 | 3 | 4 | 5] || 0) + 1;
                    ratingSum += r;
                    ratingCount++;
                }

                return {
                    _id: String(c._id),
                    userName: String(c.userName || "Customer"),
                    userImage: String(c.userImage || ""),
                    rating: r,
                    title: String(c.title || ""),
                    content: String(c.content || ""),
                    images: Array.isArray(c.images) ? c.images : [],
                    orderNumber: String(c.orderNumber || ""),
                    verifiedPurchase: Boolean(c.verifiedPurchase),
                    reply: c.reply?.content
                        ? {
                              content: String(c.reply.content),
                              authorName: String(c.reply.authorName || "Seller"),
                              authorRole: String(c.reply.authorRole || "seller"),
                              createdAt: c.reply.createdAt instanceof Date ? c.reply.createdAt.toISOString() : String(c.reply.createdAt || ""),
                          }
                        : null,
                    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt || ""),
                };
            });

            const averageRating = ratingCount > 0 ? parseFloat((ratingSum / ratingCount).toFixed(1)) : 0;

            reviewsData = {
                reviews: sanitizedReviews,
                averageRating,
                totalReviews: sanitizedReviews.length,
                distribution,
            };
        }
    } catch { /* non-critical */ }

    // Base pageData — other plugins enrich via registerProductEnricher()
    const base: Record<string, any> = {
        ancestors,
        seller,
        brand,
        compareProducts:   [],
        categoryProducts,
        flashSaleCampaign: null,
        reviewsData,
    };

    // Run all registered product enrichers (compare, flash-sale, etc.)
    // Each enricher receives the accumulating pageData + raw postData
    return runProductEnrichers(base, { ...data, _id: id });
});
