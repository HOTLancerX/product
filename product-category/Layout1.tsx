/**
 * Product Category Layout 1 — Clean shop-style. Fully server-rendered.
 *
 * No client-side hook resolution. The active product-box component is
 * resolved here on the server from the permanent _rootPages registry
 * (already populated by getRootPages() in the slug page).  Products are
 * filtered and sorted server-side from URL search params passed through
 * the pageData prop.
 *
 * Only the filter panel UI and sort dropdown are client-side (ProductGridClient),
 * so the first paint contains real product cards — no loading skeleton.
 *
 * Settings keys that control this layout:
 *   product_cat_filter_enabled  — "0" to disable filter panel (default on)
 *   product_cat_filter_style    — "1" | "2" | "3" | "4"  (default "1")
 *   product_cat_price_filter    — "0" to hide price range (default on)
 *   product_cat_sort_enabled    — "0" to hide sort dropdown (default on)
 */

import Link from 'next/link';
import { getAllRootPages } from '@/hook';
import type { CategoryPageData, CategoryProduct } from '@/plugin/product/lib/types';
import ProductGridClient from './ProductGridClient';

interface ProductCatProps {
    data: {
        _id:       string;
        title:     string;
        slug:      string;
        status:    string;
        createdAt: string;
        updatedAt: string;
        info:      Record<string, string>;
    };
    settings?:     Record<string, any>;
    permalinkMap?: Record<string, string>;
    pageData?:     CategoryPageData;
    /** URL search params forwarded from the slug page */
    searchParams?: Record<string, string | string[] | undefined>;
}

function buildUrl(prefix: string, slug: string): string {
    const p = prefix.trim().replace(/^\/+|\/+$/g, '');
    return p ? `/${p}/${slug}` : `/${slug}`;
}

// ── Filter / sort helpers ────────────────────────────────────────────────────

function parseParams(raw: Record<string, string | string[] | undefined>) {
    const activeFilters: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(raw)) {
        if (key.startsWith('attr_') && val) {
            const v = Array.isArray(val) ? val.join(',') : val;
            activeFilters[key.slice(5)] = v.split(',').filter(Boolean);
        }
    }
    const minRaw = raw['min_price'];
    const maxRaw = raw['max_price'];
    return {
        activeFilters,
        minPrice:    minRaw ? parseFloat(Array.isArray(minRaw) ? minRaw[0] : minRaw) : undefined,
        maxPrice:    maxRaw ? parseFloat(Array.isArray(maxRaw) ? maxRaw[0] : maxRaw) : undefined,
        currentSort: (Array.isArray(raw['sort']) ? raw['sort'][0] : raw['sort']) || 'newest',
    };
}

function applyFiltersAndSort(
    products:      CategoryProduct[],
    activeFilters: Record<string, string[]>,
    minPrice:      number | undefined,
    maxPrice:      number | undefined,
    currentSort:   string
): CategoryProduct[] {
    let result = [...products];

    // Attribute filter — values live inside the _variate JSON blob
    if (Object.keys(activeFilters).some(k => (activeFilters[k] ?? []).length > 0)) {
        result = result.filter((p) => {
            let blob: Record<string, any> = {};
            try { blob = JSON.parse(p.info['_variate'] ?? '{}'); } catch { /* skip */ }

            const priceType: string = blob.priceType ?? 'single';

            // Build a map of { labelSlug → Set<value> } for this product
            const productValues: Map<string, Set<string>> = new Map();

            if (priceType === 'single') {
                const attrs: { label: string; values: string[] }[] = blob.singleAttributes ?? [];
                for (const attr of attrs) {
                    if (!attr.label) continue;
                    const id = attr.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                    const set = productValues.get(id) ?? new Set<string>();
                    for (const v of (attr.values ?? [])) set.add(String(v).toLowerCase());
                    productValues.set(id, set);
                }
            } else {
                // Variant: collect from selectedAttributes values + actual variant options
                const selAttrs: { label: string; values: string[] }[] = blob.selectedAttributes ?? [];
                for (const attr of selAttrs) {
                    if (!attr.label) continue;
                    const id = attr.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                    const set = productValues.get(id) ?? new Set<string>();
                    for (const v of (attr.values ?? [])) set.add(String(v).toLowerCase());
                    productValues.set(id, set);
                }
                const variants: { options?: Record<string, string> }[] = blob.variants ?? [];
                for (const variant of variants) {
                    if (!variant.options) continue;
                    for (const [label, val] of Object.entries(variant.options)) {
                        const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                        const set = productValues.get(id) ?? new Set<string>();
                        set.add(String(val).toLowerCase());
                        productValues.set(id, set);
                    }
                }
            }

            // Product must match ALL active filter groups
            for (const [attrId, filterValues] of Object.entries(activeFilters)) {
                if (!filterValues.length) continue;
                const productSet = productValues.get(attrId);
                if (!productSet) return false;
                // At least one of the selected filter values must match
                const hasMatch = filterValues.some(fv => productSet.has(fv.toLowerCase()));
                if (!hasMatch) return false;
            }
            return true;
        });
    }

    // Price filter — reads from _variate blob
    if (minPrice !== undefined || maxPrice !== undefined) {
        result = result.filter((p) => {
            let blob: Record<string, any> = {};
            try { blob = JSON.parse(p.info['_variate'] ?? '{}'); } catch { /* skip */ }
            const price = parseFloat(blob.sellingprice || blob.regularprice || '0') || 0;
            if (minPrice !== undefined && price < minPrice) return false;
            if (maxPrice !== undefined && price > maxPrice) return false;
            return true;
        });
    }

    // Sort — price reads from _variate blob
    const getPrice = (p: CategoryProduct): number => {
        try {
            const blob = JSON.parse(p.info['_variate'] ?? '{}');
            return parseFloat(blob.sellingprice || blob.regularprice || '0') || 0;
        } catch { return 0; }
    };

    switch (currentSort) {
        case 'price_asc':  result.sort((a, b) => getPrice(a) - getPrice(b)); break;
        case 'price_desc': result.sort((a, b) => getPrice(b) - getPrice(a)); break;
        case 'title_asc':  result.sort((a, b) => a.title.localeCompare(b.title)); break;
        case 'title_desc': result.sort((a, b) => b.title.localeCompare(a.title)); break;
        case 'oldest':     break;
        default:           result.reverse(); break; // newest
    }

    return result;
}

// ── Resolve the active product-box component server-side ─────────────────────

function resolveBoxComponent(
    activeBox: { label: string; pluginNx: string } | null
): React.ComponentType<any> | null {
    const boxes = getAllRootPages().filter(
        (p) => p.type === 'product-box' && p.slug === 'dynamic'
    );
    if (!boxes.length) return null;

    if (activeBox) {
        const match = boxes.find(
            (b) => b.label === activeBox.label && b.pluginNx === activeBox.pluginNx
        );
        if (match?.component) return match.component;
    }

    return (boxes.find((b) => b.active === true) ?? boxes[0])?.component ?? null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ProductCategoryLayout1({
    data,
    settings = {},
    permalinkMap = {},
    pageData,
    searchParams = {},
}: ProductCatProps) {
    const productPrefix = (permalinkMap['product'] ?? 'product')
        .trim().replace(/^\/+|\/+$/g, '') || 'product';
    const catPrefix = (permalinkMap['product-category'] ?? 'product/category')
        .trim().replace(/^\/+|\/+$/g, '');

    const currencySymbol = (settings.product_currency_symbol as string) || '$';

    const allProducts = pageData?.products        ?? [];
    const subCats     = pageData?.subCats         ?? [];
    const ancestors   = pageData?.ancestors       ?? [];
    const activeBox   = pageData?.activeBox       ?? null;
    const attrOptions = pageData?.attributeOptions ?? [];

    // ── Settings flags ────────────────────────────────────────────────────────
    const filterEnabled = settings.product_cat_filter_enabled !== '0';
    const priceFilter   = settings.product_cat_price_filter   !== '0';
    const sortEnabled   = settings.product_cat_sort_enabled   !== '0';
    const rawStyle      = parseInt(String(settings.product_cat_filter_style ?? '1'), 10);
    const filterStyle   = ([1, 2, 3, 4].includes(rawStyle) ? rawStyle : 1) as 1 | 2 | 3 | 4;
    const hasFilters    = filterEnabled && (attrOptions.length > 0 || priceFilter);

    // ── Parse search params & apply filters server-side ───────────────────────
    const { activeFilters, minPrice, maxPrice, currentSort } = parseParams(searchParams);

    const products = hasFilters
        ? applyFiltersAndSort(allProducts, activeFilters, minPrice, maxPrice, currentSort)
        : currentSort !== 'newest'
            ? applyFiltersAndSort(allProducts, {}, undefined, undefined, currentSort)
            : allProducts;

    // ── Resolve box component (server-side) ───────────────────────────────────
    const BoxComponent = resolveBoxComponent(activeBox);

    const catImage        = data.info?.cat_image ?? '';
    const breadcrumbLinks = ancestors.slice(0, -1);
    // The current category _id — used as fallback for products that lack a
    // category field (shouldn't happen, but defensive).
    const currentCatId = data._id;

    // ── Render product cards (pure server JSX) ────────────────────────────────
    const cardGrid = products.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-4">🛍️</p>
            <p className="text-lg font-medium">
                {Object.keys(activeFilters).length > 0 || minPrice !== undefined || maxPrice !== undefined
                    ? 'No products match your filters.'
                    : 'No products in this category yet.'}
            </p>
        </div>
    ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {products.map((product) =>
                BoxComponent ? (
                    <BoxComponent
                        key={product._id}
                        data={{ ...product, category: product.category ?? currentCatId }}
                        productUrl={buildUrl(productPrefix, product.slug)}
                        currencySymbol={currencySymbol}
                    />
                ) : (
                    <Link
                        key={product._id}
                        href={buildUrl(productPrefix, product.slug)}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4"
                    >
                        <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                            {product.title}
                        </p>
                    </Link>
                )
            )}
        </div>
    );

    return (
        <main className="min-h-screen bg-gray-50">

            {/* ── Banner ── */}
            <header
                className="relative bg-linear-to-r from-emerald-600 to-teal-600 py-12 px-6 overflow-hidden"
                style={catImage ? {
                    backgroundImage:    `url(${catImage})`,
                    backgroundSize:     'cover',
                    backgroundPosition: 'center',
                } : undefined}
            >
                {catImage && <div className="absolute inset-0 bg-black/50" />}
                <div className="relative container">
                    <nav className="flex items-center gap-1.5 text-sm text-white/70 mb-4 flex-wrap" aria-label="breadcrumb">
                        <Link href="/" className="hover:text-white transition-colors">Home</Link>
                        {breadcrumbLinks.map((ancestor) => (
                            <span key={ancestor._id} className="flex items-center gap-1.5">
                                <span className="text-white/40">›</span>
                                <Link href={buildUrl(catPrefix, ancestor.slug)} className="hover:text-white transition-colors">
                                    {ancestor.title}
                                </Link>
                            </span>
                        ))}
                        <span className="text-white/40">›</span>
                        <span className="text-white font-medium">{data.title}</span>
                    </nav>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white capitalize leading-tight">
                        {data.title}
                    </h1>
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                        <span className="text-white/70 text-sm">
                            {allProducts.length} product{allProducts.length !== 1 ? 's' : ''}
                        </span>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${
                            data.status === 'published' ? 'bg-white text-emerald-700' : 'bg-white/20 text-white'
                        }`}>
                            {data.status}
                        </span>
                    </div>
                </div>
            </header>

            <div className="container py-8 space-y-6">

                {/* Sub-category chips */}
                {subCats.length > 0 && (
                    <nav className="flex flex-wrap gap-2" aria-label="Sub-categories">
                        {subCats.map((sub) => (
                            <Link
                                key={sub._id}
                                href={buildUrl(catPrefix, sub.slug)}
                                className="inline-flex items-center px-4 py-1.5 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:border-emerald-400 hover:text-emerald-700 transition-colors shadow-sm"
                            >
                                {sub.title}
                            </Link>
                        ))}
                    </nav>
                )}

                {/* Client shell — wraps server-rendered cards with filter/sort UI */}
                <ProductGridClient
                    totalProducts={allProducts.length}
                    filteredCount={products.length}
                    hasFilters={hasFilters}
                    filterStyle={filterStyle}
                    attributeOptions={attrOptions}
                    showPriceFilter={priceFilter}
                    showSort={sortEnabled}
                    theme="light"
                    activeFilters={activeFilters}
                    minPrice={minPrice}
                    maxPrice={maxPrice}
                    currentSort={currentSort}
                >
                    {cardGrid}
                </ProductGridClient>
            </div>
        </main>
    );
}
