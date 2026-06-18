/**
 * Product Category Layout 1 — Clean shop-style.
 *
 * Receives `data`, `settings`, `permalinkMap`, and `pageData` from the
 * slug page. All DB work is done in page.tsx via getCategoryPageData().
 * No API calls, no Mongoose imports here.
 *
 * The product grid is rendered by ProductGridClient which resolves the
 * active product-box component client-side from the hook registry.
 */

import Link from 'next/link';
import type { CategoryPageData } from '@/plugin/product/lib/types';
import ProductGridClient from './ProductGridClient';

interface ProductCatProps {
    data: {
        _id: string;
        title: string;
        slug: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        info: Record<string, string>;
    };
    settings?: Record<string, any>;
    permalinkMap?: Record<string, string>;
    /** Pre-fetched server data from getCategoryPageData() in page.tsx */
    pageData?: CategoryPageData;
}

function buildUrl(prefix: string, slug: string): string {
    const p = prefix.trim().replace(/^\/+|\/+$/g, '');
    return p ? `/${p}/${slug}` : `/${slug}`;
}

export default function ProductCategoryLayout1({
    data,
    settings = {},
    permalinkMap = {},
    pageData,
}: ProductCatProps) {
    const productPrefix = (permalinkMap['product'] ?? 'product')
        .trim().replace(/^\/+|\/+$/g, '') || 'product';
    const catPrefix = (permalinkMap['product-category'] ?? 'product/category')
        .trim().replace(/^\/+|\/+$/g, '');

    const currencySymbol = (settings.product_currency_symbol as string) || '$';

    const products  = pageData?.products  ?? [];
    const subCats   = pageData?.subCats   ?? [];
    const ancestors = pageData?.ancestors ?? [];
    const activeBox = pageData?.activeBox ?? null;

    const catImage = data.info?.cat_image ?? '';

    // Build breadcrumb: ancestors except last (which is the current category)
    const breadcrumbLinks = ancestors.slice(0, -1);

    return (
        <main className="min-h-screen bg-gray-50">

            {/* ── Banner ── */}
            <header
                className="relative bg-linear-to-r from-emerald-600 to-teal-600 py-12 px-6 overflow-hidden"
                style={catImage ? {
                    backgroundImage: `url(${catImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                } : undefined}
            >
                {catImage && <div className="absolute inset-0 bg-black/50" />}

                <div className="relative max-w-6xl mx-auto">
                    {/* Breadcrumb: Home > Parent > ... > Current */}
                    <nav className="flex items-center gap-1.5 text-sm text-white/70 mb-4 flex-wrap"
                        aria-label="breadcrumb">
                        <Link href="/" className="hover:text-white transition-colors">Home</Link>
                        {breadcrumbLinks.map(ancestor => (
                            <span key={ancestor._id} className="flex items-center gap-1.5">
                                <span className="text-white/40">›</span>
                                <Link
                                    href={buildUrl(catPrefix, ancestor.slug)}
                                    className="hover:text-white transition-colors"
                                >
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
                            {products.length} product{products.length !== 1 ? 's' : ''}
                        </span>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${
                            data.status === 'published' ? 'bg-white text-emerald-700' : 'bg-white/20 text-white'
                        }`}>
                            {data.status}
                        </span>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-8">

                {/* Sub-category chips */}
                {subCats.length > 0 && (
                    <nav className="flex flex-wrap gap-2" aria-label="Sub-categories">
                        {subCats.map(sub => (
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

                {/* Product grid — resolved client-side by hook registry */}
                <ProductGridClient
                    products={products}
                    activeBox={activeBox}
                    productPrefix={productPrefix}
                    currencySymbol={currencySymbol}
                />
            </div>
        </main>
    );
}
