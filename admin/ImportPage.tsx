"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";

interface CategoryOption {
    _id: string;
    title: string;
    slug: string;
    parentId?: string | null;
}

interface BrandOption {
    _id: string;
    title: string;
    slug: string;
}

type ImageStorageType = "cloudflare" | "cloudinary" | "cdn";

interface FieldMapping {
    titleKey: string;
    imageKey: string;
    galleryKey: string;
    priceKey: string;
    regularPriceKey: string;
    unitKey: string;
    quantityKey: string;
    skuKey: string;
    categoryKey: string;
    brandKey: string;
    shortDescKey: string;
    descKey: string;
}

interface PreviewProduct {
    title: string;
    slug: string;
    images: string[];
    sellingPrice: number;
    regularPrice: number;
    quantity: number;
    unit?: string;
    category?: string;
    brand?: string;
    status: string;
    sku?: string;
    warnings: string[];
}

interface ImportProgress {
    current: number;
    total: number;
    title: string;
    imported: number;
    skipped: number;
    errors: string[];
}

const SAMPLE_PRODUCT_JSON = [
    {
        img: "https://cdnnew.selfeb.com/images/view/selfeb-a7a45051-77d8-476e-b347-5aec458c8582-1769523231652.jpg",
        title: "Premium Combo-4",
        unit: "Big",
        price: "3520",
        regularPrice: "4000",
        quantity: 25,
        sku: "COMBO-04"
    },
    {
        img: "https://cdnnew.selfeb.com/images/view/selfeb-ae08cad8-ca5a-4740-85f4-095c38b1bb9a-1768184069754.jpg",
        title: "Premium Combo-1",
        unit: "Big",
        price: "4350",
        regularPrice: "5000",
        quantity: 15,
        sku: "COMBO-01"
    }
];

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
        ];
        for (const alias of aliases) {
            if (item[alias] !== undefined && item[alias] !== null && item[alias] !== "") {
                const norm = normalizeImages(item[alias]);
                if (norm.length > 0) {
                    collected.push(...norm);
                    break;
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

function findBestKey(detectedKeys: string[], aliases: string[]): string {
    const lowerKeys = detectedKeys.map((k) => ({ original: k, lower: k.toLowerCase() }));
    for (const alias of aliases) {
        const match = lowerKeys.find((k) => k.lower === alias.toLowerCase());
        if (match) return match.original;
    }
    return "";
}

export default function ProductImportPage() {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [brands, setBrands] = useState<BrandOption[]>([]);
    const [metaLoading, setMetaLoading] = useState(true);

    // Form configurations
    const [imageStorage, setImageStorage] = useState<ImageStorageType>("cloudflare");
    const [selectedCategoryId, setSelectedCategoryId] = useState("");
    const [selectedBrandId, setSelectedBrandId] = useState("");
    const [defaultUnit, setDefaultUnit] = useState("pcs");
    const [defaultQuantity, setDefaultQuantity] = useState(10);
    const [defaultShippingInside, setDefaultShippingInside] = useState(80);
    const [defaultShippingOutside, setDefaultShippingOutside] = useState(150);
    const [defaultStatus, setDefaultStatus] = useState<"published" | "draft">("published");

    const [jsonText, setJsonText] = useState("");
    const [parsedData, setParsedData] = useState<any[] | null>(null);
    const [parseError, setParseError] = useState("");

    // Field Mappings
    const [mapping, setMapping] = useState<FieldMapping>({
        titleKey: "",
        imageKey: "",
        galleryKey: "",
        priceKey: "",
        regularPriceKey: "",
        unitKey: "",
        quantityKey: "",
        skuKey: "",
        categoryKey: "",
        brandKey: "",
        shortDescKey: "",
        descKey: "",
    });

    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState<ImportProgress | null>(null);
    const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setMetaLoading(true);
        fetch("/api/product/import")
            .then((r) => r.json())
            .then((d) => {
                if (d.categories) setCategories(d.categories);
                if (d.brands) setBrands(d.brands);
            })
            .catch((err) => console.error("Error loading import metadata:", err))
            .finally(() => setMetaLoading(false));
    }, []);

    // Extract all unique keys from parsed JSON data
    const detectedKeys = useMemo(() => {
        if (!parsedData || parsedData.length === 0) return [];
        const keysSet = new Set<string>();
        parsedData.slice(0, 15).forEach((item) => {
            if (typeof item === "object" && item !== null) {
                Object.keys(item).forEach((k) => keysSet.add(k));
            }
        });
        return Array.from(keysSet);
    }, [parsedData]);

    // Auto-detect mappings when detectedKeys change
    useEffect(() => {
        if (detectedKeys.length === 0) return;
        setMapping({
            titleKey: findBestKey(detectedKeys, ["title", "name", "product_name", "productName", "heading", "label"]),
            imageKey: findBestKey(detectedKeys, ["img", "image", "images", "photo", "photos", "thumbnail", "thumb", "pic", "picture", "src", "cover", "coverImage"]),
            galleryKey: findBestKey(detectedKeys, ["gallery", "gallery_images", "additional_images", "photos"]),
            priceKey: findBestKey(detectedKeys, ["price", "sellingPrice", "selling_price", "sellingprice", "sale_price", "offer_price"]),
            regularPriceKey: findBestKey(detectedKeys, ["regularPrice", "regular_price", "regularprice", "originalPrice", "mrp", "old_price"]),
            unitKey: findBestKey(detectedKeys, ["unit", "uom", "pack", "measurement"]),
            quantityKey: findBestKey(detectedKeys, ["quantity", "qty", "stock", "amount_in_stock", "inventory"]),
            skuKey: findBestKey(detectedKeys, ["sku", "code", "product_code", "barcode"]),
            categoryKey: findBestKey(detectedKeys, ["category", "categoryProducts", "category_name", "cat"]),
            brandKey: findBestKey(detectedKeys, ["brand", "brands", "brand_name", "manufacturer"]),
            shortDescKey: findBestKey(detectedKeys, ["shortDescription", "short_description", "subname", "summary"]),
            descKey: findBestKey(detectedKeys, ["description", "desc", "details", "body", "htmlDescription"]),
        });
    }, [detectedKeys]);

    const selectedCategoryObj = useMemo(() => {
        return categories.find((c) => c._id === selectedCategoryId) || null;
    }, [categories, selectedCategoryId]);

    const selectedBrandObj = useMemo(() => {
        return brands.find((b) => b._id === selectedBrandId) || null;
    }, [brands, selectedBrandId]);

    const categoryTree = useMemo(() => {
        const byParent = new Map<string | null, CategoryOption[]>();
        categories.forEach((c) => {
            const p = c.parentId ? String(c.parentId) : null;
            if (!byParent.has(p)) byParent.set(p, []);
            byParent.get(p)!.push(c);
        });

        const result: { _id: string; title: string; depth: number }[] = [];
        const seen = new Set<string>();

        function traverse(parentId: string | null, depth: number) {
            const children = byParent.get(parentId) || [];
            children.forEach((c) => {
                if (seen.has(c._id)) return;
                seen.add(c._id);
                result.push({ _id: c._id, title: c.title, depth });
                traverse(c._id, depth + 1);
            });
        }

        traverse(null, 0);
        categories.forEach((c) => {
            if (!seen.has(c._id)) {
                result.push({ _id: c._id, title: c.title, depth: 0 });
            }
        });

        return result;
    }, [categories]);

    // Build Live Preview from parsedData and current mapping
    const preview: PreviewProduct[] = useMemo(() => {
        if (!parsedData || parsedData.length === 0) return [];

        return parsedData.map((item: any) => {
            const warnings: string[] = [];

            const rawTitle = extractValue(item, mapping.titleKey, ["title", "name", "product_name", "productName", "heading", "label"]);
            const title = String(rawTitle || "").trim();
            if (!title) warnings.push("Missing title — row will be skipped");

            const slug = String(item.slug || (title ? generateSlug(title) : "")).trim();
            const imgs = extractImagesFromItem(item, mapping.imageKey, mapping.galleryKey);

            if (imgs.length === 0) {
                warnings.push("No images found — product will have no photo");
            }

            const rawSelling = extractValue(item, mapping.priceKey, ["price", "sellingPrice", "selling_price", "sellingprice", "sale_price"]);
            const rawRegular = extractValue(item, mapping.regularPriceKey, ["regularPrice", "regular_price", "regularprice", "originalPrice", "mrp"]);
            const rawQty = extractValue(item, mapping.quantityKey, ["quantity", "qty", "stock"]);
            const rawUnit = extractValue(item, mapping.unitKey, ["unit", "uom", "pack"]);
            const rawSku = extractValue(item, mapping.skuKey, ["sku", "code", "product_code"]);
            const rawCat = extractValue(item, mapping.categoryKey, ["category", "categoryProducts", "cat"]);
            const rawBrand = extractValue(item, mapping.brandKey, ["brand", "brands"]);

            const selling = parsePrice(rawSelling);
            const regular = parsePrice(rawRegular ?? selling);

            if (selling <= 0) {
                warnings.push("Selling price is 0 (Free product)");
            }

            const displayCategory = selectedCategoryObj ? selectedCategoryObj.title : (rawCat || "");
            const displayBrand = selectedBrandObj ? selectedBrandObj.title : (rawBrand || "");

            return {
                title: title || "(Untitled Product)",
                slug,
                images: imgs,
                sellingPrice: selling,
                regularPrice: regular,
                quantity: parseInt(String(rawQty ?? defaultQuantity), 10) || defaultQuantity,
                unit: cleanUnit(rawUnit || defaultUnit),
                category: displayCategory,
                brand: displayBrand,
                status: item.status || defaultStatus,
                sku: rawSku,
                warnings,
            };
        });
    }, [parsedData, mapping, defaultQuantity, defaultUnit, defaultStatus, selectedCategoryObj, selectedBrandObj]);

    const handleCopySample = () => {
        const str = JSON.stringify(SAMPLE_PRODUCT_JSON, null, 2);
        setJsonText(str);
        navigator.clipboard.writeText(str);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        handleValidate(str);
    };

    const handleValidate = (rawText?: string) => {
        const textToParse = (rawText !== undefined ? rawText : jsonText).trim();
        setParseError("");
        setParsedData(null);
        setResult(null);

        if (!textToParse) {
            setParseError("Please paste or upload JSON product data.");
            return;
        }

        let parsed: any;
        try {
            const cleaned = textToParse.replace(/,\s*([\]}])/g, "$1");
            parsed = JSON.parse(cleaned);
        } catch (e: any) {
            setParseError(`JSON Syntax Error: ${e.message}`);
            return;
        }

        const items = Array.isArray(parsed) ? parsed : [parsed];
        if (items.length === 0) {
            setParseError("The JSON array is empty.");
            return;
        }

        setParsedData(items);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setJsonText(content);
            handleValidate(content);
        };
        reader.readAsText(file);
    };

    const handleSubmitImport = async () => {
        if (!parsedData || parsedData.length === 0) return;

        setImporting(true);
        setResult(null);
        setProgress({
            current: 0,
            total: parsedData.length,
            title: "",
            imported: 0,
            skipped: 0,
            errors: [],
        });

        try {
            const res = await fetch("/api/product/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    data: parsedData,
                    imageStorage,
                    fieldMapping: mapping,
                    defaultCategoryId: selectedCategoryId,
                    defaultBrandId: selectedBrandId,
                    defaultUnit,
                    defaultQuantity,
                    defaultShippingInside,
                    defaultShippingOutside,
                    defaultStatus,
                }),
            });

            if (!res.ok || !res.body) {
                throw new Error(`Server responded with HTTP ${res.status}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const msg = JSON.parse(line);
                        if (msg.event === "start") {
                            setProgress({
                                current: 0,
                                total: msg.total,
                                title: "",
                                imported: 0,
                                skipped: 0,
                                errors: [],
                            });
                        } else if (msg.event === "progress") {
                            setProgress((prev) =>
                                prev ? { ...prev, current: msg.current, title: msg.title } : prev
                            );
                        } else if (msg.event === "item") {
                            setProgress((prev) => {
                                if (!prev) return prev;
                                return {
                                    ...prev,
                                    imported: prev.imported + (msg.status === "imported" ? 1 : 0),
                                    skipped: prev.skipped + (msg.status !== "imported" ? 1 : 0),
                                    errors: msg.status === "error"
                                        ? [...prev.errors, `${msg.title}: ${msg.reason}`]
                                        : prev.errors,
                                };
                            });
                        } else if (msg.event === "done") {
                            setResult({
                                imported: msg.imported,
                                skipped: msg.skipped,
                                errors: msg.errors || [],
                            });
                            setProgress(null);
                        } else if (msg.event === "error") {
                            throw new Error(msg.message);
                        }
                    } catch {}
                }
            }
        } catch (err: any) {
            setParseError(err?.message || "Import execution failed");
            setProgress(null);
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                            <Icon icon="solar:cloud-upload-bold" width={22} />
                        </div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                            Bulk Product Import & Column Mapper
                        </h1>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500">
                        Upload or paste JSON data, match columns (Title, Image, Price, Unit), and verify before saving to database.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={handleCopySample}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    >
                        <Icon icon={copied ? "solar:check-circle-bold" : "solar:copy-bold"} width={16} className={copied ? "text-emerald-600" : ""} />
                        <span>{copied ? "Sample Copied!" : "Load Sample JSON"}</span>
                    </button>

                    <Link
                        href="/admin/posts/product"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition-all shadow-2xs"
                    >
                        <Icon icon="solar:cart-large-bold" width={16} />
                        <span>Products List</span>
                    </Link>
                </div>
            </div>

            {/* Storage & Fallback Settings Card */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-xs space-y-5">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Icon icon="solar:settings-minimalistic-bold" width={16} className="text-emerald-600" />
                    <span>1. Storage & Fallback Configurations</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Image Storage Option */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                            <Icon icon="solar:gallery-download-bold" width={14} className="text-emerald-600" />
                            <span>Image Storage Destination</span>
                        </label>
                        <select
                            value={imageStorage}
                            onChange={(e) => setImageStorage(e.target.value as ImageStorageType)}
                            className="w-full px-3 py-2 text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
                        >
                            <option value="cloudflare">Cloudflare R2 (Download & Save)</option>
                            <option value="cloudinary">Cloudinary (Download & Save)</option>
                            <option value="cdn">Direct URL / CDN (Keep As-Is)</option>
                        </select>
                        <p className="text-[10px] text-gray-400">
                            {imageStorage === "cdn"
                                ? "Preserves original external URLs."
                                : "Downloads images and uploads to your cloud."}
                        </p>
                    </div>

                    {/* Target Category */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                            <span>Target Category</span>
                            {selectedCategoryId && (
                                <span className="text-[10px] text-emerald-600 font-bold">Assigned to all</span>
                            )}
                        </label>
                        <select
                            value={selectedCategoryId}
                            onChange={(e) => setSelectedCategoryId(e.target.value)}
                            disabled={metaLoading}
                            className="w-full px-3 py-2 text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
                        >
                            <option value="">Auto from JSON (or None)</option>
                            {categoryTree.map((cat) => (
                                <option key={cat._id} value={cat._id}>
                                    {"— ".repeat(cat.depth) + cat.title}
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-gray-400">
                            {selectedCategoryId
                                ? `All products will be assigned to "${selectedCategoryObj?.title}".`
                                : "Assigns category per row from JSON, or leaves uncategorized."}
                        </p>
                    </div>

                    {/* Fallback Brand */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700">Fallback Brand</label>
                        <select
                            value={selectedBrandId}
                            onChange={(e) => setSelectedBrandId(e.target.value)}
                            disabled={metaLoading}
                            className="w-full px-3 py-2 text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
                        >
                            <option value="">Auto from JSON (or None)</option>
                            {brands.map((b) => (
                                <option key={b._id} value={b._id}>
                                    {b.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Default Unit */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700">Default Unit (Fallback)</label>
                        <input
                            type="text"
                            placeholder="e.g. pcs, Big, kg, box"
                            value={defaultUnit}
                            onChange={(e) => setDefaultUnit(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-gray-100">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700">Default Stock Qty</label>
                        <input
                            type="number"
                            min={0}
                            value={defaultQuantity}
                            onChange={(e) => setDefaultQuantity(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700">Default Status</label>
                        <select
                            value={defaultStatus}
                            onChange={(e) => setDefaultStatus(e.target.value as any)}
                            className="w-full px-3 py-2 text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
                        >
                            <option value="published">Published</option>
                            <option value="draft">Draft</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700">Inside Shipping (৳)</label>
                        <input
                            type="number"
                            min={0}
                            value={defaultShippingInside}
                            onChange={(e) => setDefaultShippingInside(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700">Outside Shipping (৳)</label>
                        <input
                            type="number"
                            min={0}
                            value={defaultShippingOutside}
                            onChange={(e) => setDefaultShippingOutside(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 text-xs font-semibold bg-gray-50/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* JSON Input Section */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Icon icon="solar:code-file-bold" width={16} className="text-emerald-600" />
                        <span>2. Paste or Upload Product JSON</span>
                    </h2>

                    <div className="flex items-center gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".json,application/json"
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                        >
                            <Icon icon="solar:upload-bold" width={14} />
                            <span>Upload .JSON File</span>
                        </button>
                    </div>
                </div>

                <div className="relative">
                    <textarea
                        value={jsonText}
                        onChange={(e) => {
                            setJsonText(e.target.value);
                            setParseError("");
                        }}
                        rows={8}
                        placeholder={`Paste product JSON array here...\n\nExample:\n[\n  {\n    "img": "https://example.com/photo.jpg",\n    "title": "Premium Product",\n    "unit": "Big",\n    "price": "3520"\n  }\n]`}
                        className="w-full p-4 font-mono text-xs text-gray-800 bg-gray-50/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all resize-y"
                    />
                </div>

                {parseError && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                        <Icon icon="solar:danger-triangle-bold" width={18} className="shrink-0 text-red-500" />
                        <span>{parseError}</span>
                    </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                        type="button"
                        onClick={() => handleValidate()}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
                    >
                        <Icon icon="solar:magnifer-bold" width={15} />
                        <span>Parse & Match Columns</span>
                    </button>
                </div>
            </div>

            {/* Column / Field Mapper Section */}
            {detectedKeys.length > 0 && (
                <div className="bg-white rounded-2xl border border-emerald-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                <Icon icon="solar:tuning-bold" width={18} className="text-emerald-600" />
                                <span>3. Match JSON Keys to CMS Fields</span>
                            </h2>
                            <p className="text-xs text-gray-500">
                                Select which JSON attribute maps to each product field. Matches update live in the preview below.
                            </p>
                        </div>

                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            {detectedKeys.length} Keys Detected
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                        {/* Title Key */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                                <span>Product Title *</span>
                                <span className="text-[10px] text-emerald-600 font-semibold font-mono">{mapping.titleKey || "auto"}</span>
                            </label>
                            <select
                                value={mapping.titleKey}
                                onChange={(e) => setMapping((prev) => ({ ...prev, titleKey: e.target.value }))}
                                className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                            >
                                <option value="">Auto Detect (title / name)</option>
                                {detectedKeys.map((k) => (
                                    <option key={k} value={k}>
                                        {k}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Image Key */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                                <span>Cover / Main Image *</span>
                                <span className="text-[10px] text-emerald-600 font-semibold font-mono">{mapping.imageKey || "auto"}</span>
                            </label>
                            <select
                                value={mapping.imageKey}
                                onChange={(e) => setMapping((prev) => ({ ...prev, imageKey: e.target.value }))}
                                className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                            >
                                <option value="">Auto Detect (img / image / photo)</option>
                                {detectedKeys.map((k) => (
                                    <option key={k} value={k}>
                                        {k}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Price Key */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                                <span>Selling Price *</span>
                                <span className="text-[10px] text-emerald-600 font-semibold font-mono">{mapping.priceKey || "auto"}</span>
                            </label>
                            <select
                                value={mapping.priceKey}
                                onChange={(e) => setMapping((prev) => ({ ...prev, priceKey: e.target.value }))}
                                className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                            >
                                <option value="">Auto Detect (price / sellingPrice)</option>
                                {detectedKeys.map((k) => (
                                    <option key={k} value={k}>
                                        {k}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Regular Price Key */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                                <span>Regular Price (MRP)</span>
                                <span className="text-[10px] text-emerald-600 font-semibold font-mono">{mapping.regularPriceKey || "auto"}</span>
                            </label>
                            <select
                                value={mapping.regularPriceKey}
                                onChange={(e) => setMapping((prev) => ({ ...prev, regularPriceKey: e.target.value }))}
                                className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                            >
                                <option value="">Auto Detect (regularPrice / originalPrice)</option>
                                {detectedKeys.map((k) => (
                                    <option key={k} value={k}>
                                        {k}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Unit Key */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                                <span>Unit</span>
                                <span className="text-[10px] text-emerald-600 font-semibold font-mono">{mapping.unitKey || "auto"}</span>
                            </label>
                            <select
                                value={mapping.unitKey}
                                onChange={(e) => setMapping((prev) => ({ ...prev, unitKey: e.target.value }))}
                                className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                            >
                                <option value="">Auto Detect (unit / uom / pack)</option>
                                {detectedKeys.map((k) => (
                                    <option key={k} value={k}>
                                        {k}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Quantity / Stock Key */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                                <span>Stock / Quantity</span>
                                <span className="text-[10px] text-emerald-600 font-semibold font-mono">{mapping.quantityKey || "auto"}</span>
                            </label>
                            <select
                                value={mapping.quantityKey}
                                onChange={(e) => setMapping((prev) => ({ ...prev, quantityKey: e.target.value }))}
                                className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                            >
                                <option value="">Auto Detect (quantity / stock / qty)</option>
                                {detectedKeys.map((k) => (
                                    <option key={k} value={k}>
                                        {k}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* SKU Key */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                                <span>SKU / Product Code</span>
                                <span className="text-[10px] text-emerald-600 font-semibold font-mono">{mapping.skuKey || "auto"}</span>
                            </label>
                            <select
                                value={mapping.skuKey}
                                onChange={(e) => setMapping((prev) => ({ ...prev, skuKey: e.target.value }))}
                                className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                            >
                                <option value="">Auto Detect (sku / code / barcode)</option>
                                {detectedKeys.map((k) => (
                                    <option key={k} value={k}>
                                        {k}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Category Key */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                                <span>Category Name / Slug</span>
                                <span className="text-[10px] text-emerald-600 font-semibold font-mono">{mapping.categoryKey || "auto"}</span>
                            </label>
                            <select
                                value={mapping.categoryKey}
                                onChange={(e) => setMapping((prev) => ({ ...prev, categoryKey: e.target.value }))}
                                className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                            >
                                <option value="">Auto Detect (category / cat)</option>
                                {detectedKeys.map((k) => (
                                    <option key={k} value={k}>
                                        {k}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Live Preview Table */}
            {preview.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h3 className="text-base font-black text-gray-900">
                                4. Live Verification Preview ({preview.length} {preview.length === 1 ? "Product" : "Products"})
                            </h3>
                            <p className="text-xs text-gray-500">
                                Destination: <span className="font-bold text-emerald-700 uppercase">{imageStorage}</span> &bull; Verify image, title, price, and unit before triggering import.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleSubmitImport}
                            disabled={importing}
                            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-2"
                        >
                            {importing ? (
                                <>
                                    <Icon icon="svg-spinners:ring-resize" width={16} />
                                    <span>Importing Products...</span>
                                </>
                            ) : (
                                <>
                                    <Icon icon="solar:check-read-bold" width={16} />
                                    <span>Start Bulk Import ({preview.length})</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Progress Bar during import */}
                    {progress && (
                        <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200/80 space-y-2.5">
                            <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                                <span>Importing: {progress.title || "Processing..."}</span>
                                <span>{progress.current} of {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)</span>
                            </div>
                            <div className="w-full h-2.5 bg-emerald-200/70 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                />
                            </div>
                            <div className="flex items-center gap-4 text-[11px] font-bold text-gray-600 pt-1">
                                <span className="text-emerald-700">✓ {progress.imported} Imported</span>
                                <span className="text-amber-700">⊘ {progress.skipped} Skipped</span>
                                {progress.errors.length > 0 && (
                                    <span className="text-red-700">✕ {progress.errors.length} Errors</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Preview Table */}
                    <div className="overflow-x-auto border border-gray-100 rounded-xl max-h-96 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold sticky top-0">
                                <tr>
                                    <th className="p-3 w-12">#</th>
                                    <th className="p-3 w-16">Cover Photo</th>
                                    <th className="p-3">Title & Slug</th>
                                    <th className="p-3">Price (৳)</th>
                                    <th className="p-3">Stock & Unit</th>
                                    <th className="p-3">Category/Brand</th>
                                    <th className="p-3">Status / Ready</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-medium">
                                {preview.map((p, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                                        <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                                        <td className="p-3">
                                            {p.images[0] ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={p.images[0]}
                                                    alt={p.title}
                                                    className="w-12 h-12 object-cover rounded-lg border border-gray-200 shadow-2xs"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                                                    <Icon icon="solar:gallery-bold" width={20} />
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <p className="font-bold text-gray-900 line-clamp-1">{p.title}</p>
                                            <p className="font-mono text-[11px] text-gray-400">{p.slug}</p>
                                        </td>
                                        <td className="p-3 whitespace-nowrap">
                                            <span className="font-bold text-emerald-700">৳{p.sellingPrice.toLocaleString()}</span>
                                            {p.regularPrice > p.sellingPrice && (
                                                <span className="text-gray-400 line-through text-[11px] ml-1.5">
                                                    ৳{p.regularPrice.toLocaleString()}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 whitespace-nowrap">
                                            <div className="space-y-0.5">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 font-semibold text-gray-700">
                                                    Qty: {p.quantity}
                                                </span>
                                                {p.unit && (
                                                    <span className="block text-[11px] font-bold text-emerald-800">
                                                        Unit: {p.unit}
                                                    </span>
                                                )}
                                                {p.sku && (
                                                    <p className="font-mono text-[10px] text-gray-400">{p.sku}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 text-gray-600">
                                            <p className="truncate max-w-30">{p.category || "Auto / Default"}</p>
                                            {p.brand && <p className="text-[10px] text-gray-400 truncate max-w-30">{p.brand}</p>}
                                        </td>
                                        <td className="p-3">
                                            {p.warnings.length > 0 ? (
                                                <div className="space-y-0.5">
                                                    {p.warnings.map((w, wIdx) => (
                                                        <span key={wIdx} className="block text-[11px] text-amber-700 font-semibold">
                                                            ⚠ {w}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                                                    <Icon icon="solar:check-circle-bold" width={14} /> Ready
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Results Modal / Card */}
            {result && (
                <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-md space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <Icon icon="solar:check-circle-bold" width={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-900">Import Operation Completed</h3>
                            <p className="text-xs text-gray-500">
                                Successfully inserted {result.imported} products into your catalog (Images saved via {imageStorage.toUpperCase()}).
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 rounded-xl text-center">
                        <div>
                            <span className="text-xl font-black text-emerald-600">{result.imported}</span>
                            <p className="text-[11px] font-bold text-gray-500 uppercase">Imported</p>
                        </div>
                        <div>
                            <span className="text-xl font-black text-amber-600">{result.skipped}</span>
                            <p className="text-[11px] font-bold text-gray-500 uppercase">Skipped</p>
                        </div>
                        <div>
                            <span className="text-xl font-black text-red-600">{result.errors.length}</span>
                            <p className="text-[11px] font-bold text-gray-500 uppercase">Errors</p>
                        </div>
                    </div>

                    {result.errors.length > 0 && (
                        <div className="p-3.5 bg-red-50/80 rounded-xl border border-red-200 text-xs text-red-800 space-y-1">
                            <p className="font-bold">Error Details:</p>
                            <ul className="list-disc pl-4 space-y-0.5">
                                {result.errors.map((e, idx) => (
                                    <li key={idx}>{e}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setResult(null);
                                setParsedData(null);
                                setJsonText("");
                            }}
                            className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold cursor-pointer"
                        >
                            Import More
                        </button>
                        <Link
                            href="/admin/posts/product"
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
                        >
                            View Product List
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
