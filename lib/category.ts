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
import { withCache } from "@/lib/cache";
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

const CATEGORY_CARD_FIELDS = [
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
    "brand",
];

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
    const [products, subCats, ancestors, activeBox] = await Promise.all([
        getProductsInCategory(catId),
        getSubCategories(catId),
        buildAncestorChain(catId),
        getActiveBoxTemplate(),
    ]);

    // Compute attribute options from already fetched products — no extra DB queries
    const attributeOptions = extractAttributeOptionsFromProducts(products);

    return { products, subCats, ancestors, activeBox, attributeOptions };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function compactVariate(raw: string): string {
    if (!raw || raw.length < 5000) return raw;
    try {
        const obj = JSON.parse(raw);
        if (Array.isArray(obj.variants) && obj.variants.length > 5) {
            obj.variants = obj.variants.slice(0, 5);
            return JSON.stringify(obj);
        }
    } catch {}
    return raw;
}

/** All published products in this category and every descendant sub-category */
async function getProductsInCategory(catId: string): Promise<CategoryProduct[]> {
    return withCache(`cat:products:v2:${catId}`, async () => {
        const allCatIds = await getDescendantIds(catId);
        const allCatIdStrings = allCatIds.map(id => String(id));

        const posts = await Post.find({
            category: { $in: [...allCatIds, ...allCatIdStrings] },
            type:     "product",
            status:   "published",
        })
            .select({ _id: 1, title: 1, slug: 1, category: 1 })
            .lean() as any[];

        if (posts.length === 0) return [];

        // Batch-fetch card-relevant post infos only with field projection (skips heavy specs)
        const infoRecords = await PostInfo.find({
            postId: { $in: posts.map((p: any) => p._id) },
            name: { $in: CATEGORY_CARD_FIELDS },
        })
            .select({ postId: 1, name: 1, value: 1 })
            .lean() as any[];

        const infoByPost: Record<string, Record<string, string>> = {};
        for (const r of infoRecords) {
            const key = String(r.postId);
            if (!infoByPost[key]) infoByPost[key] = {};
            infoByPost[key][r.name] = r.name === "_variate" ? compactVariate(r.value) : r.value;
        }

        return posts.map((p: any) => ({
            _id:      String(p._id),
            title:    p.title ?? "",
            slug:     p.slug  ?? "",
            category: p.category ? String(p.category) : null,
            info:     infoByPost[String(p._id)] ?? {},
        }));
    }, 300)();
}

/** Direct child categories of the given category */
async function getSubCategories(catId: string): Promise<CategorySubCat[]> {
    return withCache(`cat:subcats:${catId}`, async () => {
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
    })();
}

/** Walk up the parent chain to build root → leaf breadcrumb */
async function buildAncestorChain(catId: string): Promise<CategoryAncestor[]> {
    return withCache(`cat:ancestorchain:${catId}`, async () => {
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
    })();
}

/** Active product-box template from the Template DB collection */
async function getActiveBoxTemplate(): Promise<{ label: string; pluginNx: string } | null> {
    return withCache("template:default:product-box", async () => {
        const doc = await Template.findOne({
            type:      "product-box",
            isDefault: true,
        }).lean() as any;

        if (!doc) return null;
        return { label: doc.label as string, pluginNx: doc.pluginNx as string };
    })();
}

/**
 * Build attribute filter options from an existing list of CategoryProducts.
 * Zero database queries required!
 */
export function extractAttributeOptionsFromProducts(products: CategoryProduct[]): AttributeOption[] {
    try {
        const labelMap: Map<string, Set<string>> = new Map();

        for (const p of products) {
            let blob: Record<string, any>;
            try {
                blob = JSON.parse(p.info?.["_variate"] ?? "{}");
            } catch {
                continue;
            }

            const priceType: string = blob.priceType ?? "single";

            if (priceType === "single") {
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

        const byId = new Map<string, { id: string; label: string; values: Set<string> }>();
        for (const [label, valueSet] of labelMap) {
            if (valueSet.size === 0) continue;
            const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            if (!id) continue;
            if (!byId.has(id)) {
                byId.set(id, { id, label, values: new Set(valueSet) });
            } else {
                const existing = byId.get(id)!;
                valueSet.forEach((v) => existing.values.add(v));
            }
        }

        const results: AttributeOption[] = [];
        for (const item of byId.values()) {
            results.push({
                id: item.id,
                label: item.label,
                values: [...item.values].sort(),
            });
        }

        results.sort((a, b) => a.label.localeCompare(b.label));
        return results;
    } catch {
        return [];
    }
}

/** Backwards-compatible getAttributeOptions helper */
export async function getAttributeOptions(catId: string): Promise<AttributeOption[]> {
    const products = await getProductsInCategory(catId);
    return extractAttributeOptionsFromProducts(products);
}

/**
 * Fast in-memory tree traversal to collect catId + all descendant category ObjectIds.
 * Avoids dozens of sequential database roundtrips.
 */
async function getDescendantIds(catId: string): Promise<mongoose.Types.ObjectId[]> {
    const rootId = mongoose.Types.ObjectId.isValid(catId) ? new mongoose.Types.ObjectId(catId) : null;
    if (!rootId) return [];

    return withCache(`cat:descendants:${catId}`, async () => {
        // Fetch all categories once and build tree in memory
        const allCats = await withCache("cats:all-product-category-tree", async () => {
            return Cat.find({ type: "product-category", status: { $ne: "trash" } })
                .select("_id parentId")
                .lean() as unknown as any[];
        })();

        const childMap = new Map<string, mongoose.Types.ObjectId[]>();
        for (const c of allCats) {
            const p = String(c.parentId || "");
            if (!childMap.has(p)) childMap.set(p, []);
            childMap.get(p)!.push(c._id);
        }

        const result: mongoose.Types.ObjectId[] = [rootId];
        const queue = [String(rootId)];
        const visited = new Set<string>([String(rootId)]);

        while (queue.length > 0) {
            const parentId = queue.shift()!;
            const children = childMap.get(parentId) || [];
            for (const cid of children) {
                const sid = String(cid);
                if (!visited.has(sid)) {
                    visited.add(sid);
                    result.push(cid);
                    queue.push(sid);
                }
            }
        }

        return result;
    })();
}

