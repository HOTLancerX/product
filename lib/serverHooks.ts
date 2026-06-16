/**
 * plugin/product/lib/serverHooks.ts — Server-only hook registration.
 *
 * Auto-discovered by hook/serverDataHooks.ts via require.context.
 * Registers data providers for product post types and category types.
 *
 * NEVER import this file from plugin/index.ts or any client component.
 */

import { registerServerDataHook } from "@/hook/serverDataHooks";
import { getCategoryPageData, getCategoryAncestors } from "./category";

// ── Category types — full page data (products, subCats, ancestors, activeBox)
registerServerDataHook("product-category", getCategoryPageData);
registerServerDataHook("brands",           getCategoryPageData);

// ── Product post type — ancestor breadcrumb for the category breadcrumb
// The fn receives (id=post._id, slug=post.slug, data=postData)
// data.category is the category ObjectId string — we fetch ancestors for it.
registerServerDataHook("product", async (_id, _slug, data) => {
    if (!data?.category) return { categoryLinks: [] };
    const ancestors = await getCategoryAncestors(String(data.category));
    return { ancestors };
});
