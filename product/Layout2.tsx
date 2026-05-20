interface ProductPageProps {
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
 * Product template — Layout 2
 * Dark storefront style: full-width dark hero, floating spec cards, neon accents.
 */
export default function ProductLayout2({ data }: ProductPageProps) {
    const price = data.info?.product_price || "";
    const sku = data.info?.product_sku || "";
    const stock = data.info?.product_stock || "";
    const inStock = data.info?.product_in_stock !== "false";
    const condition = data.info?.product_condition || "";
    const seoTitle = data.info?.seo_meta_title || "";
    const seoDesc = data.info?.seo_meta_description || "";
    const seoKw = data.info?.seo_meta_keyword || "";

    const knownKeys = new Set([
        "product_price", "product_sku", "product_stock",
        "product_in_stock", "product_condition",
        "seo_meta_title", "seo_meta_description", "seo_meta_keyword",
    ]);
    const extraInfo = Object.entries(data.info || {}).filter(([k]) => !knownKeys.has(k));

    const specs = [
        { label: "Price", value: price, icon: "💰" },
        { label: "SKU", value: sku, icon: "🏷️" },
        { label: "Stock", value: stock ? `${stock} units` : "", icon: "📦" },
        { label: "Condition", value: condition, icon: "✨" },
    ].filter((s) => s.value);

    return (
        <main className="min-h-screen bg-[#0a0c10]">
            {/* ── Hero ── */}
            <header className="relative overflow-hidden border-b border-white/5">
                {/* Glow blobs */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
                    <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl" />
                </div>

                <div className="relative max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    {/* Image placeholder */}
                    <div className="aspect-square rounded-3xl bg-white/3 border border-white/5 flex items-center justify-center">
                        <div className="text-center text-gray-600 space-y-3">
                            <div className="text-6xl">🛍️</div>
                            <p className="text-sm italic">Product image placeholder</p>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="space-y-6">
                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${inStock
                                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                    : "bg-red-500/15 text-red-400 border-red-500/30"
                                }`}>
                                {inStock ? "● In Stock" : "● Out of Stock"}
                            </span>
                            {condition && (
                                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10 capitalize">
                                    {condition}
                                </span>
                            )}
                        </div>

                        {/* Title */}
                        <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight">
                            {data.title}
                        </h1>

                        {/* Price */}
                        {price && (
                            <div className="inline-flex items-baseline gap-1">
                                <span className="text-5xl font-black text-emerald-400 tabular-nums">
                                    {price}
                                </span>
                            </div>
                        )}

                        {/* SKU */}
                        {sku && (
                            <p className="text-sm text-gray-500">
                                SKU: <span className="font-mono text-gray-300">{sku}</span>
                            </p>
                        )}

                        {/* Description placeholder */}
                        <div className="bg-white/3 border border-white/5 rounded-2xl p-5 text-sm text-gray-500 italic">
                            Product description renders here. Connect your body field to replace this placeholder.
                        </div>

                        {/* CTA */}
                        <div className="flex gap-3 flex-wrap">
                            <button
                                disabled={!inStock}
                                className="flex-1 sm:flex-none px-8 py-4 rounded-2xl text-base font-bold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-lg shadow-emerald-900/50"
                            >
                                {inStock ? "Add to Cart" : "Out of Stock"}
                            </button>
                            <button className="px-8 py-4 rounded-2xl text-base font-bold text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition">
                                Wishlist
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Spec cards ── */}
            {specs.length > 0 && (
                <div className="max-w-6xl mx-auto px-6 py-10">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {specs.map((s) => (
                            <div key={s.label} className="bg-white/3 border border-white/5 rounded-2xl p-5 text-center hover:border-emerald-500/30 transition">
                                <div className="text-3xl mb-2">{s.icon}</div>
                                <p className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-1">{s.label}</p>
                                <p className="text-sm font-bold text-white capitalize">{s.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── SEO + extra fields ── */}
            <div className="max-w-6xl mx-auto px-6 pb-14 space-y-6">
                {(seoTitle || seoDesc || seoKw) && (
                    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {seoTitle && (
                            <div className="bg-white/3 border border-white/5 rounded-2xl p-5 hover:border-emerald-500/20 transition">
                                <p className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-2">SEO Title</p>
                                <p className="text-sm text-gray-200 font-medium">{seoTitle}</p>
                            </div>
                        )}
                        {seoDesc && (
                            <div className="bg-white/3 border border-white/5 rounded-2xl p-5 sm:col-span-2 hover:border-emerald-500/20 transition">
                                <p className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-2">Meta Description</p>
                                <p className="text-sm text-gray-300 leading-relaxed">{seoDesc}</p>
                            </div>
                        )}
                        {seoKw && (
                            <div className="bg-white/3 border border-white/5 rounded-2xl p-5 sm:col-span-3 hover:border-emerald-500/20 transition">
                                <p className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-3">Keywords</p>
                                <div className="flex flex-wrap gap-2">
                                    {seoKw.split(",").map((kw) => kw.trim()).filter(Boolean).map((kw) => (
                                        <span key={kw} className="text-xs px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                                            {kw}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {extraInfo.length > 0 && (
                    <section>
                        <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-4">Plugin Fields</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {extraInfo.map(([key, value]) => (
                                <div key={key} className="bg-white/3 border border-white/5 rounded-xl px-5 py-4 hover:border-emerald-500/20 transition">
                                    <p className="text-xs font-mono text-emerald-400 uppercase tracking-wide mb-1">
                                        {key.replace(/_/g, " ")}
                                    </p>
                                    <p className="text-sm text-gray-200 break-all">{value}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
