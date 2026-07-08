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

    // Base pageData — other plugins enrich via registerProductEnricher()
    const base: Record<string, any> = {
        ancestors,
        seller,
        compareProducts:   [],
        categoryProducts:  [],
        flashSaleCampaign: null,
    };

    // Run all registered product enrichers (compare, flash-sale, etc.)
    // Each enricher receives the accumulating pageData + raw postData
    return runProductEnrichers(base, { ...data, _id: id });
});
