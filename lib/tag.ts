/**
 * plugin/product/lib/tag.ts
 *
 * Server-side helpers for the product tag page (domain/product/tag/[slug]).
 * Called directly from the slug page (app/(root)/[...slug]/page.tsx)
 * which already has a DB connection open.
 *
 * Reuses CategoryPageData structure so existing ProductCategoryLayout1
 * and ProductCategoryLayout2 can render it without any duplicate layouts.
 */

import mongoose from "mongoose";
import Post from "@/models/post";
import PostInfo from "@/models/post_info";
import Cat from "@/models/cat";
import Template from "@/models/template";
import { withCache } from "@/lib/cache";
import type {
    CategoryProduct,
    CategorySubCat,
    CategoryAncestor,
    CategoryPageData,
    AttributeOption,
} from "./types";
import { extractAttributeOptionsFromProducts } from "./category";

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

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Active product-box template from the Template DB collection */
async function getActiveBoxTemplate(): Promise<{ label: string; pluginNx: string } | null> {
    return withCache("template:default:product-box", async () => {
        const doc = (await Template.findOne({
            type: "product-box",
            isDefault: true,
        }).lean()) as any;

        if (!doc) return null;
        return { label: doc.label as string, pluginNx: doc.pluginNx as string };
    })();
}

/** Ancestors of tag if hierarchical */
async function buildTagAncestorChain(tagId: string): Promise<CategoryAncestor[]> {
    return withCache(`tag:ancestorchain:${tagId}`, async () => {
        const chain: CategoryAncestor[] = [];
        let current: any = await Cat.findById(tagId).lean();
        while (current) {
            chain.unshift({
                _id: String(current._id),
                title: current.title ?? "",
                slug: current.slug ?? "",
            });
            if (!current.parentId) break;
            current = await Cat.findById(current.parentId).lean();
        }
        return chain;
    })();
}

/** Sub tags of tag if hierarchical */
async function getSubTags(tagId: string): Promise<CategorySubCat[]> {
    return withCache(`tag:subtags:${tagId}`, async () => {
        if (!mongoose.Types.ObjectId.isValid(tagId)) return [];
        const cats = (await Cat.find({
            parentId: new mongoose.Types.ObjectId(tagId),
            type: "product-tag",
            status: "published",
        }).lean()) as any[];

        return cats.map((c: any) => ({
            _id: String(c._id),
            title: c.title ?? "",
            slug: c.slug ?? "",
        }));
    })();
}

/** Fetch all published products tagged with this tag */
async function getProductsInTag(tagId: string, tagSlug: string): Promise<CategoryProduct[]> {
    return withCache(`tag:products:${tagId || tagSlug}`, async () => {
        // Resolve tag doc
        let tagDoc: any = null;
        if (mongoose.Types.ObjectId.isValid(tagId)) {
            tagDoc = await Cat.findOne({ _id: tagId, type: "product-tag", status: { $ne: "trash" } }).lean();
        }
        if (!tagDoc && tagSlug) {
            tagDoc = await Cat.findOne({ slug: tagSlug, type: "product-tag", status: { $ne: "trash" } }).lean();
        }
        if (!tagDoc && tagId) {
            tagDoc = await Cat.findOne({ slug: tagId, type: "product-tag", status: { $ne: "trash" } }).lean();
        }

        const cleanId = tagDoc ? String(tagDoc._id) : tagId;
        const cleanSlug = tagDoc?.slug || tagSlug || tagId;
        const cleanTitle = tagDoc?.title || "";

        // Find post_info documents that have this tag in their "tags" array or string
        const regexQueries = [
            cleanId && { value: { $regex: new RegExp(`(^|["',\\s\\[])${escapeRegex(cleanId)}(["',\\s\\]]|$)`, "i") } },
            cleanSlug && { value: { $regex: new RegExp(`(^|["',\\s\\[])${escapeRegex(cleanSlug)}(["',\\s\\]]|$)`, "i") } },
            cleanTitle && { value: { $regex: new RegExp(`(^|["',\\s\\[])${escapeRegex(cleanTitle)}(["',\\s\\]]|$)`, "i") } },
        ].filter(Boolean) as any[];

        const taggedInfoDocs = (await PostInfo.find({
            name: "tags",
            $or: regexQueries,
        })
            .select("postId")
            .lean()) as any[];

        const taggedPostIds = taggedInfoDocs.map((d) => d.postId);

        const orConditions: any[] = [];
        if (taggedPostIds.length > 0) {
            orConditions.push({ _id: { $in: taggedPostIds } });
        }
        if (mongoose.Types.ObjectId.isValid(cleanId)) {
            const objId = new mongoose.Types.ObjectId(cleanId);
            orConditions.push({ tags: objId });
            orConditions.push({ tags: cleanId });
        } else if (cleanId) {
            orConditions.push({ tags: cleanId });
        }

        if (orConditions.length === 0) return [];

        const posts = (await Post.find({
            type: "product",
            status: "published",
            $or: orConditions,
        })
            .select({ _id: 1, title: 1, slug: 1, category: 1 })
            .lean()) as any[];

        if (posts.length === 0) return [];

        // Batch-fetch card-relevant post infos
        const infoRecords = (await PostInfo.find({
            postId: { $in: posts.map((p: any) => p._id) },
            name: { $in: CATEGORY_CARD_FIELDS },
        })
            .select({ postId: 1, name: 1, value: 1 })
            .lean()) as any[];

        const infoByPost: Record<string, Record<string, string>> = {};
        for (const r of infoRecords) {
            const key = String(r.postId);
            if (!infoByPost[key]) infoByPost[key] = {};
            infoByPost[key][r.name] = r.value;
        }

        return posts.map((p: any) => ({
            _id: String(p._id),
            title: p.title ?? "",
            slug: p.slug ?? "",
            category: p.category ? String(p.category) : null,
            info: infoByPost[String(p._id)] ?? {},
        }));
    }, 300)();
}

/**
 * Fetch all data needed for a product tag page.
 * Returns CategoryPageData compatible with ProductCategoryLayout1 & 2.
 */
export async function getTagPageData(
    tagId: string,
    tagSlug: string
): Promise<CategoryPageData> {
    const [products, subCats, ancestors, activeBox] = await Promise.all([
        getProductsInTag(tagId, tagSlug),
        getSubTags(tagId),
        buildTagAncestorChain(tagId),
        getActiveBoxTemplate(),
    ]);

    const attributeOptions = extractAttributeOptionsFromProducts(products);

    return {
        products,
        subCats,
        ancestors,
        activeBox,
        attributeOptions,
    };
}
