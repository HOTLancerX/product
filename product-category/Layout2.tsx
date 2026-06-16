/**
 * Product Category Layout 2 — Dark minimal style.
 *
 * Same data pipeline as Layout1 — receives pageData from page.tsx.
 * No API calls, no Mongoose imports.
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
    pageData?: CategoryPageData;
}

function buildUrl(prefix: string, slug: string): string {
    const p = prefix.trim().replace(/^\/+|\/+$/g, '');
    return p ? `/${p}/${slug}` : `/${slug}`;
}

export default function ProductCategoryLayout2({
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
    const breadcrumbLinks = ancestors.slice(0, -1);

    return (
        <main className="min-h-screen bg-[#0a0c10]">

            {/* ── Banner ── */}
            <header
                className="relative py-16 px-6 overflow-hidden"
                style={catImage ? {
                    backgroundImage: `url(${catImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                } : undefined}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0c10]/90 via-[#0a0c10]/60 to-transparent" />
                <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

                <div className="relative max-w-6xl mx-auto">
                    <nav className="flex items-center gap-1.5 text-sm text-white/50 mb-4 flex-wrap"
                        aria-label="breadcrumb">
                        <Link href="/" className="hover:text-white transition-colors">Home</Link>
                        {breadcrumbLinks.map(ancestor => (
                            <span key={ancestor._id} className="flex items-center gap-1.5">
                                <span className="text-white/30">›</span>
                                <Link
                                    href={buildUrl(catPrefix, ancestor.slug)}
                                    className="hover:text-white transition-colors"
                                >
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

                    <div className="flex items-center gap-3 mt-4 flex-wrap">
                        <span className="text-white/50 text-sm">
                            {products.length} product{products.length !== 1 ? 's' : ''}
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

            <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-8">

                {/* Sub-category chips */}
                {subCats.length > 0 && (
                    <nav className="flex flex-wrap gap-2" aria-label="Sub-categories">
                        {subCats.map(sub => (
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

                {/* Product grid */}
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
