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
} from "./types";

export type {
    CategoryProduct,
    CategorySubCat,
    CategoryAncestor,
    CategoryPageData,
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
 * @param catId  — MongoDB ObjectId string of the category being viewed
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

    return { products, subCats, ancestors, activeBox };
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
        _id:   String(p._id),
        title: p.title ?? "",
        slug:  p.slug  ?? "",
        info:  infoByPost[String(p._id)] ?? {},
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
