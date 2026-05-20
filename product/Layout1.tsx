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
 * Product template — Layout 1
 * Clean e-commerce style: product hero left / purchase panel right, info tabs below.
 */
export default function ProductLayout1({ data }: ProductPageProps) {
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

    const conditionColors: Record<string, string> = {
        new: "bg-emerald-50 text-emerald-700 border-emerald-200",
        used: "bg-amber-50 text-amber-700 border-amber-200",
        refurbished: "bg-sky-50 text-sky-700 border-sky-200",
    };

    return (
        <main className="min-h-screen bg-gray-50">
            {/* ── Breadcrumb ── */}
            <div className="bg-white border-b border-gray-100 px-6 py-3">
                <div className="max-w-6xl mx-auto flex items-center gap-2 text-xs text-gray-400">
                    <span>Home</span>
                    <span>/</span>
                    <span>Products</span>
                    <span>/</span>
                    <span className="text-gray-700 font-medium">{data.title}</span>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-12">
                {/* ── Product hero ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
                    {/* Image placeholder */}
                    <div className="bg-white rounded-3xl border border-gray-200 aspect-square flex items-center justify-center shadow-sm">
                        <div className="text-center text-gray-300 space-y-3">
                            <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-sm italic">Product image placeholder</p>
                        </div>
                    </div>

                    {/* Purchase panel */}
                    <div className="flex flex-col justify-center space-y-6">
                        {/* Status badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${inStock
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-red-50 text-red-600 border-red-200"
                                }`}>
                                {inStock ? "In Stock" : "Out of Stock"}
                            </span>
                            {condition && (
                                <span className={`text-xs font-semibold px-3 py-1 rounded-full border capitalize ${conditionColors[condition] ?? "bg-gray-50 text-gray-600 border-gray-200"
                                    }`}>
                                    {condition}
                                </span>
                            )}
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${data.status === "published"
                                    ? "bg-blue-50 text-blue-600 border border-blue-200"
                                    : "bg-amber-50 text-amber-600 border border-amber-200"
                                }`}>
                                {data.status}
                            </span>
                        </div>

                        {/* Title */}
                        <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">
                            {data.title}
                        </h1>

                        {/* Price */}
                        {price && (
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-emerald-600">{price}</span>
                            </div>
                        )}

                        {/* SKU / Stock row */}
                        <div className="flex items-center gap-6 text-sm text-gray-500 flex-wrap">
                            {sku && (
                                <span>
                                    SKU: <span className="font-mono font-semibold text-gray-700">{sku}</span>
                                </span>
                            )}
                            {stock && (
                                <span>
                                    Stock: <span className="font-semibold text-gray-700">{stock} units</span>
                                </span>
                            )}
                        </div>

                        {/* Description placeholder */}
                        <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-400 italic">
                            Product description renders here. Connect your body field to replace this placeholder.
                        </div>

                        {/* CTA */}
                        <button
                            disabled={!inStock}
                            className="w-full sm:w-auto px-10 py-4 rounded-2xl text-base font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-emerald-200"
                        >
                            {inStock ? "Add to Cart" : "Out of Stock"}
                        </button>
                    </div>
                </div>

                {/* ── Info grid ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Product details */}
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-7 space-y-4">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-1.5 h-4 rounded-full bg-emerald-500 inline-block" />
                            Product Details
                        </h2>
                        <dl className="divide-y divide-gray-100">
                            {[
                                ["Price", price],
                                ["SKU", sku],
                                ["Stock", stock ? `${stock} units` : ""],
                                ["Condition", condition],
                            ].filter(([, v]) => v).map(([label, value]) => (
                                <div key={label} className="flex justify-between py-3 text-sm">
                                    <dt className="text-gray-400">{label}</dt>
                                    <dd className="font-semibold text-gray-800 capitalize">{value}</dd>
                                </div>
                            ))}
                        </dl>

                        {/* Extra plugin fields */}
                        {extraInfo.length > 0 && (
                            <>
                                <div className="pt-2 border-t border-gray-100">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                                        Additional Fields
                                    </p>
                                    <dl className="divide-y divide-gray-100">
                                        {extraInfo.map(([key, value]) => (
                                            <div key={key} className="flex justify-between py-3 text-sm">
                                                <dt className="font-mono text-xs text-emerald-500 uppercase tracking-wide">
                                                    {key.replace(/_/g, " ")}
                                                </dt>
                                                <dd className="text-gray-700 break-all">{value}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                            </>
                        )}
                    </div>

                    {/* SEO card */}
                    {(seoTitle || seoDesc || seoKw) && (
                        <div className="bg-white rounded-2xl border border-emerald-100 p-6 space-y-4">
                            <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                </svg>
                                SEO
                            </h3>
                            {seoTitle && (
                                <div>
                                    <p className="text-xs text-emerald-400 font-semibold mb-1">Title</p>
                                    <p className="text-sm text-gray-800 font-medium leading-snug">{seoTitle}</p>
                                </div>
                            )}
                            {seoDesc && (
                                <div>
                                    <p className="text-xs text-emerald-400 font-semibold mb-1">Description</p>
                                    <p className="text-sm text-gray-600 leading-relaxed">{seoDesc}</p>
                                </div>
                            )}
                            {seoKw && (
                                <div>
                                    <p className="text-xs text-emerald-400 font-semibold mb-2">Keywords</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {seoKw.split(",").map((kw) => kw.trim()).filter(Boolean).map((kw) => (
                                            <span key={kw} className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
                                                {kw}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
