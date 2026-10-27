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
import { getBrandPageData } from "./brand";
import { getTagPageData } from "./tag";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import User from "@/models/Users";
import UserInfo from "@/models/Users_info";
import Post from "@/models/post";
import PostInfo from "@/models/post_info";
import Cat from "@/models/cat";
import Comment from "@/models/Comment";
import { Settings } from "@/lib/settings";
import { withCache } from "@/lib/cache";

const PRODUCT_CARD_FIELDS = [
    "_variate",
    "images",
    "image",
    "thumbnail",
    "featured_image",
    "_thumbnail_id",
    "regularPrice",
    "salePrice",
    "price",
    "shortDescription",
    "badge",
    "rating",
    "reviews",
    "shipping_inside",
    "shipping_outside",
];

// ── Category types ────────────────────────────────────────────────────────────

registerServerDataHook("product-category", async (catId, catSlug, catData) => {
    const base = await withCache(`cat:page:${catId}`, () => getCategoryPageData(catId, catSlug))();
    // Run all registered category enrichers (e.g. flash-sale adds flashSaleCampaign)
    return runCategoryEnrichers(base as unknown as Record<string, any>, catData ?? { _id: catId, slug: catSlug });
});

registerServerDataHook("brands", async (catId, catSlug, catData) => {
    const subCategorySlug = (catData as any)?.subCategorySlug || null;
    const base = await withCache(`brand:page:${catId}:${subCategorySlug || "all"}`, () => getBrandPageData(catId, catSlug, subCategorySlug))();
    return runCategoryEnrichers(base as unknown as Record<string, any>, catData ?? { _id: catId, slug: catSlug });
});

registerServerDataHook("product-tag", async (catId, catSlug, catData) => {
    const base = await withCache(`tag:page:${catId}`, () => getTagPageData(catId, catSlug))();
    return runCategoryEnrichers(base as unknown as Record<string, any>, catData ?? { _id: catId, slug: catSlug });
});

// ── Product post type ─────────────────────────────────────────────────────────

registerServerDataHook("product", async (id, _slug, data) => {
    return withCache(`product:full_page_data:${id}`, async () => {
        await connectDB();

    const categoryId = (data?.category || data?.info?.category || data?.info?.categoryId)
        ? String(data?.category || data?.info?.category || data?.info?.categoryId)
        : null;
    const userIdInfo = data?.info?.userId as string | undefined;

    let rawBrand = (data as any)?.brands || (data as any)?.brand || data?.info?.brand || data?.info?.brandId;
    if (typeof rawBrand === "string" && rawBrand.startsWith("{")) {
        try {
            const parsed = JSON.parse(rawBrand);
            rawBrand = parsed.id || rawBrand;
        } catch { /* keep */ }
    }

    // ── 1. Category breadcrumb ancestors (cached) ─────────────────────────
    const ancestorsPromise = categoryId
        ? withCache(`cat:ancestors:${categoryId}`, () => getCategoryAncestors(categoryId))()
        : Promise.resolve([]);

    // ── 2. Seller info (cached) ───────────────────────────────────────────
    const sellerPromise = userIdInfo
        ? withCache(`user:seller:${userIdInfo}`, async () => {
            try {
                const sellerUser = await User.findById(userIdInfo).lean() as any;
                if (!sellerUser) return null;
                const uiDocs = await UserInfo.find({ userId: sellerUser._id }).lean() as any[];
                const uiMap: Record<string, string> = {};
                uiDocs.forEach((d: any) => { uiMap[d.name] = String(d.value ?? ""); });
                return {
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
            } catch {
                return null;
            }
        })()
        : Promise.resolve(null);

    // ── 3. Related products in same category (shared category cache) ─────
    const categoryProductsPromise = categoryId
        ? withCache(`cat:related_products:${categoryId}`, async () => {
            try {
                const settingsObj = await Settings();
                const limit = Math.min(20, Math.max(6, parseInt((settingsObj?.related_products_total as string) ?? "12", 10) || 12));

                const catObj = mongoose.Types.ObjectId.isValid(categoryId)
                    ? new mongoose.Types.ObjectId(categoryId)
                    : null;
                const catFilter = catObj ? { $in: [catObj, categoryId] } : categoryId;

                let catPosts = await Post.find({
                    category: catFilter,
                    type: "product",
                    status: "published",
                }).limit(limit + 1).lean() as any[];

                if (catPosts.length === 0) {
                    catPosts = await Post.find({
                        type: "product",
                        status: "published",
                    }).limit(limit + 1).lean() as any[];
                }

                if (catPosts.length === 0) return [];

                const postIds = catPosts.map((p) => p._id);
                const infoDocs = await PostInfo.find({
                    postId: { $in: postIds },
                    name: { $in: PRODUCT_CARD_FIELDS },
                }).lean() as any[];

                const infoByPost: Record<string, Record<string, string>> = {};
                infoDocs.forEach((d) => {
                    const pid = String(d.postId);
                    if (!infoByPost[pid]) infoByPost[pid] = {};
                    infoByPost[pid][d.name] = String(d.value ?? "");
                });

                return catPosts.map((p) => ({
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
            } catch {
                return [];
            }
        })().then((list: any[]) => (list || []).filter((p: any) => String(p._id) !== String(id)).slice(0, 12))
        : withCache(`products:recent_fallback`, async () => {
            try {
                const catPosts = await Post.find({
                    type: "product",
                    status: "published",
                }).limit(15).lean() as any[];

                if (catPosts.length === 0) return [];

                const postIds = catPosts.map((p) => p._id);
                const infoDocs = await PostInfo.find({
                    postId: { $in: postIds },
                    name: { $in: PRODUCT_CARD_FIELDS },
                }).lean() as any[];

                const infoByPost: Record<string, Record<string, string>> = {};
                infoDocs.forEach((d) => {
                    const pid = String(d.postId);
                    if (!infoByPost[pid]) infoByPost[pid] = {};
                    infoByPost[pid][d.name] = String(d.value ?? "");
                });

                return catPosts.map((p) => ({
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
            } catch {
                return [];
            }
        })().then((list: any[]) => (list || []).filter((p: any) => String(p._id) !== String(id)).slice(0, 12));

    // ── 4. Brand Info (cached) ────────────────────────────────────────────
    const brandPromise = rawBrand
        ? withCache(`cat:brand:${rawBrand}`, async () => {
            try {
                let catDoc = await Cat.findOne({ _id: rawBrand, type: "brands" }).lean() as any;
                if (!catDoc) {
                    catDoc = await Cat.findOne({ slug: String(rawBrand), type: "brands" }).lean() as any;
                }
                if (!catDoc) {
                    catDoc = await Cat.findOne({ title: String(rawBrand), type: "brands" }).lean() as any;
                }
                if (!catDoc) {
                    catDoc = await Cat.findOne({ _id: rawBrand }).lean() as any;
                }
                if (catDoc) {
                    return {
                        _id:   String(catDoc._id),
                        title: String(catDoc.title ?? ""),
                        slug:  String(catDoc.slug  ?? ""),
                    };
                }
                return null;
            } catch {
                return null;
            }
        })()
        : Promise.resolve(null);

    // ── 5. Approved Product Reviews & Rating Summary (cached) ─────────────
    const reviewsPromise = withCache(`product:reviews:${id}`, async () => {
        let initialData: {
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

                initialData = {
                    reviews: sanitizedReviews,
                    averageRating,
                    totalReviews: sanitizedReviews.length,
                    distribution,
                };
            }
        } catch { /* non-critical */ }

        return initialData;
    })();

    // ── 6. Product Tags (cached) ──────────────────────────────────────────
    let rawTags = data?.info?.tags || (data as any)?.tags || data?.info?.tag || (data as any)?.tag;
    let parsedTagIds: string[] = [];
    if (typeof rawTags === "string") {
        try {
            const parsed = JSON.parse(rawTags);
            if (Array.isArray(parsed)) {
                parsedTagIds = parsed.map((item) =>
                    typeof item === "object" && item ? item.id || item._id || item.slug : String(item)
                ).filter(Boolean);
            } else if (parsed && typeof parsed === "object") {
                parsedTagIds = [parsed.id || parsed._id || parsed.slug].filter(Boolean);
            } else if (parsed) {
                parsedTagIds = [String(parsed)].filter(Boolean);
            }
        } catch {
            parsedTagIds = rawTags.split(",").map((s) => s.trim()).filter(Boolean);
        }
    } else if (Array.isArray(rawTags)) {
        parsedTagIds = rawTags.map((item) =>
            typeof item === "object" && item ? item.id || item._id || item.slug : String(item)
        ).filter(Boolean);
    }

    if (parsedTagIds.length === 0 && id) {
        try {
            const tagInfoDoc = await PostInfo.findOne({ postId: id, name: "tags" }).lean() as any;
            if (tagInfoDoc?.value) {
                try {
                    const parsed = JSON.parse(tagInfoDoc.value);
                    if (Array.isArray(parsed)) {
                        parsedTagIds = parsed.map((item) =>
                            typeof item === "object" && item ? item.id || item._id || item.slug : String(item)
                        ).filter(Boolean);
                    } else if (parsed) {
                        parsedTagIds = [String(parsed)].filter(Boolean);
                    }
                } catch {
                    parsedTagIds = tagInfoDoc.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                }
            }
        } catch { /* keep empty */ }
    }

    const tagsPromise = parsedTagIds.length > 0
        ? withCache(`product:tags:${parsedTagIds.slice().sort().join(",")}`, async () => {
            try {
                const objectIds = parsedTagIds
                    .filter((tid) => mongoose.Types.ObjectId.isValid(tid))
                    .map((tid) => new mongoose.Types.ObjectId(tid));

                const orConditions: any[] = [];
                if (objectIds.length > 0) {
                    orConditions.push({ _id: { $in: objectIds } });
                }
                if (parsedTagIds.length > 0) {
                    orConditions.push({ slug: { $in: parsedTagIds } });
                    orConditions.push({ title: { $in: parsedTagIds } });
                }

                if (orConditions.length === 0) return [];

                const tagDocs = await Cat.find({
                    $or: orConditions,
                    type: { $in: ["product-tag", "tag"] },
                    status: { $ne: "trash" },
                }).select("_id title slug").lean() as any[];

                const docsMap = new Map<string, any>();
                (tagDocs || []).forEach((t) => {
                    docsMap.set(String(t._id), t);
                    docsMap.set(String(t.slug), t);
                });

                const resolvedList: { _id: string; title: string; slug: string }[] = [];
                const seenIds = new Set<string>();
                for (const tid of parsedTagIds) {
                    const doc = docsMap.get(tid);
                    if (doc && !seenIds.has(String(doc._id))) {
                        seenIds.add(String(doc._id));
                        resolvedList.push({
                            _id: String(doc._id),
                            title: String(doc.title ?? ""),
                            slug: String(doc.slug ?? ""),
                        });
                    }
                }

                return resolvedList.length > 0
                    ? resolvedList
                    : (tagDocs || []).map((t) => ({
                          _id: String(t._id),
                          title: String(t.title ?? ""),
                          slug: String(t.slug ?? ""),
                      }));
            } catch {
                return [];
            }
        })()
        : Promise.resolve([]);

    // Run all 6 sub-queries in parallel
    const [ancestors, seller, categoryProducts, brand, reviewsData, tags] = await Promise.all([
        ancestorsPromise,
        sellerPromise,
        categoryProductsPromise,
        brandPromise,
        reviewsPromise,
        tagsPromise,
    ]);

    // Base pageData — other plugins (e.g. gadgets, compare, flash-sale) enrich via registerProductEnricher()
    const base: Record<string, any> = {
        ancestors,
        tags,
        seller,
        brand,
        compareProducts:   [],
        categoryProducts,
        frequentlyTogether: [],
        flashSaleCampaign: null,
        reviewsData,
    };

        // Run all registered product enrichers (compare, flash-sale, etc.)
        return runProductEnrichers(base, { ...data, _id: id });
    })();
});
