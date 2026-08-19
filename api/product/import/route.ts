import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Post from "@/models/post";
import PostInfo from "@/models/post_info";
import Cat from "@/models/cat";
import User from "@/models/Users";
import mongoose from "mongoose";
import { uploadToCloudinary, uploadToCloudflareR2, extractNameFromFile } from "@/lib/imageUpload";
import { getLibrariesCollection, initializeLibrariesCollection } from "@/models/Library";

export const dynamic = "force-dynamic";

function generateSlug(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

function parsePrice(val: any): number {
    if (val === undefined || val === null || val === "") return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    // Strip all currency symbols (৳, $, €, £, Tk), spaces, and non-numeric characters except digits and decimal point
    const cleaned = String(val)
        .replace(/,/g, "")
        .replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
}

function cleanUnit(val: any): string {
    if (!val) return "";
    return String(val)
        .replace(/^[^\w\u0980-\u09FF]+/gu, "")
        .replace(/^unit\s*:\s*/i, "")
        .trim();
}

function normalizeImages(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) {
        return val
            .map((item) => {
                if (typeof item === "string") return item.trim();
                if (typeof item === "object" && item !== null) {
                    return item.url || item.src || item.path || item.img || item.image || "";
                }
                return "";
            })
            .filter(Boolean);
    }
    if (typeof val === "string" && val.trim()) {
        const trimmed = val.trim();
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
                const parsed = JSON.parse(trimmed);
                return normalizeImages(parsed);
            } catch {}
        }
        if (trimmed.includes("\n")) {
            return trimmed.split("\n").map((s) => s.trim()).filter(Boolean);
        }
        return [trimmed];
    }
    return [];
}

function extractImagesFromItem(item: any, imageKey?: string, galleryKey?: string): string[] {
    const collected: string[] = [];

    if (imageKey && item[imageKey] !== undefined) {
        collected.push(...normalizeImages(item[imageKey]));
    }
    if (galleryKey && item[galleryKey] !== undefined) {
        collected.push(...normalizeImages(item[galleryKey]));
    }

    if (collected.length === 0) {
        const aliases = [
            "img",
            "image",
            "images",
            "photo",
            "photos",
            "thumbnail",
            "thumb",
            "pic",
            "picture",
            "src",
            "cover",
            "coverImage",
            "gallery",
            "product_image",
            "productImage",
        ];
        for (const alias of aliases) {
            if (item[alias] !== undefined && item[alias] !== null && item[alias] !== "") {
                const norm = normalizeImages(item[alias]);
                if (norm.length > 0) {
                    collected.push(...norm);
                }
            }
        }
    }

    return Array.from(new Set(collected));
}

function extractValue(item: any, customKey: string | undefined, aliases: string[]): any {
    if (customKey && item[customKey] !== undefined && item[customKey] !== null && item[customKey] !== "") {
        return item[customKey];
    }
    for (const alias of aliases) {
        if (item[alias] !== undefined && item[alias] !== null && item[alias] !== "") {
            return item[alias];
        }
    }
    return undefined;
}

/**
 * Downloads an external image and re-uploads it to Cloudinary or Cloudflare R2.
 * Also registers the asset in the CMS Media Library collection.
 */
async function reuploadImage(url: string, storage: "cloudflare" | "cloudinary"): Promise<string> {
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} when fetching image: ${url}`);

        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const filename = url.split("/").pop()?.split("?")[0] || `product_img_${Date.now()}.jpg`;

        const uploadResult =
            storage === "cloudinary"
                ? await uploadToCloudinary(buffer, filename)
                : await uploadToCloudflareR2(buffer, filename);

        // Save to Media Library collection
        try {
            await initializeLibrariesCollection();
            const libraryCollection = await getLibrariesCollection();
            await libraryCollection.insertOne({
                name: extractNameFromFile(filename),
                url: uploadResult.url,
                type: storage,
                status: "active",
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        } catch (libErr) {
            console.warn("Could not register image in Library collection:", libErr);
        }

        return uploadResult.url;
    } catch (err: any) {
        console.warn(`Failed to re-upload image (${url}) to ${storage}:`, err?.message || err);
        return url; // fallback to original URL
    }
}

function isExternalUrl(url: string): boolean {
    if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
    const cdnBase = process.env.NEXT_PUBLIC_IMAGE_CDN || "__none__";
    return !url.includes(cdnBase) && !url.includes("res.cloudinary.com");
}

async function processImages(
    urls: string[],
    storage: "cloudflare" | "cloudinary" | "cdn"
): Promise<string[]> {
    if (storage === "cdn") return urls;

    const processed = await Promise.all(
        urls.map(async (url) => {
            if (isExternalUrl(url)) {
                return await reuploadImage(url, storage);
            }
            return url;
        })
    );
    return processed.filter(Boolean);
}

/**
 * GET /api/product/import
 * Returns list of product categories and brands for the admin UI
 */
export async function GET() {
    try {
        await connectDB();

        const [categories, brands] = await Promise.all([
            Cat.find({ type: "product-category", status: { $ne: "trash" } })
                .select("_id title slug parentId")
                .sort({ title: 1 })
                .lean(),
            Cat.find({ type: "brands", status: { $ne: "trash" } })
                .select("_id title slug")
                .sort({ title: 1 })
                .lean(),
        ]);

        return NextResponse.json({
            categories: categories.map((c: any) => ({
                _id: String(c._id),
                title: String(c.title || ""),
                slug: String(c.slug || ""),
                parentId: c.parentId ? String(c.parentId) : null,
            })),
            brands: brands.map((b: any) => ({
                _id: String(b._id),
                title: String(b.title || ""),
                slug: String(b.slug || ""),
            })),
        });
    } catch (err: any) {
        console.error("Error fetching product import metadata:", err);
        return NextResponse.json(
            { error: err?.message || "Failed to fetch categories" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/product/import
 * Bulk product creation with streaming progress, custom column mapping, and image processing
 */
export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (obj: object) => {
                try {
                    controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
                } catch {}
            };

            try {
                await connectDB();

                const body = await req.json();
                const {
                    data,
                    imageStorage = "cloudflare", // 'cloudflare' | 'cloudinary' | 'cdn'
                    fieldMapping = {}, // custom column mapping from UI
                    defaultCategoryId = "",
                    defaultBrandId = "",
                    defaultUnit = "",
                    defaultQuantity = 10,
                    defaultShippingInside = 0,
                    defaultShippingOutside = 0,
                    defaultStatus = "published",
                    userId = "admin",
                } = body;

                const items = Array.isArray(data) ? data : (data ? [data] : []);

                if (items.length === 0) {
                    send({ event: "error", message: "No product data provided" });
                    controller.close();
                    return;
                }

                // Cache all categories and brands for quick lookup
                const [allCats, allBrands] = await Promise.all([
                    Cat.find({ type: "product-category" }).select("_id title slug").lean(),
                    Cat.find({ type: "brands" }).select("_id title slug").lean(),
                ]);

                const catMap = new Map<string, string>();
                allCats.forEach((c: any) => {
                    catMap.set(String(c._id), String(c._id));
                    catMap.set(String(c.title).toLowerCase(), String(c._id));
                    catMap.set(String(c.slug).toLowerCase(), String(c._id));
                });

                const brandMap = new Map<string, string>();
                allBrands.forEach((b: any) => {
                    brandMap.set(String(b._id), String(b._id));
                    brandMap.set(String(b.title).toLowerCase(), String(b._id));
                    brandMap.set(String(b.slug).toLowerCase(), String(b._id));
                });

                // Resolve valid user ObjectId
                let defaultAdminUserId = "";
                if (userId && mongoose.Types.ObjectId.isValid(userId)) {
                    defaultAdminUserId = userId;
                } else {
                    const adminUser = await User.findOne({ $or: [{ role: "admin" }, { type: "admin" }] }).select("_id").lean();
                    if (adminUser) {
                        defaultAdminUserId = String(adminUser._id);
                    } else {
                        const anyUser = await User.findOne({}).select("_id").lean();
                        if (anyUser) defaultAdminUserId = String(anyUser._id);
                    }
                }

                const total = items.length;
                let imported = 0;
                let skipped = 0;
                const errors: string[] = [];

                send({ event: "start", total });

                for (let i = 0; i < items.length; i++) {
                    const item = items[i];

                    // Extract Title
                    const rawTitle = extractValue(item, fieldMapping.titleKey, [
                        "title",
                        "name",
                        "product_name",
                        "productName",
                        "heading",
                        "label",
                        "item_name",
                    ]);
                    const title = String(rawTitle || "").trim();

                    send({
                        event: "progress",
                        current: i + 1,
                        total,
                        title: title || `Product #${i + 1}`,
                    });

                    if (!title) {
                        skipped++;
                        errors.push(`Row #${i + 1}: Missing product title`);
                        send({
                            event: "item",
                            status: "skipped",
                            title: `Row #${i + 1}`,
                            reason: "Missing title",
                        });
                        continue;
                    }

                    try {
                        let slug = String(item.slug || generateSlug(title)).trim();
                        if (!slug) slug = generateSlug(title) || `product-${Date.now()}`;

                        // Ensure unique slug
                        const existingSlug = await Post.findOne({ slug, type: "product" }).select("_id").lean();
                        if (existingSlug) {
                            slug = `${slug}-${Date.now().toString().slice(-4)}`;
                        }

                        // Extract Category: selected category from UI takes priority, fallback to item JSON category
                        const rawCat = extractValue(item, fieldMapping.categoryKey, [
                            "category",
                            "categoryProducts",
                            "category_name",
                            "cat",
                        ]);
                        const catInput = String(defaultCategoryId || rawCat || "").trim();
                        let resolvedCategoryId: string | null = null;
                        if (catInput) {
                            resolvedCategoryId = catMap.get(catInput.toLowerCase()) || null;
                            if (!resolvedCategoryId && mongoose.Types.ObjectId.isValid(catInput)) {
                                resolvedCategoryId = catInput;
                            }
                        }

                        // Extract Brand
                        const rawBrand = extractValue(item, fieldMapping.brandKey, [
                            "brand",
                            "brands",
                            "brand_name",
                            "manufacturer",
                        ]);
                        const brandInput = String(rawBrand || defaultBrandId || "").trim();
                        let resolvedBrandId: string = "";
                        if (brandInput) {
                            resolvedBrandId = brandMap.get(brandInput.toLowerCase()) || "";
                            if (!resolvedBrandId && mongoose.Types.ObjectId.isValid(brandInput)) {
                                resolvedBrandId = brandInput;
                            }
                        }

                        // Extract and normalize images from item (checks img, image, images, etc.)
                        const rawImages = extractImagesFromItem(
                            item,
                            fieldMapping.imageKey,
                            fieldMapping.galleryKey
                        );

                        const processedImages = await processImages(
                            rawImages,
                            imageStorage as "cloudflare" | "cloudinary" | "cdn"
                        );

                        // Extract Prices & Stock & Unit
                        const rawSelling = extractValue(item, fieldMapping.priceKey, [
                            "sellingPrice",
                            "selling_price",
                            "sellingprice",
                            "price",
                            "sale_price",
                            "offer_price",
                            "amount",
                        ]);
                        const rawRegular = extractValue(item, fieldMapping.regularPriceKey, [
                            "regularPrice",
                            "regular_price",
                            "regularprice",
                            "originalPrice",
                            "mrp",
                            "old_price",
                        ]);
                        const rawQty = extractValue(item, fieldMapping.quantityKey, [
                            "quantity",
                            "qty",
                            "stock",
                            "amount_in_stock",
                            "inventory",
                        ]);
                        const rawUnit = extractValue(item, fieldMapping.unitKey, [
                            "unit",
                            "uom",
                            "pack",
                            "measurement",
                        ]);
                        const rawSku = extractValue(item, fieldMapping.skuKey, [
                            "sku",
                            "code",
                            "product_code",
                            "barcode",
                        ]);
                        const rawShortDesc = extractValue(item, fieldMapping.shortDescKey, [
                            "shortDescription",
                            "short_description",
                            "subname",
                            "summary",
                            "subtitle",
                        ]);
                        const rawDesc = extractValue(item, fieldMapping.descKey, [
                            "description",
                            "desc",
                            "details",
                            "body",
                            "htmlDescription",
                        ]);

                        const sellingPrice = parsePrice(rawSelling);
                        const regularPrice = parsePrice(rawRegular ?? sellingPrice);
                        const stock = parseInt(String(rawQty ?? defaultQuantity), 10) || defaultQuantity;
                        const productUnit = cleanUnit(rawUnit || defaultUnit);

                        // 1. Create main Post document
                        const postDoc = await Post.create({
                            title,
                            slug,
                            type: "product",
                            status: (item.status === "draft" || item.status === "published" || item.status === "trash")
                                ? item.status
                                : defaultStatus,
                            category: resolvedCategoryId ? new mongoose.Types.ObjectId(resolvedCategoryId) : null,
                            userId: String(item.userId || defaultAdminUserId || ""),
                        });

                        // 2. Prepare PostInfo key-value entries
                        const effectiveSellingPrice = sellingPrice > 0 ? sellingPrice : regularPrice;
                        const effectiveRegularPrice = regularPrice > 0 ? regularPrice : sellingPrice;

                        const variatePayload = {
                            priceType: item.priceType === "variant" ? "variant" : "single",
                            regularprice: effectiveRegularPrice > 0 ? String(effectiveRegularPrice) : "",
                            sellingprice: effectiveSellingPrice > 0 ? String(effectiveSellingPrice) : "",
                            stock: String(stock),
                            singleAttributes: Array.isArray(item.singleAttributes) ? item.singleAttributes : [],
                            selectedAttributes: Array.isArray(item.selectedAttributes) ? item.selectedAttributes : [],
                            attributeInputs: typeof item.attributeInputs === "object" ? item.attributeInputs : {},
                            variants: Array.isArray(item.variants) ? item.variants : [],
                            showPreview: false,
                            variantDisplayStyle: item.variantDisplayStyle || "list",
                        };

                        // Build _specifications structure
                        let specValue = "";
                        if (Array.isArray(item.specifications)) {
                            specValue = JSON.stringify(item.specifications);
                        } else if (typeof item.specifications === "string") {
                            specValue = item.specifications;
                        }

                        const infoFields: { name: string; value: string }[] = [
                            { name: "images", value: JSON.stringify(processedImages) },
                            { name: "image", value: processedImages[0] || "" },
                            { name: "shortDescription", value: String(rawShortDesc || "") },
                            { name: "description", value: String(rawDesc || "") },
                            { name: "_variate", value: JSON.stringify(variatePayload) },
                            { name: "price", value: String(effectiveSellingPrice) },
                            { name: "sellingPrice", value: String(effectiveSellingPrice) },
                            { name: "regularPrice", value: String(effectiveRegularPrice) },
                            { name: "sellingprice", value: String(effectiveSellingPrice) },
                            { name: "regularprice", value: String(effectiveRegularPrice) },
                            { name: "stock", value: String(stock) },
                            { name: "quantity", value: String(stock) },
                            { name: "sku", value: String(rawSku || "") },
                            { name: "unit", value: productUnit },
                            { name: "product_condition", value: String(item.condition || item.product_condition || "new") },
                            { name: "product_weight", value: String(item.weight || item.product_weight || "") },
                            { name: "product_dimensions", value: String(item.dimensions || item.product_dimensions || "") },
                            { name: "orderNote", value: String(item.orderNote || item.note || "") },
                            { name: "warranty", value: String(item.warranty || "") },
                            { name: "shipping_inside", value: String(item.shippingInside ?? item.shipping_inside ?? defaultShippingInside) },
                            { name: "shipping_outside", value: String(item.shippingOutside ?? item.shipping_outside ?? defaultShippingOutside) },
                        ];

                        if (resolvedCategoryId) {
                            infoFields.push({ name: "category", value: resolvedCategoryId });
                            infoFields.push({ name: "categoryProducts", value: resolvedCategoryId });
                        }

                        if (resolvedBrandId) {
                            infoFields.push({ name: "brand", value: resolvedBrandId });
                        }

                        if (specValue) {
                            infoFields.push({ name: "_specifications", value: specValue });
                        }

                        if (item.metaTitle || item.meta_title) {
                            infoFields.push({ name: "meta_title", value: String(item.metaTitle || item.meta_title) });
                        }
                        if (item.metaDescription || item.meta_description) {
                            infoFields.push({ name: "meta_description", value: String(item.metaDescription || item.meta_description) });
                        }
                        if (item.metaKeyword || item.meta_keywords || item.metaKeywords) {
                            infoFields.push({ name: "meta_keywords", value: String(item.metaKeyword || item.meta_keywords || item.metaKeywords) });
                        }

                        // Bulk write post_info records
                        await PostInfo.insertMany(
                            infoFields.map((f) => ({
                                postId: postDoc._id,
                                name: f.name,
                                value: f.value,
                            }))
                        );

                        imported++;
                        send({ event: "item", status: "imported", title });
                    } catch (itemErr: any) {
                        skipped++;
                        const reason = itemErr?.message || "Database insert error";
                        errors.push(`Error on "${title}": ${reason}`);
                        send({ event: "item", status: "error", title, reason });
                    }
                }

                send({ event: "done", imported, skipped, errors });
            } catch (err: any) {
                console.error("Product Bulk Import Failure:", err);
                send({ event: "error", message: err?.message || "Import execution failed" });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Transfer-Encoding": "chunked",
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache, no-store",
        },
    });
}
