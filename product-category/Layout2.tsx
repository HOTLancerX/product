/**
 * Product Category Layout 2 — Dark minimal style. Fully server-rendered.
 *
 * Identical data pipeline to Layout1 — resolves box component server-side,
 * applies filters/sort from searchParams, renders cards in server JSX.
 * No useActivePlugins, no loading skeleton.
 */

import Link from 'next/link';
import { getAllRootPages } from '@/hook';
import type { CategoryPageData, CategoryProduct } from '@/plugin/product/lib/types';
import ProductGridClient from './ProductGridClient';

interface ProductCatProps {
    data: {
        _id:               string;
        title:             string;
        slug:              string;
        description?:      string;
        shortDescription?: string;
        status:            string;
        createdAt:         string;
        updatedAt:         string;
        info:              Record<string, string>;
    };
    settings?:     Record<string, any>;
    permalinkMap?: Record<string, string>;
    pageData?:     CategoryPageData;
    searchParams?: Record<string, string | string[] | undefined>;
}

function buildUrl(prefix: string, slug: string): string {
    const p = prefix.trim().replace(/^\/+|\/+$/g, '');
    return p ? `/${p}/${slug}` : `/${slug}`;
}

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

            for (const [attrId, filterValues] of Object.entries(activeFilters)) {
                if (!filterValues.length) continue;
                const productSet = productValues.get(attrId);
                if (!productSet) return false;
                if (!filterValues.some(fv => productSet.has(fv.toLowerCase()))) return false;
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
        default:           result.reverse(); break;
    }

    return result;
}

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

export default function ProductCategoryLayout2({
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

    const shortDescription = data.info?.shortDescription || data.info?.short_description || data.shortDescription || '';
    const description      = data.description || data.info?.description || '';

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

    const { activeFilters, minPrice, maxPrice, currentSort } = parseParams(searchParams);

    const products = hasFilters
        ? applyFiltersAndSort(allProducts, activeFilters, minPrice, maxPrice, currentSort)
        : currentSort !== 'newest'
            ? applyFiltersAndSort(allProducts, {}, undefined, undefined, currentSort)
            : allProducts;

    const BoxComponent = resolveBoxComponent(activeBox);

    const catImage        = data.info?.cat_image ?? '';
    const breadcrumbLinks = ancestors.slice(0, -1);
    const currentCatId    = data._id;

    // ── Dynamic Grid Columns & Gaps from Admin Settings ───────────────────────
    const mobColsClass  = Number(settings.category_grid_cols_mobile)  || 2;
    const tabColsClass  = Number(settings.category_grid_cols_tablet)  || 3;
    const deskColsClass = Number(settings.category_grid_cols_desktop) || 4;

    const mobGapClass  = `gap-${settings.category_grid_gap_mobile != null && settings.category_grid_gap_mobile !== '' ? Number(settings.category_grid_gap_mobile) : 4}`;
    const tabGapClass  = `md:gap-${settings.category_grid_gap_tablet != null && settings.category_grid_gap_tablet !== '' ? Number(settings.category_grid_gap_tablet) : 4}`;
    const deskGapClass = `lg:gap-${settings.category_grid_gap_desktop != null && settings.category_grid_gap_desktop !== '' ? Number(settings.category_grid_gap_desktop) : 5}`;

    const gridClass = `grid grid-cols-${mobColsClass} md:grid-cols-${tabColsClass} lg:grid-cols-${deskColsClass} ${mobGapClass} ${tabGapClass} ${deskGapClass} w-full`;

    const cardGrid = products.length === 0 ? (
        <div className="text-center py-20 text-white/40">
            <p className="text-4xl mb-4">🛍️</p>
            <p className="text-lg font-medium">
                {Object.keys(activeFilters).length > 0 || minPrice !== undefined || maxPrice !== undefined
                    ? 'No products match your filters.'
                    : 'No products in this category yet.'}
            </p>
        </div>
    ) : (
        <div className={gridClass}>
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
                        className="bg-white/5 border border-white/10 rounded-2xl shadow-sm hover:border-emerald-500/30 transition-shadow p-4"
                    >
                        <p className="text-sm font-semibold text-white/90 line-clamp-2">
                            {product.title}
                        </p>
                    </Link>
                )
            )}
        </div>
    );

    return (
        <main className="min-h-screen bg-[#0a0c10]">

            {/* ── Banner ── */}
            <header
                className="relative py-16 px-6 overflow-hidden"
                style={catImage ? {
                    backgroundImage:    `url(${catImage})`,
                    backgroundSize:     'cover',
                    backgroundPosition: 'center',
                } : undefined}
            >
                <div className="absolute inset-0 bg-linear-to-r from-[#0a0c10]/90 via-[#0a0c10]/60 to-transparent" />
                <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
                <div className="relative container">
                    <nav className="flex items-center gap-1.5 text-sm text-white/50 mb-4 flex-wrap" aria-label="breadcrumb">
                        <Link href="/" className="hover:text-white transition-colors">Home</Link>
                        {breadcrumbLinks.map((ancestor) => (
                            <span key={ancestor._id} className="flex items-center gap-1.5">
                                <span className="text-white/30">›</span>
                                <Link href={buildUrl(catPrefix, ancestor.slug)} className="hover:text-white transition-colors">
                                    {ancestor.title}
                                </Link>
                            </span>
                        ))}
                        <span className="text-white/30">›</span>
                        <span className="text-white/80 font-medium">{data.title}</span>
                    </nav>
                    <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight capitalize">
                        {data.title}
                    </h1>
                    {shortDescription && (
                        <div
                            className="text-white/80 text-sm sm:text-base mt-2 max-w-3xl leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: shortDescription }}
                        />
                    )}
                    <div className="flex items-center gap-3 mt-4 flex-wrap">
                        <span className="text-white/50 text-sm">
                            {allProducts.length} product{allProducts.length !== 1 ? 's' : ''}
                        </span>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${
                            data.status === 'published'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-white/10 text-white/60'
                        }`}>
                            {data.status}
                        </span>
                    </div>
                </div>
            </header>

            <div className="container py-8 space-y-6">

                {subCats.length > 0 && (
                    <nav className="flex flex-wrap gap-2" aria-label="Sub-categories">
                        {subCats.map((sub) => (
                            <Link
                                key={sub._id}
                                href={buildUrl(catPrefix, sub.slug)}
                                className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-white/70 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
                            >
                                {sub.title}
                            </Link>
                        ))}
                    </nav>
                )}

                {hasFilters || sortEnabled ? (
                    <ProductGridClient
                        totalProducts={allProducts.length}
                        filteredCount={products.length}
                        hasFilters={hasFilters}
                        filterStyle={filterStyle}
                        attributeOptions={attrOptions}
                        showPriceFilter={priceFilter}
                        showSort={sortEnabled}
                        theme="dark"
                        activeFilters={activeFilters}
                        minPrice={minPrice}
                        maxPrice={maxPrice}
                        currentSort={currentSort}
                    >
                        {cardGrid}
                    </ProductGridClient>
                ) : (
                    cardGrid
                )}

                {/* Category Description (Bottom) */}
                {description && (
                    <div className="bg-white/5 rounded-2xl border border-white/10 p-6 md:p-8 mt-8">
                        <div
                            className="prose prose-invert max-w-none text-white/80 description"
                            dangerouslySetInnerHTML={{ __html: description }}
                        />
                    </div>
                )}
            </div>
        </main>
    );
}

