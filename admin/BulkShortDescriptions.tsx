"use client";

import { useState, useEffect, useCallback } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";

export interface ProductShortDescRow {
    id: string;
    title: string;
    slug?: string;
    category?: string;
    shortDescription: string;
    hasShortDesc?: boolean;
    wordCount: number;
    selected?: boolean;
    isGenerating?: boolean;
    isGenerated?: boolean;
    showPreview?: boolean;
    error?: string;
}

interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    totalMissingCount: number;
}

function countWords(html: string): number {
    if (!html) return 0;
    const plain = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!plain) return 0;
    return plain.split(" ").filter(Boolean).length;
}

export default function BulkShortDescriptions() {
    const [products, setProducts] = useState<ProductShortDescRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [filter, setFilter] = useState<"missing" | "all" | "completed">("missing");
    const [search, setSearch] = useState<string>("");
    const [category, setCategory] = useState<string>("");
    const [categories, setCategories] = useState<{ _id: string; title: string }[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
        totalMissingCount: 0,
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    // Load available categories for filter
    useEffect(() => {
        fetch("/api/product/import")
            .then((r) => r.json())
            .then((d) => {
                if (Array.isArray(d?.categories)) {
                    setCategories(d.categories);
                }
            })
            .catch(() => {});
    }, []);

    // Fetch batch of products
    const fetchProducts = useCallback(async (targetPage = page, targetLimit = limit, targetCategory = category) => {
        setLoading(true);
        setErrorMessage("");
        try {
            const params = new URLSearchParams({
                page: String(targetPage),
                limit: String(targetLimit),
                filter,
                search,
                ...(targetCategory ? { category: targetCategory } : {}),
            });

            const res = await fetch(`/api/product/bulk-short-desc/posts?${params.toString()}`);
            const data = await res.json();

            if (!res.ok) {
                setErrorMessage(data.error || "Failed to load products.");
                setProducts([]);
                return;
            }

            const items: ProductShortDescRow[] = (data.posts || []).map((p: any) => ({
                id: p.id,
                title: p.title || "",
                slug: p.slug || "",
                category: p.category || "",
                shortDescription: p.shortDescription || "",
                hasShortDesc: Boolean(p.hasShortDesc),
                wordCount: p.wordCount || countWords(p.shortDescription || ""),
                selected: true,
                isGenerating: false,
                isGenerated: false,
                showPreview: false,
            }));

            setProducts(items);
            if (data.pagination) {
                setPagination(data.pagination);
            }
        } catch {
            setErrorMessage("Network error while loading products.");
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, [page, limit, filter, search, category]);

    useEffect(() => {
        fetchProducts(page, limit, category);
    }, [fetchProducts, page, limit, category]);

    // Handle Selection
    const selectedCount = products.filter((p) => p.selected).length;
    const allSelected = products.length > 0 && selectedCount === products.length;

    const toggleSelectAll = () => {
        const next = !allSelected;
        setProducts((prev) => prev.map((p) => ({ ...p, selected: next })));
    };

    const toggleSelectRow = (id: string) => {
        setProducts((prev) =>
            prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
        );
    };

    // Update single field in a row
    const handleDescriptionChange = (id: string, value: string) => {
        setProducts((prev) =>
            prev.map((p) =>
                p.id === id
                    ? {
                          ...p,
                          shortDescription: value,
                          wordCount: countWords(value),
                          isGenerated: true,
                      }
                    : p
            )
        );
    };

    const togglePreview = (id: string) => {
        setProducts((prev) =>
            prev.map((p) => (p.id === id ? { ...p, showPreview: !p.showPreview } : p))
        );
    };

    // ── Single Row Quick Generate ──────────────────────────────────────────────
    const handleGenerateSingle = async (item: ProductShortDescRow) => {
        setProducts((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, isGenerating: true } : p))
        );

        try {
            const res = await fetch("/api/product/bulk-short-desc/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: [{ id: item.id, title: item.title }] }),
            });

            const data = await res.json();
            if (!res.ok) {
                setErrorMessage(data.error || "Generation error from Gemini.");
                setProducts((prev) =>
                    prev.map((p) => (p.id === item.id ? { ...p, isGenerating: false } : p))
                );
                return;
            }

            const gen = (data.results || [])[0];
            if (gen) {
                setProducts((prev) =>
                    prev.map((p) =>
                        p.id === item.id
                            ? {
                                  ...p,
                                  shortDescription: gen.shortDescription,
                                  wordCount: gen.wordCount,
                                  isGenerating: false,
                                  isGenerated: true,
                              }
                            : p
                    )
                );
            }
        } catch {
            setErrorMessage("Network error during single product generation.");
            setProducts((prev) =>
                prev.map((p) => (p.id === item.id ? { ...p, isGenerating: false } : p))
            );
        }
    };

    // ── Generate All in 1 SINGLE REQUEST ───────────────────────────────────────
    const handleGenerateAllAtOnce = async () => {
        const targetProducts = products.filter((p) => p.selected);
        if (targetProducts.length === 0) {
            alert("Please select at least one product to generate.");
            return;
        }

        setIsGenerating(true);
        setErrorMessage("");
        setSaveSuccessMessage("");

        setProducts((prev) =>
            prev.map((p) => (p.selected ? { ...p, isGenerating: true, error: undefined } : p))
        );

        try {
            const payload = targetProducts.map((p) => ({
                id: p.id,
                title: p.title,
            }));

            const res = await fetch("/api/product/bulk-short-desc/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: payload }),
            });

            const data = await res.json();

            if (!res.ok) {
                setErrorMessage(data.error || "Generation error from Gemini.");
                setProducts((prev) =>
                    prev.map((p) => (p.selected ? { ...p, isGenerating: false, error: data.error } : p))
                );
                return;
            }

            const resultsMap = new Map<string, any>();
            (data.results || []).forEach((r: any) => resultsMap.set(r.id, r));

            setProducts((prev) =>
                prev.map((p) => {
                    const gen = resultsMap.get(p.id);
                    if (gen) {
                        return {
                            ...p,
                            shortDescription: gen.shortDescription || p.shortDescription,
                            wordCount: gen.wordCount || countWords(gen.shortDescription),
                            isGenerating: false,
                            isGenerated: true,
                            error: undefined,
                        };
                    }
                    return { ...p, isGenerating: false };
                })
            );

            setSaveSuccessMessage(`Generated human-style short descriptions for ${targetProducts.length} products!`);
            setTimeout(() => setSaveSuccessMessage(""), 3500);
        } catch (err: any) {
            setErrorMessage(err?.message || "Network error while generating batch.");
            setProducts((prev) => prev.map((p) => ({ ...p, isGenerating: false })));
        } finally {
            setIsGenerating(false);
        }
    };

    // ── Submit All in 1 SINGLE REQUEST & Load Next Batch ───────────────────────
    const handleSubmitBatchAtOnce = async () => {
        const itemsToSave = products
            .filter((p) => p.shortDescription?.trim())
            .map((p) => ({
                id: p.id,
                shortDescription: p.shortDescription,
            }));

        if (itemsToSave.length === 0) {
            alert("No short descriptions found to save. Click 'Generate All with Gemini' first.");
            return;
        }

        setIsSaving(true);
        setSaveSuccessMessage("");
        setErrorMessage("");

        try {
            const res = await fetch("/api/product/bulk-short-desc/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: itemsToSave }),
            });

            const data = await res.json();
            if (!res.ok) {
                setErrorMessage(data.error || "Failed to save batch.");
                return;
            }

            setSaveSuccessMessage(`Successfully saved ${itemsToSave.length} product short descriptions! Loading next batch...`);

            setTimeout(() => {
                setSaveSuccessMessage("");
                fetchProducts(page, limit);
            }, 1000);
        } catch {
            setErrorMessage("Network error while submitting batch.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLimitChange = (newLimit: number) => {
        setLimit(newLimit);
        setPage(1);
        fetchProducts(1, newLimit, category);
    };

    return (
        <div className="container space-y-6">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <Icon icon="solar:magic-stick-3-bold" width={20} />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900">Bulk Product Short Descriptions & Specs</h1>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {limit} Products per Batch
                        </span>
                    </div>
                    <p className="text-xs text-gray-500">
                        Generate human-style 8 product specifications or narrative short descriptions using Gemini in 1 request, review, and save all at once.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/product/settings"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition"
                    >
                        <Icon icon="logos:google-gemini" width={14} />
                        AI Settings
                    </Link>
                    <button
                        type="button"
                        onClick={() => fetchProducts(page, limit)}
                        disabled={loading || isGenerating || isSaving}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition disabled:opacity-50 cursor-pointer"
                    >
                        <Icon icon="solar:refresh-bold" width={15} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
                    <p className="text-xs font-medium text-gray-500 mb-1">Total Products in Filter</p>
                    <p className="text-2xl font-bold text-gray-900">{pagination.total.toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
                    <p className="text-xs font-medium text-gray-500 mb-1">Missing Short Descriptions</p>
                    <p className="text-2xl font-bold text-amber-600">{pagination.totalMissingCount.toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
                    <p className="text-xs font-medium text-gray-500 mb-1">Current Batch Loaded</p>
                    <p className="text-2xl font-bold text-emerald-600">
                        {products.length} <span className="text-xs font-normal text-gray-400">/ {limit} entries</span>
                    </p>
                </div>
            </div>

            {/* ── Controls & Actions ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Filter Status */}
                    <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 text-xs font-medium">
                        <button
                            type="button"
                            onClick={() => { setFilter("missing"); setPage(1); }}
                            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                                filter === "missing" ? "bg-white text-emerald-700 shadow-2xs font-semibold" : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            Missing Only
                        </button>
                        <button
                            type="button"
                            onClick={() => { setFilter("all"); setPage(1); }}
                            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                                filter === "all" ? "bg-white text-emerald-700 shadow-2xs font-semibold" : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            All Products
                        </button>
                        <button
                            type="button"
                            onClick={() => { setFilter("completed"); setPage(1); }}
                            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                                filter === "completed" ? "bg-white text-emerald-700 shadow-2xs font-semibold" : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            Completed Only
                        </button>
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs">
                        <span className="text-gray-500 font-medium whitespace-nowrap">Category:</span>
                        <select
                            value={category}
                            onChange={(e) => {
                                setCategory(e.target.value);
                                setPage(1);
                            }}
                            disabled={loading || isGenerating || isSaving}
                            className="bg-white border border-gray-200 rounded-md px-2 py-0.5 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer max-w-40 truncate"
                        >
                            <option value="">All Categories</option>
                            {categories.map((c) => (
                                <option key={c._id} value={c._id}>
                                    {c.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Batch Size Selector */}
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs">
                        <span className="text-gray-500 font-medium whitespace-nowrap">Batch Size:</span>
                        <select
                            value={limit}
                            onChange={(e) => handleLimitChange(Number(e.target.value))}
                            disabled={loading || isGenerating || isSaving}
                            className="bg-white border border-gray-200 rounded-md px-2 py-0.5 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20 (Default)</option>
                            <option value={30}>30</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                        </select>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Icon icon="solar:magnifer-linear" className="absolute left-2.5 top-2.5 text-gray-400" width={14} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && fetchProducts(1, limit, category)}
                            placeholder="Search product..."
                            className="text-xs border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 w-44 focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
                        />
                    </div>
                </div>

                {/* Bulk Action Buttons */}
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={handleGenerateAllAtOnce}
                        disabled={selectedCount === 0 || loading || isGenerating || isSaving}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-semibold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {isGenerating ? (
                            <>
                                <Icon icon="svg-spinners:ring-resize" width={16} />
                                Generating in 1 Request...
                            </>
                        ) : (
                            <>
                                <Icon icon="solar:magic-stick-3-bold" width={16} />
                                Generate All with Gemini ({selectedCount})
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={handleSubmitBatchAtOnce}
                        disabled={isSaving || isGenerating || loading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {isSaving ? (
                            <>
                                <Icon icon="svg-spinners:ring-resize" width={16} />
                                Submitting All at Once...
                            </>
                        ) : (
                            <>
                                <Icon icon="solar:check-circle-bold" width={16} />
                                Submit & Save All at Once ({products.filter(p => p.shortDescription).length})
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Feedback Notifications */}
            {saveSuccessMessage && (
                <div className="fixed right-3 bottom-5 z-50 flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold shadow-lg">
                    <Icon icon="solar:check-circle-bold" width={18} />
                    {saveSuccessMessage}
                </div>
            )}
            {errorMessage && (
                <div className="fixed right-4 bottom-5 z-50 max-w-lg p-4 bg-red-50 border border-red-200 text-red-900 rounded-2xl text-xs shadow-xl space-y-2">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                            <Icon icon="solar:danger-triangle-bold" width={18} className="text-red-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-red-900">Gemini Generation Error</p>
                                <p className="text-red-700 mt-0.5 leading-relaxed wrap-break-word font-mono text-[11px] max-h-36 overflow-y-auto pr-1">
                                    {errorMessage}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setErrorMessage("")}
                            className="text-red-400 hover:text-red-700 cursor-pointer p-0.5"
                        >
                            <Icon icon="solar:close-circle-bold" width={18} />
                        </button>
                    </div>

                    {errorMessage.includes("429") || errorMessage.toLowerCase().includes("quota") ? (
                        <div className="pt-2 border-t border-red-200/60 flex items-center justify-between">
                            <span className="text-[11px] text-red-700">Model quota exhausted. Switch to standard model:</span>
                            <Link
                                href="/admin/product/settings"
                                className="px-2.5 py-1 text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                            >
                                Change Model in Settings
                            </Link>
                        </div>
                    ) : null}
                </div>
            )}

            {/* ── Table ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-600">
                        <thead className="bg-gray-50 border-b border-gray-100 text-gray-700 font-semibold uppercase tracking-wider text-[11px]">
                            <tr>
                                <th className="p-3.5 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleSelectAll}
                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                </th>
                                <th className="p-3.5 w-64">Product Name</th>
                                <th className="p-3.5 flex-1">HTML Specifications / Short Description</th>
                                <th className="p-3.5 w-32 text-center">Status</th>
                                <th className="p-3.5 w-24 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading && products.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center text-gray-400">
                                        <Icon icon="svg-spinners:ring-resize" width={24} className="mx-auto mb-2 text-emerald-500" />
                                        Loading {limit} products...
                                    </td>
                                </tr>
                            ) : products.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center text-gray-400">
                                        <Icon icon="solar:box-minimalistic-linear" width={32} className="mx-auto mb-2 text-gray-300" />
                                        No products found matching the filter.
                                    </td>
                                </tr>
                            ) : (
                                products.map((product) => {
                                    const liCount = (product.shortDescription.match(/<li[\s>]/gi) || []).length;
                                    return (
                                        <tr
                                            key={product.id}
                                            className={`hover:bg-gray-50/60 transition-colors ${
                                                product.isGenerating ? "bg-emerald-50/40 animate-pulse" : product.isGenerated ? "bg-emerald-50/20" : ""
                                            }`}
                                        >
                                            {/* Checkbox */}
                                            <td className="p-3.5 text-center align-top">
                                                 <input
                                                     type="checkbox"
                                                     checked={Boolean(product.selected)}
                                                     onChange={() => toggleSelectRow(product.id)}
                                                     className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer mt-1"
                                                 />
                                            </td>

                                            {/* Product Title & Info */}
                                            <td className="p-3.5 align-top">
                                                <p className="font-semibold text-gray-900 leading-snug line-clamp-2" title={product.title}>
                                                    {product.title}
                                                </p>
                                            </td>

                                            {/* Short Description */}
                                            <td className="p-3.5 align-top">
                                                <div className="space-y-1.5">
                                                    {product.showPreview ? (
                                                        <div
                                                            className="p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-800 text-xs leading-relaxed max-h-40 overflow-y-auto prose prose-xs"
                                                            dangerouslySetInnerHTML={{ __html: product.shortDescription }}
                                                        />
                                                    ) : (
                                                        <textarea
                                                            rows={4}
                                                            value={product.shortDescription}
                                                            onChange={(e) => handleDescriptionChange(product.id, e.target.value)}
                                                            placeholder="<ul>\n  <li><b>Display</b>: ...</li>\n</ul>"
                                                            className="w-full text-xs font-mono border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:border-emerald-500 bg-white leading-relaxed resize-y"
                                                        />
                                                    )}

                                                    <div className="flex items-center justify-between text-[11px]">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => togglePreview(product.id)}
                                                                className="text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <Icon icon={product.showPreview ? "solar:code-bold" : "solar:eye-bold"} width={13} />
                                                                {product.showPreview ? "Edit HTML" : "Preview HTML"}
                                                            </button>
                                                        </div>

                                                        {liCount > 0 ? (
                                                            <span
                                                                className={`font-semibold px-2 py-0.5 rounded-full ${
                                                                    liCount === 8
                                                                        ? "bg-emerald-100 text-emerald-800"
                                                                        : "bg-blue-100 text-blue-800"
                                                                }`}
                                                            >
                                                                {liCount} Specifications {liCount === 8 ? "✓" : ""}
                                                            </span>
                                                        ) : (
                                                            <span
                                                                className={`font-semibold px-2 py-0.5 rounded-full ${
                                                                    product.wordCount >= 200 && product.wordCount <= 300
                                                                        ? "bg-emerald-100 text-emerald-800"
                                                                        : product.wordCount > 0
                                                                        ? "bg-amber-100 text-amber-800"
                                                                        : "bg-gray-100 text-gray-500"
                                                                }`}
                                                            >
                                                                {product.wordCount} words {product.wordCount >= 200 && product.wordCount <= 300 ? "✓" : ""}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="p-3.5 text-center align-top">
                                                {product.isGenerating ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <Icon icon="svg-spinners:ring-resize" width={11} />
                                                        Generating
                                                    </span>
                                                ) : product.isGenerated ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <Icon icon="solar:check-circle-bold" width={11} />
                                                        Ready
                                                    </span>
                                                ) : product.hasShortDesc ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                                        Existing
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                                        Missing
                                                    </span>
                                                )}
                                            </td>

                                            {/* Action Single Generate */}
                                            <td className="p-3.5 text-center align-top">
                                                <button
                                                    type="button"
                                                    onClick={() => handleGenerateSingle(product)}
                                                    disabled={product.isGenerating || isGenerating || isSaving}
                                                    title="Generate with Gemini"
                                                    className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition disabled:opacity-40 cursor-pointer"
                                                >
                                                    <Icon icon="solar:magic-stick-3-bold" width={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Footer Pagination ── */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
                    <p>
                        Showing <strong>{products.length}</strong> products (Batch {pagination.page} of {pagination.totalPages})
                    </p>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                const prev = Math.max(1, page - 1);
                                setPage(prev);
                                fetchProducts(prev, limit);
                            }}
                            disabled={page <= 1 || loading || isGenerating || isSaving}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50 transition cursor-pointer"
                        >
                            <Icon icon="solar:alt-arrow-left-linear" width={14} />
                            Previous {limit}
                        </button>
                        <span className="font-medium px-2 text-gray-700">
                            Batch {page} / {pagination.totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                const next = Math.min(pagination.totalPages, page + 1);
                                setPage(next);
                                fetchProducts(next, limit);
                            }}
                            disabled={page >= pagination.totalPages || loading || isGenerating || isSaving}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50 transition cursor-pointer"
                        >
                            Next {limit}
                            <Icon icon="solar:alt-arrow-right-linear" width={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
