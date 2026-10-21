/**
 * cms/plugin/product/product-brand/Layout.tsx
 *
 * Product Brand Layout 1 — Clean Shop Style (Light Theme). Fully server-rendered with client reactivity.
 *  - Mirrors the architecture of cms/plugin/product/product-category/Layout1.tsx
 *  - Features:
 *      • Breadcrumbs (Home / Brands / [Brand Title] / [Category Title])
 *      • Brand Header Banner with Logo, Title, Description, and Total Count
 *      • Popular / Available Category Filter Pills under this brand
 *      • Controlled FilterPanel (Styles 1, 2, 3 accordion + Style 4 horizontal bar)
 *      • Instant optimistic sorting and attribute/price filtering via ProductGridClient
 *      • Dynamic grid columns & gaps from settings
 *      • Active product box resolution (ProductBox1, ProductBox2, or GadgetsBox1 fallback)
 */

import Link from 'next/link';
import { Icon } from '@iconify/react';
import { getAllRootPages } from '@/hook';
import type { CategoryProduct } from '@/plugin/product/lib/types';
import type { BrandPageData } from '@/plugin/product/lib/brand';
import ProductGridClient from '../product-category/ProductGridClient';

interface ProductBrandProps {
    data: {
        _id:               string;
        title:             string;
        slug:              string;
        description?:      string;
        shortDescription?: string;
        status?:           string;
        image?:            string;
        createdAt?:        string;
        updatedAt?:        string;
        info?:             Record<string, string>;
    };
    settings?:     Record<string, any>;
    permalinkMap?: Record<string, string>;
    pageData?:     BrandPageData;
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

            return Object.entries(activeFilters).every(([attrId, selectedValues]) => {
                if (!selectedValues || selectedValues.length === 0) return true;
                const available = productValues.get(attrId);
                if (!available) return false;
                return selectedValues.some((v) => available.has(v.toLowerCase()));
            });
        });
    }

    // Price filter
    if (minPrice !== undefined || maxPrice !== undefined) {
        result = result.filter((p) => {
            let blob: Record<string, any> = {};
            try { blob = JSON.parse(p.info['_variate'] ?? '{}'); } catch { /* skip */ }

            let price = 0;
            if (blob.priceType === 'single') {
                price = Number(blob.singleSalePrice) || Number(blob.singleRegularPrice) || 0;
            } else {
                const prices: number[] = (blob.variants ?? [])
                    .map((v: any) => Number(v.salePrice) || Number(v.regularPrice) || 0)
                    .filter((n: number) => n > 0);
                price = prices.length > 0 ? Math.min(...prices) : 0;
            }

            if (minPrice !== undefined && price < minPrice) return false;
            if (maxPrice !== undefined && price > maxPrice) return false;
            return true;
        });
    }

    // Sort
    result.sort((a, b) => {
        const getEffectivePrice = (prod: CategoryProduct): number => {
            let blob: Record<string, any> = {};
            try { blob = JSON.parse(prod.info['_variate'] ?? '{}'); } catch { /* skip */ }
            if (blob.priceType === 'single') {
                return Number(blob.singleSalePrice) || Number(blob.singleRegularPrice) || 0;
            }
            const prices: number[] = (blob.variants ?? [])
                .map((v: any) => Number(v.salePrice) || Number(v.regularPrice) || 0)
                .filter((n: number) => n > 0);
            return prices.length > 0 ? Math.min(...prices) : 0;
        };

        if (currentSort === 'price_asc') {
            return getEffectivePrice(a) - getEffectivePrice(b);
        }
        if (currentSort === 'price_desc') {
            return getEffectivePrice(b) - getEffectivePrice(a);
        }
        if (currentSort === 'title_asc') {
            return a.title.localeCompare(b.title);
        }
        if (currentSort === 'title_desc') {
            return b.title.localeCompare(a.title);
        }
        const aDate = (a as any).createdAt || a.info?.createdAt || '';
        const bDate = (b as any).createdAt || b.info?.createdAt || '';
        if (currentSort === 'oldest') {
            return new Date(aDate).getTime() - new Date(bDate).getTime();
        }
        // 'newest' default
        return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    return result;
}

// ── Box component resolution ─────────────────────────────────────────────────

function resolveBoxComponent(activeBox: { label: string; pluginNx: string } | null) {
    if (!activeBox) return null;
    const all = getAllRootPages();
    const match = all.find(
        (p) =>
            p.type === 'product-box' &&
            p.label === activeBox.label &&
            p.pluginNx === activeBox.pluginNx
    );
    return (match?.component as React.ComponentType<any>) ?? null;
}

// ── Fallback clean product card ──────────────────────────────────────────────

function DefaultBrandProductCard({
    product,
    productPrefix,
    currencySymbol,
}: {
    product:        CategoryProduct;
    productPrefix:  string;
    currencySymbol: string;
}) {
    let variate: Record<string, any> = {};
    try { variate = JSON.parse(product.info['_variate'] ?? '{}'); } catch { /* skip */ }

    let price = 0;
    let regularPrice = 0;
    if (variate.priceType === 'single') {
        price        = Number(variate.singleSalePrice) || Number(variate.singleRegularPrice) || 0;
        regularPrice = Number(variate.singleRegularPrice) || 0;
    } else {
        const prices: number[] = (variate.variants ?? [])
            .map((v: any) => Number(v.salePrice) || Number(v.regularPrice) || 0)
            .filter((n: number) => n > 0);
        price = prices.length > 0 ? Math.min(...prices) : 0;
    }

    const isOnSale = regularPrice > 0 && price < regularPrice;
    const href     = buildUrl(productPrefix, product.slug);
    const imageUrl = (product as any).image || product.info?.image || product.info?.images || '';

    return (
        <div className="group relative bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-xl hover:border-gray-200 transition-all duration-300 flex flex-col justify-between p-4">
            <div>
                {/* Image container */}
                <div className="relative aspect-square w-full rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden mb-3">
                    {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={imageUrl}
                            alt={product.title}
                            className="object-contain w-full h-full max-h-52 group-hover:scale-105 transition-transform duration-300 p-2"
                            loading="lazy"
                        />
                    ) : (
                        <div className="text-gray-300">
                            <Icon icon="solar:camera-minimalistic-linear" width={40} />
                        </div>
                    )}

                    {isOnSale && (
                        <span className="absolute top-2.5 left-2.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs">
                            Sale
                        </span>
                    )}
                </div>

                {/* Title */}
                <Link href={href} className="block group-hover:text-blue-600 transition-colors">
                    <h3 className="font-bold text-gray-900 text-sm line-clamp-2 leading-snug">
                        {product.title}
                    </h3>
                </Link>
            </div>

            {/* Price & Action */}
            <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                <div>
                    <span className="text-sm sm:text-base font-extrabold text-gray-900">
                        {currencySymbol}{price > 0 ? price.toLocaleString() : '—'}
                    </span>
                    {isOnSale && (
                        <span className="block text-[11px] text-gray-400 line-through">
                            {currencySymbol}{regularPrice.toLocaleString()}
                        </span>
                    )}
                </div>

                <Link
                    href={href}
                    className="p-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-blue-600 hover:text-white transition-all shadow-2xs"
                    aria-label={`View ${product.title}`}
                >
                    <Icon icon="solar:arrow-right-linear" width={16} />
                </Link>
            </div>
        </div>
    );
}

export default function ProductBrandLayout({
    data,
    settings = {},
    permalinkMap = {},
    pageData,
    searchParams = {},
}: ProductBrandProps) {
    const brandPrefix = (permalinkMap['brands'] ?? 'brands').trim().replace(/^\/+|\/+$/g, '') || 'brands';
    const productPrefix = (permalinkMap['product'] ?? 'product').trim().replace(/^\/+|\/+$/g, '') || 'product';

    const currencySymbol = (settings.product_currency_symbol as string) || '$';

    const allProducts = pageData?.products ?? [];
    const popularCats = pageData?.popularCategories ?? [];
    const activeBox   = pageData?.activeBox ?? null;
    const attrOptions = pageData?.attributeOptions ?? [];
    const activeCatSlug = pageData?.activeCategorySlug ?? null;
    const activeCatTitle = pageData?.activeCategoryTitle ?? null;

    const brandTitle       = data.title || pageData?.brand?.title || 'Brand';
    const brandImage       = data.image || pageData?.brand?.image || data.info?.images || '';
    const description      = data.description || data.info?.description || pageData?.brand?.description || '';
    const shortDescription = data.info?.shortDescription || data.shortDescription || '';

    // ── Dynamic Settings & Category Info Flags ───────────────────────────────
    const filterEnabled =
        data.info?.filter_enabled !== '0' &&
        data.info?.filter_disabled !== '1' &&
        settings.category_filter_enabled !== '0' &&
        settings.product_cat_filter_enabled !== '0';

    const priceFilter =
        data.info?.price_filter !== '0' &&
        settings.category_price_filter !== '0' &&
        settings.product_cat_price_filter !== '0';

    const sortEnabled =
        data.info?.sort_enabled !== '0' &&
        data.info?.sort_disabled !== '1' &&
        settings.category_sort_enabled !== '0' &&
        settings.product_cat_sort_enabled !== '0';

    const rawStyle = parseInt(
        String(
            data.info?.filter_style ??
            settings.category_filter_style ??
            settings.product_cat_filter_style ??
            '1'
        ),
        10
    );
    const filterStyle = ([1, 2, 3, 4].includes(rawStyle) ? rawStyle : 1) as 1 | 2 | 3 | 4;
    const hasFilters = filterEnabled && (attrOptions.length > 0 || priceFilter);

    // ── Parse search params & apply filters server-side ───────────────────────
    const { activeFilters, minPrice, maxPrice, currentSort } = parseParams(searchParams);

    const products = hasFilters
        ? applyFiltersAndSort(allProducts, activeFilters, minPrice, maxPrice, currentSort)
        : currentSort !== 'newest'
            ? applyFiltersAndSort(allProducts, {}, undefined, undefined, currentSort)
            : allProducts;

    // ── Resolve box component ─────────────────────────────────────────────────
    const BoxComponent = resolveBoxComponent(activeBox);

    // ── Dynamic Grid Columns & Gaps from Admin Settings ───────────────────────
    const mobColsClass  = Number(settings.category_grid_cols_mobile)  || 2;
    const tabColsClass  = Number(settings.category_grid_cols_tablet)  || 3;
    const deskColsClass = Number(settings.category_grid_cols_desktop) || 4;

    const mobGapClass  = `gap-${settings.category_grid_gap_mobile != null && settings.category_grid_gap_mobile !== '' ? Number(settings.category_grid_gap_mobile) : 4}`;
    const tabGapClass  = `md:gap-${settings.category_grid_gap_tablet != null && settings.category_grid_gap_tablet !== '' ? Number(settings.category_grid_gap_tablet) : 4}`;
    const deskGapClass = `lg:gap-${settings.category_grid_gap_desktop != null && settings.category_grid_gap_desktop !== '' ? Number(settings.category_grid_gap_desktop) : 5}`;

    const gridClass = `grid grid-cols-${mobColsClass} md:grid-cols-${tabColsClass} lg:grid-cols-${deskColsClass} ${mobGapClass} ${tabGapClass} ${deskGapClass} w-full`;

    // ── Render product cards ──────────────────────────────────────────────────
    const cardGrid = products.length === 0 ? (
        <div className="text-center py-20 text-gray-500 bg-gray-50/50 rounded-2xl border border-gray-100 p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                <Icon icon="solar:box-minimalistic-linear" width={32} />
            </div>
            <p className="text-lg font-semibold text-gray-800">
                {Object.keys(activeFilters).length > 0 || minPrice !== undefined || maxPrice !== undefined
                    ? 'No products match your filters.'
                    : `No products available for ${brandTitle} yet.`}
            </p>
            <p className="text-xs text-gray-400 mt-1">
                Try adjusting your search criteria or price range.
            </p>
        </div>
    ) : (
        <div className={gridClass}>
            {products.map((p) => {
                if (BoxComponent) {
                    return (
                        <BoxComponent
                            key={p._id}
                            data={p}
                            settings={settings}
                            permalinkMap={permalinkMap}
                        />
                    );
                }
                return (
                    <DefaultBrandProductCard
                        key={p._id}
                        product={p}
                        productPrefix={productPrefix}
                        currencySymbol={currencySymbol}
                    />
                );
            })}
        </div>
    );

    return (
        <main className="w-full bg-white min-h-screen text-gray-900">
            {/* ── Breadcrumb Bar ── */}
            <div className="border-b border-gray-100 bg-gray-50/60 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center gap-1.5 text-xs text-gray-500 overflow-x-auto whitespace-nowrap scrollbar-none">
                        <Link href="/" className="hover:text-gray-900 transition flex items-center gap-1">
                            <Icon icon="solar:home-2-linear" width={14} />
                            <span>Home</span>
                        </Link>
                        <span className="text-gray-300">/</span>
                        <Link href={`/${brandPrefix}`} className="hover:text-gray-900 transition">
                            Brands
                        </Link>
                        <span className="text-gray-300">/</span>
                        <Link
                            href={`/${brandPrefix}/${data.slug}`}
                            className={`transition ${!activeCatSlug ? 'font-bold text-gray-900' : 'hover:text-gray-900'}`}
                        >
                            {brandTitle}
                        </Link>
                        {activeCatTitle && (
                            <>
                                <span className="text-gray-300">/</span>
                                <span className="font-bold text-gray-900">{activeCatTitle}</span>
                            </>
                        )}
                    </nav>
                </div>
            </div>

            {/* ── Brand Banner Header ── */}
            <section className="border-b border-gray-100 bg-linear-to-b from-gray-50/80 to-white py-8 sm:py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-4 sm:gap-5">
                            {brandImage ? (
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border border-gray-200 p-2 shadow-xs flex items-center justify-center shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={brandImage}
                                        alt={brandTitle}
                                        className="max-h-full max-w-full object-contain"
                                    />
                                </div>
                            ) : (
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-black text-xl sm:text-2xl shrink-0 font-mono">
                                    {brandTitle.charAt(0).toUpperCase()}
                                </div>
                            )}

                            <div>
                                <div className="flex items-center gap-2.5">
                                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
                                        {brandTitle}
                                    </h1>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                        {allProducts.length} {allProducts.length === 1 ? 'item' : 'items'}
                                    </span>
                                </div>

                                {(shortDescription || description) && (
                                    <p className="mt-1 text-xs sm:text-sm text-gray-500 max-w-2xl line-clamp-2 leading-relaxed">
                                        {shortDescription || description}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Back to all brands directory button */}
                        <Link
                            href={`/${brandPrefix}`}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 px-3.5 py-2 rounded-xl transition shadow-2xs shrink-0"
                        >
                            <Icon icon="solar:alt-arrow-left-linear" width={14} />
                            <span>All Brands</span>
                        </Link>
                    </div>

                    {/* ── Category Filter Pills Under This Brand ── */}
                    {popularCats.length > 0 && (
                        <div className="mt-6 pt-5 border-t border-gray-100">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2.5">
                                Browse {brandTitle} Categories:
                            </span>
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                                {/* All category pill */}
                                <Link
                                    href={`/${brandPrefix}/${data.slug}`}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 border ${
                                        !activeCatSlug
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    All ({pageData?.allBrandProducts?.length || allProducts.length})
                                </Link>

                                {popularCats.map((cat) => {
                                    const isSelected = activeCatSlug === cat.slug;
                                    return (
                                        <Link
                                            key={cat._id}
                                            href={`/${brandPrefix}/${data.slug}/${cat.slug}`}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 border ${
                                                isSelected
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            {cat.title} ({cat.count})
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* ── Product Listing & Filter Section ── */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
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
