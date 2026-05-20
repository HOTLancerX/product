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
}

/**
 * Product category template — Layout 1
 * Clean shop-style: green banner header, product grid placeholder, SEO panel.
 */
export default function ProductCategoryLayout1({ data }: ProductCatProps) {
    const seoTitle = data.info?.seo_meta_title || "";
    const seoDesc = data.info?.seo_meta_description || "";
    const seoKw = data.info?.seo_meta_keyword || "";

    const knownKeys = new Set(["seo_meta_title", "seo_meta_description", "seo_meta_keyword"]);
    const extraInfo = Object.entries(data.info || {}).filter(([k]) => !knownKeys.has(k));

    return (
        <main className="min-h-screen bg-gray-50">
            {/* ── Banner ── */}
            <header className="bg-linear-to-r from-emerald-600 to-teal-600 py-14 px-6">
                <div className="max-w-6xl mx-auto flex items-end justify-between gap-6 flex-wrap">
                    <div>
                        <p className="text-emerald-100 text-xs font-semibold uppercase tracking-widest mb-3">
                            Product Category
                        </p>
                        <h1 className="text-4xl sm:text-5xl font-extrabold text-white capitalize leading-tight">
                            {data.title}
                        </h1>
                        <p className="text-emerald-200 mt-2 text-sm font-mono">/{data.slug}</p>
                    </div>
                    <span className={`text-sm font-semibold px-4 py-1.5 rounded-full capitalize ${data.status === "published"
                            ? "bg-white text-emerald-700"
                            : "bg-white/20 text-white"
                        }`}>
                        {data.status}
                    </span>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-6 py-12 space-y-10">
                {/* ── Product grid placeholder ── */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <span className="w-1.5 h-5 rounded-full bg-emerald-500 inline-block" />
                            Products
                        </h2>
                        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                            Connect your product query
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="aspect-square bg-gray-50 flex items-center justify-center text-3xl text-gray-200">
                                    🛍️
                                </div>
                                <div className="p-4 space-y-2">
                                    <div className="h-3.5 bg-gray-100 rounded-lg w-4/5 animate-pulse" />
                                    <div className="h-3 bg-gray-100 rounded-lg w-2/5 animate-pulse" />
                                    <div className="h-5 bg-emerald-50 rounded-lg w-3/5 animate-pulse mt-1" />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── SEO panel ── */}
                {(seoTitle || seoDesc || seoKw) && (
                    <section className="bg-white rounded-2xl border border-gray-200 p-7 space-y-5">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                            SEO Meta
                        </h2>
                        {seoTitle && (
                            <div>
                                <p className="text-xs text-gray-400 font-semibold mb-1">Title</p>
                                <p className="text-sm text-gray-800 font-medium">{seoTitle}</p>
                            </div>
                        )}
                        {seoDesc && (
                            <div>
                                <p className="text-xs text-gray-400 font-semibold mb-1">Description</p>
                                <p className="text-sm text-gray-600 leading-relaxed">{seoDesc}</p>
                            </div>
                        )}
                        {seoKw && (
                            <div>
                                <p className="text-xs text-gray-400 font-semibold mb-2">Keywords</p>
                                <div className="flex flex-wrap gap-2">
                                    {seoKw.split(",").map((kw) => kw.trim()).filter(Boolean).map((kw) => (
                                        <span key={kw} className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
                                            {kw}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* ── Extra plugin fields ── */}
                {extraInfo.length > 0 && (
                    <section className="bg-white rounded-2xl border border-gray-200 p-7">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-5">Plugin Fields</h2>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {extraInfo.map(([key, value]) => (
                                <div key={key} className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                                    <dt className="text-xs font-mono text-emerald-500 uppercase tracking-wide mb-1">
                                        {key.replace(/_/g, " ")}
                                    </dt>
                                    <dd className="text-sm text-gray-700 break-all">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                )}
            </div>
        </main>
    );
}
