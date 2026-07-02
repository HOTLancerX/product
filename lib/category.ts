/**
 * plugin/product/lib/category.ts
 *
 * Server-side helpers for the product category page.
 * Called directly from the slug page (app/(root)/[...slug]/page.tsx)
 * which already has a DB connection open.
 *
 * Returns plain serialisable objects — safe to pass as props to any
 * server or client component without ObjectId / Date serialisation issues.
 *
 * No Mongoose imports here that could leak into the client bundle —
 * this file is only ever imported inside page.tsx (a pure server file).
 */

import mongoose from "mongoose";
import Post     from "@/models/post";
import PostInfo from "@/models/post_info";
import Cat      from "@/models/cat";
import Template from "@/models/template";
import type {
    CategoryProduct,
    CategorySubCat,
    CategoryAncestor,
    CategoryPageData,
    AttributeOption,
} from "./types";

export type {
    CategoryProduct,
    CategorySubCat,
    CategoryAncestor,
    CategoryPageData,
    AttributeOption,
};

/**
 * Fetch the ancestor breadcrumb chain for a single category id.
 * Used by product page layouts to build the category breadcrumb
 * without any HTTP fetch — direct DB call, server-side only.
 */
export async function getCategoryAncestors(
    catId: string
): Promise<CategoryAncestor[]> {
    return buildAncestorChain(catId);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetch all data needed for a product category page.
 *
 * @param catId   — MongoDB ObjectId string of the category being viewed
 * @param catSlug — slug of the category being viewed (for ancestor lookup)
 */
export async function getCategoryPageData(
    catId: string,
    catSlug: string
): Promise<CategoryPageData> {
    const [products, subCats, ancestors, activeBox, attributeOptions] = await Promise.all([
        getProductsInCategory(catId),
        getSubCategories(catId),
        buildAncestorChain(catId),
        getActiveBoxTemplate(),
        getAttributeOptions(catId),
    ]);

    return { products, subCats, ancestors, activeBox, attributeOptions };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** All published products in this category and every descendant sub-category */
async function getProductsInCategory(catId: string): Promise<CategoryProduct[]> {
    const allCatIds = await getDescendantIds(catId);

    const posts = await Post.find({
        category: { $in: allCatIds },
        type:     "product",
        status:   "published",
    }).lean() as any[];

    if (posts.length === 0) return [];

    // Batch-fetch all post infos in one query
    const infoRecords = await PostInfo.find({
        postId: { $in: posts.map((p: any) => p._id) },
    }).lean() as any[];

    const infoByPost: Record<string, Record<string, string>> = {};
    for (const r of infoRecords) {
        const key = String(r.postId);
        if (!infoByPost[key]) infoByPost[key] = {};
        infoByPost[key][r.name] = r.value;
    }

    return posts.map((p: any) => ({
        _id:      String(p._id),
        title:    p.title ?? "",
        slug:     p.slug  ?? "",
        category: p.category ? String(p.category) : null,
        info:     infoByPost[String(p._id)] ?? {},
    }));
}

/** Direct child categories of the given category */
async function getSubCategories(catId: string): Promise<CategorySubCat[]> {
    const cats = await Cat.find({
        parentId: new mongoose.Types.ObjectId(catId),
        type:     "product-category",
        status:   "published",
    }).lean() as any[];

    return cats.map((c: any) => ({
        _id:   String(c._id),
        title: c.title ?? "",
        slug:  c.slug  ?? "",
    }));
}

/** Walk up the parent chain to build root → leaf breadcrumb */
async function buildAncestorChain(catId: string): Promise<CategoryAncestor[]> {
    const chain: CategoryAncestor[] = [];
    let current: any = await Cat.findById(catId).lean();
    while (current) {
        chain.unshift({
            _id:   String(current._id),
            title: current.title ?? "",
            slug:  current.slug  ?? "",
        });
        if (!current.parentId) break;
        current = await Cat.findById(current.parentId).lean();
    }
    return chain;
}

/** Active product-box template from the Template DB collection */
async function getActiveBoxTemplate(): Promise<{ label: string; pluginNx: string } | null> {
    const doc = await Template.findOne({
        type:      "product-box",
        isDefault: true,
    }).lean() as any;

    if (!doc) return null;
    return { label: doc.label as string, pluginNx: doc.pluginNx as string };
}

/**
 * Build attribute filter options for the given category.
 *
 * Product attribute values are stored as a single JSON blob in PostInfo
 * with name="_variate". The blob contains:
 *
 *   Single products:  { singleAttributes: [{ dbId, label, values: string[] }] }
 *   Variant products: { selectedAttributes: [{ dbId, label, values: string[] }],
 *                       variants: [{ options: { [label]: value } }] }
 *
 * We read all _variate blobs for products in this category tree, extract
 * every distinct (label → value) pair, then group them into AttributeOption[]
 * sorted by label.
 *
 * The `id` on each AttributeOption is the attribute label lowercased + slugified
 * so it stays stable as a URL param key (attr_<id>).
 *
 * Returns an empty array when no attribute values are found — the UI will
 * then hide the filter panel entirely.
 */
async function getAttributeOptions(catId: string): Promise<AttributeOption[]> {
    try {
        // 1. Get all products in this category tree
        const allCatIds = await getDescendantIds(catId);
        const posts = await Post.find({
            category: { $in: allCatIds },
            type:     "product",
            status:   "published",
        }).select("_id").lean() as any[];

        if (posts.length === 0) return [];

        const postIds = posts.map((p: any) => p._id);

        // 2. Fetch the _variate blob for every product in one query
        const variateDocs = await PostInfo.find({
            postId: { $in: postIds },
            name:   "_variate",
        }).lean() as any[];

        if (variateDocs.length === 0) return [];

        // 3. Accumulate distinct values per attribute label
        const labelMap: Map<string, Set<string>> = new Map();

        for (const doc of variateDocs) {
            let blob: Record<string, any>;
            try { blob = JSON.parse(doc.value ?? "{}"); } catch { continue; }

            const priceType: string = blob.priceType ?? "single";

            if (priceType === "single") {
                // singleAttributes: [{ dbId, label, values: string[] }]
                const attrs: { dbId?: string; label: string; values: string[] }[] =
                    blob.singleAttributes ?? [];

                for (const attr of attrs) {
                    if (!attr.label || !Array.isArray(attr.values)) continue;
                    const key = attr.label.trim();
                    if (!key) continue;
                    if (!labelMap.has(key)) labelMap.set(key, new Set());
                    for (const v of attr.values) {
                        const clean = String(v ?? "").trim();
                        if (clean) labelMap.get(key)!.add(clean);
                    }
                }
            } else {
                // Variant: collect from selectedAttributes.values + variant options
                const selectedAttributes: { dbId?: string; label: string; values: string[] }[] =
                    blob.selectedAttributes ?? [];

                for (const attr of selectedAttributes) {
                    if (!attr.label || !Array.isArray(attr.values)) continue;
                    const key = attr.label.trim();
                    if (!key) continue;
                    if (!labelMap.has(key)) labelMap.set(key, new Set());
                    for (const v of attr.values) {
                        const clean = String(v ?? "").trim();
                        if (clean) labelMap.get(key)!.add(clean);
                    }
                }

                // Also pull values actually used in generated variants
                const variants: { options?: Record<string, string> }[] = blob.variants ?? [];
                for (const variant of variants) {
                    if (!variant.options) continue;
                    for (const [label, val] of Object.entries(variant.options)) {
                        const key = label.trim();
                        const clean = String(val ?? "").trim();
                        if (!key || !clean) continue;
                        if (!labelMap.has(key)) labelMap.set(key, new Set());
                        labelMap.get(key)!.add(clean);
                    }
                }
            }
        }

        if (labelMap.size === 0) return [];

        // 4. Build AttributeOption[] — id is a stable URL-safe slug from the label
        const results: AttributeOption[] = [];
        for (const [label, valueSet] of labelMap) {
            const values = [...valueSet].sort();
            if (values.length === 0) continue;
            const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            results.push({ id, label, values });
        }

        // Sort groups alphabetically by label
        results.sort((a, b) => a.label.localeCompare(b.label));

        return results;
    } catch {
        // Non-critical — category page still works without filters
        return [];
    }
}

/** Recursively collect catId + all descendant category ObjectIds */
async function getDescendantIds(catId: string): Promise<mongoose.Types.ObjectId[]> {
    const result: mongoose.Types.ObjectId[] = [new mongoose.Types.ObjectId(catId)];
    const queue = [catId];

    while (queue.length > 0) {
        const parentId = queue.shift()!;
        const children = await Cat
            .find({ parentId: new mongoose.Types.ObjectId(parentId) })
            .select("_id")
            .lean() as any[];

        for (const c of children) {
            result.push(c._id);
            queue.push(String(c._id));
        }
    }

    return result;
}
