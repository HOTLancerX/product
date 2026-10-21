/**
 * plugin/product/lib/brand.ts
 *
 * Server-side data provider for Brand Pages (e.g. /brands/xiaomi and /brands/xiaomi/phone).
 * Direct database execution, server-only.
 * Returns plain serializable objects for SSR with zero client-side layout shift.
 */

import mongoose from "mongoose";
import Post from "@/models/post";
import PostInfo from "@/models/post_info";
import Cat from "@/models/cat";
import CatInfo from "@/models/cat_info";
import Template from "@/models/template";
import type {
    CategoryProduct,
    CategoryAncestor,
    AttributeOption,
} from "./types";

export interface BrandPopularCategory {
    _id: string;
    title: string;
    slug: string;
    image?: string;
    count: number;
}

export interface BrandPageData {
    brand: {
        _id: string;
        title: string;
        slug: string;
        image?: string;
        description?: string;
    };
    products: CategoryProduct[];
    allBrandProducts: CategoryProduct[];
    popularCategories: BrandPopularCategory[];
    ancestors: CategoryAncestor[];
    activeBox: { label: string; pluginNx: string } | null;
    attributeOptions: AttributeOption[];
    activeCategorySlug?: string | null;
    activeCategoryTitle?: string | null;
    totalCount: number;
    minPrice: number;
    maxPrice: number;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getBrandPageData(
    brandId: string,
    brandSlug: string,
    subCategorySlug?: string | null
): Promise<BrandPageData> {
    // 1. Resolve Brand Category Document
    let brandDoc: any = null;
    if (mongoose.Types.ObjectId.isValid(brandId)) {
        brandDoc = await Cat.findOne({ _id: brandId, type: "brands", status: { $ne: "trash" } }).lean();
    }
    if (!brandDoc && brandSlug) {
        brandDoc = await Cat.findOne({ slug: brandSlug, type: "brands", status: { $ne: "trash" } }).lean();
    }
    if (!brandDoc) {
        // Fallback search by title
        brandDoc = await Cat.findOne({
            title: { $regex: new RegExp(`^${escapeRegex(brandSlug)}$`, 'i') },
            type: "brands",
            status: { $ne: "trash" }
        }).lean();
    }

    const brandTitle = brandDoc?.title || brandSlug || "Brand";
    const brandCleanId = brandDoc ? String(brandDoc._id) : brandId;
    const brandCleanSlug = brandDoc?.slug || brandSlug;

    // 2. Fetch Brand Products
    const brandRegex = new RegExp(`(^|\\s)${escapeRegex(brandTitle)}(\\s|$)`, 'i');

    // Find any postinfos explicitly tagging this brand
    const brandPostInfoDocs = await PostInfo.find({
        name: { $in: ["brand", "brands", "brandId", "brand_id"] },
        value: { $in: [brandCleanId, brandCleanSlug, brandTitle] },
    }).select("postId").lean() as any[];

    const taggedPostIds = brandPostInfoDocs.map((d) => d.postId);

    const postQuery: any = {
        type: "product",
        status: "published",
        $or: [
            ...(taggedPostIds.length > 0 ? [{ _id: { $in: taggedPostIds } }] : []),
            ...(mongoose.Types.ObjectId.isValid(brandCleanId) ? [{ brands: new mongoose.Types.ObjectId(brandCleanId) }] : []),
            { brands: brandCleanId },
            { title: { $regex: brandRegex } },
        ],
    };

    const rawPosts = await Post.find(postQuery)
        .sort({ createdAt: -1 })
        .limit(300)
        .lean() as any[];

    // 3. Batch-fetch postinfos for all found posts
    const postIds = rawPosts.map((p) => p._id);
    const infoRecords = await PostInfo.find({
        postId: { $in: postIds },
    }).lean() as any[];

    const infoByPost: Record<string, Record<string, string>> = {};
    for (const r of infoRecords) {
        const key = String(r.postId);
        if (!infoByPost[key]) infoByPost[key] = {};
        infoByPost[key][r.name] = String(r.value ?? "");
    }

    const allProducts: CategoryProduct[] = rawPosts.map((p) => ({
        _id: String(p._id),
        title: p.title ?? "",
        slug: p.slug ?? "",
        category: p.category ? String(p.category) : null,
        info: infoByPost[String(p._id)] || {},
    }));

    // 4. Fetch all product categories to compute Popular Categories
    const allCategories = await Cat.find({
        type: "product-category",
        status: { $ne: "trash" },
    }).lean() as any[];

    // Map cat info for image thumbnails
    const catInfoRecords = await CatInfo.find({
        catId: { $in: allCategories.map((c) => c._id) },
        name: { $in: ["image", "thumbnail", "icon"] },
    }).lean() as any[];

    const catImageMap: Record<string, string> = {};
    for (const ci of catInfoRecords) {
        catImageMap[String(ci.catId)] = ci.value;
    }

    // Tally product counts per category for this brand
    const categoryCounts: Record<string, number> = {};
    for (const prod of allProducts) {
        let assignedCatId = prod.category ? String(prod.category) : '';

        // If not directly assigned, check if product title matches any category title
        if (!assignedCatId) {
            const titleLower = prod.title.toLowerCase();
            const matched = allCategories.find((c) => {
                const cTitleLower = c.title.toLowerCase().replace(/phones?$/i, '').trim();
                return cTitleLower.length > 3 && titleLower.includes(cTitleLower);
            });
            if (matched) {
                assignedCatId = String(matched._id);
            }
        }

        if (assignedCatId) {
            categoryCounts[assignedCatId] = (categoryCounts[assignedCatId] || 0) + 1;
        }
    }

    // Build Popular Categories list: ONLY categories with count > 0 ("যেগুলো জিরো সেগুলো দেখাবে না")
    const popularCategories: BrandPopularCategory[] = allCategories
        .filter((c) => (categoryCounts[String(c._id)] || 0) > 0)
        .map((c) => ({
            _id: String(c._id),
            title: c.title,
            slug: c.slug,
            image: c.image || catImageMap[String(c._id)] || undefined,
            count: categoryCounts[String(c._id)],
        }))
        .sort((a, b) => b.count - a.count);

    // 5. Handle subCategorySlug filtering (e.g. /brands/xiaomi/phone or ?category=phone)
    let filteredProducts = allProducts;
    let activeCategoryTitle: string | null = null;
    const cleanSubSlug = subCategorySlug ? subCategorySlug.trim().toLowerCase() : null;

    if (cleanSubSlug) {
        const matchedCat = allCategories.find((c) => {
            const slugLower = c.slug.toLowerCase();
            const titleLower = c.title.toLowerCase();
            return (
                slugLower === cleanSubSlug ||
                slugLower.includes(cleanSubSlug) ||
                cleanSubSlug.includes(slugLower) ||
                titleLower.includes(cleanSubSlug)
            );
        });

        if (matchedCat) {
            activeCategoryTitle = matchedCat.title;
            const matchedId = String(matchedCat._id);
            filteredProducts = allProducts.filter((p) => {
                if (p.category === matchedId) return true;
                const pTitle = p.title.toLowerCase();
                const catWords = matchedCat.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
                return catWords.some((w: string) => pTitle.includes(w));
            });
        }
    }

    // 6. Compute price range
    let minPrice = Infinity;
    let maxPrice = 0;
    for (const p of filteredProducts) {
        const rawP = p.info?.price || p.info?.salePrice || p.info?.regularPrice;
        const val = parseFloat(String(rawP || '0').replace(/[^0-9.]/g, ''));
        if (!isNaN(val) && val > 0) {
            if (val < minPrice) minPrice = val;
            if (val > maxPrice) maxPrice = val;
        }
    }
    if (minPrice === Infinity) minPrice = 0;
    if (maxPrice === 0) maxPrice = 100000;

    // 7. Extract attribute options for sidebar filters
    const attributeOptions: AttributeOption[] = [];
    const stockStatusValues = new Set<string>();
    const tagValues = new Set<string>();

    for (const p of allProducts) {
        if (p.info?.stock_status) stockStatusValues.add(p.info.stock_status);
        if (p.info?.tags) {
            p.info.tags.split(',').forEach((t) => tagValues.add(t.trim()));
        }
    }

    // 8. Breadcrumbs
    const ancestors: CategoryAncestor[] = [
        { _id: "home", title: "Home", slug: "" },
        { _id: brandCleanId, title: brandTitle, slug: `brands/${brandCleanSlug}` },
    ];
    if (activeCategoryTitle) {
        ancestors.push({
            _id: cleanSubSlug!,
            title: activeCategoryTitle,
            slug: `brands/${brandCleanSlug}/${cleanSubSlug}`,
        });
    }

    // 9. Active Box Template
    const activeBox = await getActiveBoxTemplate();

    return {
        brand: {
            _id: brandCleanId,
            title: brandTitle,
            slug: brandCleanSlug,
            image: brandDoc?.image || catImageMap[brandCleanId] || undefined,
            description: brandDoc?.description || undefined,
        },
        products: filteredProducts,
        allBrandProducts: allProducts,
        popularCategories,
        ancestors,
        activeBox,
        attributeOptions,
        activeCategorySlug: cleanSubSlug,
        activeCategoryTitle,
        totalCount: filteredProducts.length,
        minPrice,
        maxPrice,
    };
}

async function getActiveBoxTemplate(): Promise<{ label: string; pluginNx: string } | null> {
    try {
        const t = await Template.findOne({
            type: "product-box",
            isDefault: true,
        }).lean() as any;
        if (!t) return null;
        return { label: t.label, pluginNx: t.pluginNx };
    } catch {
        return null;
    }
}
