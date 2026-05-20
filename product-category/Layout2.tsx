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
 * Product category template — Layout 2
 * Dark storefront: sticky sidebar with category info, masonry-style product grid.
 */
export default function ProductCategoryLayout2({ data }: ProductCatProps) {
    const seoTitle = data.info?.seo_meta_title || "";
    const seoDesc = data.info?.seo_meta_description || "";
    const seoKw = data.info?.seo_meta_keyword || "";

    const knownKeys = new Set(["seo_meta_title", "seo_meta_description", "seo_meta_keyword"]);
    const extraInfo = Object.entries(data.info || {}).filter(([k]) => !knownKeys.has(k));

    return (
        <main className="min-h-screen bg-[#0a0c10] text-gray-100">
            <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10">

                {/* ── Sidebar ── */}
                <aside className="space-y-5">
                    {/* Category card */}
                    <div className="bg-linear-to-br from-emerald-600 to-teal-700 rounded-3xl p-7 text-center shadow-xl shadow-emerald-900/30">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/15 mb-5 text-3xl">
                            🗂️
                        </div>
                        <h1 className="text-2xl font-extrabold text-white capitalize leading-tight mb-2">
                            {data.title}
                        </h1>
                        <p className="text-emerald-200 text-xs font-mono mb-4">/{data.slug}</p>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${data.status === "published"
                                ? "bg-white/20 text-white"
                                : "bg-amber-400/20 text-amber-300"
                            }`}>
                            {data.status}
                        </span>
                    </div>

                    {/* Filter placeholder */}
                    <div className="bg-white/3 border border-white/5 rounded-2xl p-5 space-y-3">
                        <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-widest">Filters</h3>
                        {["Price Range", "Condition", "In Stock Only"].map((f) => (
                            <div key={f} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                                <div className="w-4 h-4 rounded bg-white/5 border border-white/10 shrink-0" />
                                <span className="text-sm text-gray-400">{f}</span>
                            </div>
                        ))}
                        <p className="text-xs text-gray-600 italic pt-1">Connect filter logic to activate.</p>
                    </div>

                    {/* SEO panel */}
                    {(seoTitle || seoDesc || seoKw) && (
                        <div className="bg-white/3 border border-white/5 rounded-2xl p-5 space-y-4">
                            <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-widest">SEO</h3>
                            {seoTitle && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Title</p>
                                    <p className="text-sm text-gray-200 font-medium leading-snug">{seoTitle}</p>
                                </div>
                            )}
                            {seoDesc && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Description</p>
                                    <p className="text-sm text-gray-400 leading-relaxed">{seoDesc}</p>
                                </div>
                            )}
                            {seoKw && (
                                <div>
                                    <p className="text-xs text-gray-500 mb-2">Keywords</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {seoKw.split(",").map((kw) => kw.trim()).filter(Boolean).map((kw) => (
                                            <span key={kw} className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                                                {kw}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Extra plugin fields */}
                    {extraInfo.length > 0 && (
                        <div className="bg-white/3 border border-white/5 rounded-2xl p-5 space-y-3">
                            <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-2">
                                Plugin Fields
                            </h3>
                            {extraInfo.map(([key, value]) => (
                                <div key={key} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
                                    <p className="text-xs font-mono text-gray-500 uppercase tracking-wide mb-0.5">
                                        {key.replace(/_/g, " ")}
                                    </p>
                                    <p className="text-sm text-gray-300 break-all">{value}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </aside>

                {/* ── Product grid ── */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h2 className="text-xl font-bold text-white">
                            <span className="text-emerald-400 capitalize">{data.title}</span> Products
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 bg-white/5 px-3 py-1.5 rounded-full">
                                Sort: Featured
                            </span>
                            <span className="text-xs text-gray-600 font-mono">Layout 2</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="bg-white/3 border border-white/5 rounded-2xl overflow-hidden hover:border-emerald-500/30 transition group">
                                {/* Image */}
                                <div className="aspect-square bg-white/3 flex items-center justify-center text-4xl group-hover:bg-white/5 transition">
                                    🛍️
                                </div>
                                {/* Info */}
                                <div className="p-4 space-y-2">
                                    <div className="h-3.5 bg-white/5 rounded-lg w-4/5 group-hover:bg-white/10 transition" />
                                    <div className="h-3 bg-white/5 rounded-lg w-2/5 group-hover:bg-white/10 transition" />
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="h-5 bg-emerald-500/15 rounded-lg w-2/5" />
                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 text-sm">
                                            +
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-gray-600 text-center italic">
                        Connect your product query to populate this grid.
                    </p>
                </section>
            </div>
        </main>
    );
}
