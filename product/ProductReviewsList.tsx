/**
 * ProductReviewsList.tsx — Server-side rendered product reviews list.
 *
 * Renders approved customer reviews, overall rating score, star rating
 * distribution breakdown, and seller/admin replies.
 */

import { Icon } from "@iconify/react";

export interface ReviewItemData {
    _id: string;
    userName: string;
    userImage?: string;
    rating: number;
    title?: string;
    content: string;
    images?: string[];
    orderNumber?: string;
    verifiedPurchase?: boolean;
    reply?: {
        content: string;
        authorName?: string;
        authorRole?: string;
        createdAt?: string;
    } | null;
    createdAt: string;
}

export interface ReviewsData {
    reviews: ReviewItemData[];
    averageRating: number;
    totalReviews: number;
    distribution: Record<number, number>;
}

interface ProductReviewsListProps {
    reviewsData?: ReviewsData | null;
    theme?: "light" | "dark";
}

function fmtDate(iso: string) {
    if (!iso) return "";
    try {
        return new Date(iso).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    } catch {
        return iso;
    }
}

export default function ProductReviewsList({ reviewsData }: ProductReviewsListProps) {
    const reviews = reviewsData?.reviews ?? [];
    const averageRating = reviewsData?.averageRating ?? 0;
    const totalReviews = reviewsData?.totalReviews ?? reviews.length;
    const distribution = reviewsData?.distribution ?? { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    return (
        <section
            id="customer-reviews"
            className="rounded-3xl border border-gray-100 shadow-xs bg-white text-black p-5 md:p-8 space-y-8 transition-all"
        >
            {/* ── Section Title ── */}
            <div className="flex items-center justify-between gap-4 flex-wrap border-b pb-5 border-gray-100">
                <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-2xl flex items-center justify-center bg-amber-50 text-amber-500">
                        <Icon icon="solar:star-bold" width={22} />
                    </span>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-black">Customer Reviews</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Verified feedback from buyers who purchased this item
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-gray-100 text-gray-700">
                        {totalReviews} {totalReviews === 1 ? "Review" : "Reviews"}
                    </span>
                </div>
            </div>

            {/* ── Rating Summary & Breakdown Grid ── */}
            {totalReviews > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 rounded-2xl border bg-linear-to-b from-amber-50/30 to-gray-50/50 border-gray-100 text-black">
                    {/* Overall Score Box (col-span 4) */}
                    <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-4 border-b md:border-b-0 md:border-r border-gray-200/60">
                        <span className="text-5xl md:text-6xl font-black tracking-tight text-amber-500 drop-shadow-xs">
                            {averageRating.toFixed(1)}
                        </span>
                        <div className="flex items-center gap-1 my-2 text-amber-400">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Icon
                                    key={star}
                                    icon={star <= Math.round(averageRating) ? "solar:star-bold" : "solar:star-outline"}
                                    width={22}
                                    className={star <= Math.round(averageRating) ? "text-amber-400" : "text-gray-300"}
                                />
                            ))}
                        </div>
                        <p className="text-xs font-semibold text-gray-500">
                            Based on {totalReviews} verified {totalReviews === 1 ? "review" : "reviews"}
                        </p>
                    </div>

                    {/* Star Distribution Bars (col-span 8) */}
                    <div className="md:col-span-8 flex flex-col justify-center space-y-2.5 px-2">
                        {[5, 4, 3, 2, 1].map((starKey) => {
                            const count = distribution[starKey] || 0;
                            const percentage = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;

                            return (
                                <div key={starKey} className="flex items-center gap-3 text-xs">
                                    <span className="w-12 font-bold flex items-center gap-1 shrink-0 text-black">
                                        {starKey} <Icon icon="solar:star-bold" width={13} className="text-amber-400" />
                                    </span>

                                    {/* Progress Track */}
                                    <div className="flex-1 h-3 rounded-full overflow-hidden bg-gray-200">
                                        <div
                                            className="h-full rounded-full bg-linear-to-r from-amber-400 to-amber-500 transition-all duration-500"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>

                                    <span className="w-14 text-right font-semibold shrink-0 text-[11px] text-gray-500">
                                        {count} ({percentage}%)
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : null}

            {/* ── Reviews List ── */}
            {totalReviews === 0 ? (
                <div className="py-16 text-center rounded-3xl border border-dashed border-gray-200 bg-gray-50/50 p-6">
                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-3 bg-amber-50 text-amber-500">
                        <Icon icon="solar:star-outline" width={32} />
                    </div>
                    <h3 className="text-base font-bold text-black">No customer reviews yet</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                        Be the first to review this product after placing your order! You can submit reviews directly from your order dashboard.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {reviews.map((rev) => (
                        <article
                            key={rev._id}
                            className="p-5 md:p-6 rounded-3xl border border-gray-100 hover:border-gray-200 shadow-xs bg-white text-black space-y-3.5 transition-all"
                        >
                            {/* Reviewer Header */}
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-3">
                                    {rev.userImage ? (
                                        <img
                                            src={rev.userImage}
                                            alt={rev.userName}
                                            className="w-10 h-10 rounded-2xl object-cover border border-gray-200 shrink-0"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-2xl font-black text-sm flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-700">
                                            {rev.userName?.charAt(0).toUpperCase()}
                                        </div>
                                    )}

                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="text-sm font-bold text-black">{rev.userName}</h4>
                                            {rev.verifiedPurchase && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <Icon icon="solar:check-circle-bold" width={11} />
                                                    Verified Buyer
                                                </span>
                                            )}
                                        </div>
                                        <time
                                            dateTime={rev.createdAt}
                                            className="text-[11px] text-gray-400"
                                        >
                                            {fmtDate(rev.createdAt)}
                                        </time>
                                    </div>
                                </div>

                                {/* Star Rating */}
                                <div className="flex items-center gap-1 text-amber-400">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Icon
                                            key={star}
                                            icon={star <= rev.rating ? "solar:star-bold" : "solar:star-outline"}
                                            width={16}
                                            className={star <= rev.rating ? "text-amber-400" : "text-gray-200"}
                                        />
                                    ))}
                                    <span className="text-xs font-black ml-1 text-amber-500">
                                        {rev.rating}.0
                                    </span>
                                </div>
                            </div>

                            {/* Review Title & Body */}
                            <div className="space-y-1.5">
                                {rev.title && (
                                    <h5 className="text-sm font-black leading-snug text-black">{rev.title}</h5>
                                )}
                                <p className="text-sm leading-relaxed whitespace-pre-line text-gray-700">
                                    {rev.content}
                                </p>
                            </div>

                            {/* Customer Photos */}
                            {rev.images && rev.images.length > 0 && (
                                <div className="flex gap-2 flex-wrap pt-1">
                                    {rev.images.map((img, i) => (
                                        <a
                                            key={i}
                                            href={img}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="relative rounded-2xl overflow-hidden border border-gray-200 block hover:opacity-90 transition group"
                                            style={{ width: 72, height: 72 }}
                                        >
                                            <img
                                                src={img}
                                                alt="Customer review photo"
                                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                            />
                                        </a>
                                    ))}
                                </div>
                            )}

                            {/* Official Seller / Store Response */}
                            {rev.reply?.content && (
                                <div className="mt-4 p-4 rounded-2xl border bg-indigo-50/60 border-indigo-100 text-gray-800 space-y-1.5">
                                    <div className="flex items-center justify-between text-xs font-bold">
                                        <span className="flex items-center gap-1.5 text-indigo-700">
                                            <Icon icon="solar:chat-round-dots-bold" width={15} />
                                            Response from {rev.reply.authorName || (rev.reply.authorRole === "admin" ? "Store Admin" : "Seller")}
                                        </span>
                                        {rev.reply.createdAt && (
                                            <span className="text-[10px] font-normal text-gray-400">
                                                {fmtDate(rev.reply.createdAt)}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs leading-relaxed whitespace-pre-line pl-5 border-l-2 border-indigo-400/40 text-gray-700">
                                        {rev.reply.content}
                                    </p>
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
