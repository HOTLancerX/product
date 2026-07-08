/**
 * plugin/product/lib/serverHooks.ts — Server-only hook registration.
 *
 * Auto-discovered by hook/serverDataHooks.ts via require.context.
 * Registers data providers for product post types and category types.
 *
 * The "product" hook is the central server-side data pipeline for product pages.
 * It merges data from:
 *   - Core:        category ancestors + seller info
 *   - compare:     compareProducts + categoryProducts (if compare plugin installed)
 *   - flash-sale:  active campaign for this product (if flash-sale plugin installed)
 *
 * Each optional data source is wrapped in try/catch so a missing plugin never
 * breaks the product page — it simply returns null/[].
 *
 * NEVER import this file from plugin/index.ts or any client component.
 */

import { registerServerDataHook } from "@/hook/serverDataHooks";
import { getCategoryPageData, getCategoryAncestors } from "./category";
import connectDB from "@/lib/mongodb";
import User from "@/models/Users";
import UserInfo from "@/models/Users_info";

// ── Category types — full page data (products, subCats, ancestors, activeBox)
registerServerDataHook("product-category", async (catId, catSlug) => {
    const base = await getCategoryPageData(catId, catSlug);

    // ── Optional: active flash-sale campaign for this category ────────────────
    let flashSaleCampaign: any = null;
    try {
        const { fetchProductFlashSale } = await import(
            "@/plugin/flash-sale/lib/serverHooks"
        );
        flashSaleCampaign = await fetchProductFlashSale("", catId);
    } catch { /* flash-sale plugin not installed */ }

    return { ...base, flashSaleCampaign };
});

registerServerDataHook("brands", getCategoryPageData);

// ── Product post type ─────────────────────────────────────────────────────────
// Returns:
//   ancestors            — category breadcrumb chain (always)
//   seller               — seller info if product has a userId (always)
//   compareProducts      — pre-selected compare products (compare plugin)
//   categoryProducts     — other products in same category (compare plugin)
//   flashSaleCampaign    — active campaign matching this product (flash-sale plugin)

registerServerDataHook("product", async (id, _slug, data) => {
    await connectDB();

    const productId  = id;
    const categoryId = data?.category ? String(data.category) : null;

    // ── Always: category breadcrumb ancestors ──────────────────────────────
    const ancestors = categoryId
        ? await getCategoryAncestors(categoryId)
        : [];

    // ── Always: seller info from product's userId PostInfo field ───────────
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

    // ── Optional: compare data (compare plugin) ────────────────────────────
    let compareProducts: any[]  = [];
    let categoryProducts: any[] = [];

    try {
        const rawCompare: string | undefined = data?.info?._compare;
        const compareIds: string[] = rawCompare
            ? (JSON.parse(rawCompare) as string[]).filter(Boolean)
            : [];

        if (compareIds.length > 0) {
            // Dynamic import — only executes when compare plugin is installed.
            const { fetchCompareData } = await import(
                "@/plugin/compare/lib/serverHooks"
            );
            const result = await fetchCompareData(compareIds, categoryId, productId);
            compareProducts  = result.compareProducts;
            categoryProducts = result.categoryProducts;
        }
    } catch { /* compare plugin not installed — skip */ }

    // ── Optional: flash-sale campaign (flash-sale plugin) ─────────────────
    let flashSaleCampaign: any = null;

    try {
        const { fetchProductFlashSale } = await import(
            "@/plugin/flash-sale/lib/serverHooks"
        );
        flashSaleCampaign = await fetchProductFlashSale(productId, categoryId);
    } catch { /* flash-sale plugin not installed — skip */ }

    return { ancestors, seller, compareProducts, categoryProducts, flashSaleCampaign };
});
