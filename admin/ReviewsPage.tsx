"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";

interface ReviewItem {
    _id: string;
    targetType: string;
    targetId: string;
    ownerId?: string;
    userId: string;
    userName: string;
    userImage?: string;
    rating: number;
    title?: string;
    content: string;
    images?: string[];
    orderNumber?: string;
    verifiedPurchase?: boolean;
    status: "pending" | "approved" | "rejected";
    reply?: {
        content: string;
        createdAt?: string;
        authorName?: string;
        authorRole?: string;
    };
    product?: {
        _id: string;
        title: string;
        slug: string;
        image?: string;
    } | null;
    createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
    pending:  { label: "Pending Approval", bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",  icon: "solar:clock-circle-bold" },
    approved: { label: "Approved",         bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200",icon: "solar:check-circle-bold" },
    rejected: { label: "Rejected",         bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",    icon: "solar:close-circle-bold" },
};

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
}

export default function AdminReviewsPage() {
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("all");
    const [ratingFilter, setRatingFilter] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [averageRating, setAverageRating] = useState(0);
    const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });

    // Action dialogs
    const [replyModalReview, setReplyModalReview] = useState<ReviewItem | null>(null);
    const [replyText, setReplyText] = useState("");
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [actionMsg, setActionMsg] = useState("");

    const fetchReviews = useCallback(async () => {
        setLoading(true);
        try {
            const qs = new URLSearchParams({
                isAdmin: "true",
                targetType: "product",
                page: String(page),
                limit: "15",
            });
            if (statusFilter && statusFilter !== "all") qs.set("status", statusFilter);
            if (ratingFilter) qs.set("rating", ratingFilter);
            if (search.trim()) qs.set("search", search.trim());

            const res = await fetch(`/api/comments?${qs}`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();

            setReviews(data.data || []);
            setTotal(data.pagination?.total || 0);
            setTotalPages(data.pagination?.pages || 1);
            if (data.counts) setCounts(data.counts);
            if (data.averageRating !== undefined) setAverageRating(data.averageRating);
        } catch {
            /* silent */
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, ratingFilter, search]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    // Update status (Approve / Reject)
    const handleUpdateStatus = async (id: string, newStatus: "approved" | "rejected" | "pending") => {
        setProcessingId(id);
        setActionMsg("");
        try {
            const res = await fetch(`/api/comments?id=${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus, isAdmin: true }),
            });
            const data = await res.json();
            if (res.ok) {
                setActionMsg(`Review successfully ${newStatus}!`);
                setTimeout(() => setActionMsg(""), 4000);
                fetchReviews();
            } else {
                setActionMsg(`Error: ${data.error || "Failed to update review"}`);
            }
        } catch {
            setActionMsg("Network error.");
        } finally {
            setProcessingId(null);
        }
    };

    // Submit Reply
    const handleSubmitReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyModalReview || !replyText.trim()) return;

        setProcessingId(replyModalReview._id);
        setActionMsg("");
        try {
            const res = await fetch(`/api/comments?id=${replyModalReview._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    replyContent: replyText.trim(),
                    authorName: "Store Admin",
                    authorRole: "admin",
                    isAdmin: true,
                }),
            });
            if (res.ok) {
                setReplyModalReview(null);
                setReplyText("");
                setActionMsg("Reply posted successfully!");
                setTimeout(() => setActionMsg(""), 4000);
                fetchReviews();
            }
        } catch {
            setActionMsg("Network error.");
        } finally {
            setProcessingId(null);
        }
    };

    // Delete review
    const handleDeleteReview = async (id: string) => {
        if (!confirm("Are you sure you want to delete this review permanently?")) return;
        setProcessingId(id);
        try {
            const res = await fetch(`/api/comments?id=${id}&isAdmin=true`, {
                method: "DELETE",
                credentials: "include",
            });
            if (res.ok) {
                setActionMsg("Review deleted.");
                setTimeout(() => setActionMsg(""), 4000);
                fetchReviews();
            }
        } catch {
            /* silent */
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
                        <span className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                            <Icon icon="solar:star-bold" width={22} />
                        </span>
                        Product Reviews Management
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Moderate buyer feedback, approve reviews, and publish official store replies.
                    </p>
                </div>
            </div>

            {/* Alert banner */}
            {actionMsg && (
                <div
                    className={`p-4 rounded-2xl text-sm font-semibold flex items-center gap-2 border animate-in fade-in ${
                        actionMsg.startsWith("Error")
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                >
                    <Icon
                        icon={actionMsg.startsWith("Error") ? "solar:danger-triangle-bold" : "solar:check-circle-bold"}
                        width={18}
                    />
                    {actionMsg}
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Reviews</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{counts.all}</p>
                </div>

                <div className="bg-amber-50/70 p-5 rounded-3xl border border-amber-100 shadow-xs">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Pending</p>
                        {counts.pending > 0 && (
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                        )}
                    </div>
                    <p className="text-2xl font-black text-amber-800 mt-1">{counts.pending}</p>
                </div>

                <div className="bg-emerald-50/70 p-5 rounded-3xl border border-emerald-100 shadow-xs">
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Approved</p>
                    <p className="text-2xl font-black text-emerald-800 mt-1">{counts.approved}</p>
                </div>

                <div className="bg-red-50/70 p-5 rounded-3xl border border-red-100 shadow-xs">
                    <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Rejected</p>
                    <p className="text-2xl font-black text-red-800 mt-1">{counts.rejected}</p>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs col-span-2 md:col-span-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Avg Rating</p>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-2xl font-black text-gray-900">{averageRating.toFixed(1)}</span>
                        <Icon icon="solar:star-bold" width={18} className="text-amber-400" />
                    </div>
                </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {[
                            { key: "all", label: "All Reviews", count: counts.all },
                            { key: "pending", label: "Pending", count: counts.pending },
                            { key: "approved", label: "Approved", count: counts.approved },
                            { key: "rejected", label: "Rejected", count: counts.rejected },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => {
                                    setStatusFilter(tab.key);
                                    setPage(1);
                                }}
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
                                    statusFilter === tab.key
                                        ? "bg-gray-900 text-white shadow-xs"
                                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                }`}
                            >
                                {tab.label}
                                <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                        statusFilter === tab.key
                                            ? "bg-white/20 text-white"
                                            : "bg-gray-200 text-gray-700"
                                    }`}
                                >
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Star & Search Controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Rating Dropdown */}
                        <select
                            value={ratingFilter}
                            onChange={(e) => {
                                setRatingFilter(e.target.value);
                                setPage(1);
                            }}
                            className="text-xs font-bold border border-gray-200 rounded-2xl px-3 py-2 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">All Star Ratings</option>
                            <option value="5">⭐⭐⭐⭐⭐ (5 Stars)</option>
                            <option value="4">⭐⭐⭐⭐ (4 Stars)</option>
                            <option value="3">⭐⭐⭐ (3 Stars)</option>
                            <option value="2">⭐⭐ (2 Stars)</option>
                            <option value="1">⭐ (1 Star)</option>
                        </select>

                        {/* Search Input */}
                        <div className="relative min-w-56">
                            <Icon
                                icon="solar:magnifer-linear"
                                width={16}
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                                placeholder="Search reviewer, product, order..."
                                className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-2xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Reviews List */}
            {loading ? (
                <div className="bg-white rounded-3xl border border-gray-100 py-24 flex items-center justify-center text-gray-300">
                    <Icon icon="svg-spinners:ring-resize" width={36} />
                </div>
            ) : reviews.length === 0 ? (
                <div className="bg-white rounded-3xl border border-dashed border-gray-200 py-24 text-center">
                    <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-400 flex items-center justify-center mx-auto mb-3">
                        <Icon icon="solar:star-outline" width={32} />
                    </div>
                    <p className="text-base font-bold text-gray-700">No reviews found</p>
                    <p className="text-xs text-gray-400 mt-1">There are no reviews matching your current filters.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {reviews.map((rev) => {
                        const statusCfg = STATUS_CONFIG[rev.status] || STATUS_CONFIG.pending;
                        const isProcessing = processingId === rev._id;

                        return (
                            <div
                                key={rev._id}
                                className="bg-white rounded-3xl border border-gray-100 shadow-xs hover:shadow-md transition-all overflow-hidden p-6"
                            >
                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                                    {/* Left: Product & Review Content */}
                                    <div className="space-y-3.5 flex-1 min-w-0">
                                        {/* Product info banner */}
                                        <div className="flex items-center gap-3 bg-gray-50/80 px-3.5 py-2 rounded-2xl border border-gray-100 w-fit max-w-full">
                                            <div className="relative w-9 h-9 rounded-xl bg-white border border-gray-200 overflow-hidden shrink-0">
                                                {rev.product?.image ? (
                                                    <Image
                                                        src={rev.product.image}
                                                        alt={rev.product.title || "Product"}
                                                        fill
                                                        className="object-cover"
                                                        sizes="36px"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                        <Icon icon="solar:box-bold" width={16} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 pr-2">
                                                {rev.product?.slug ? (
                                                    <Link
                                                        href={`/product/${rev.product.slug}`}
                                                        target="_blank"
                                                        className="text-xs font-bold text-gray-900 hover:text-indigo-600 truncate block transition"
                                                    >
                                                        {rev.product.title || `Product (${rev.targetId})`}
                                                    </Link>
                                                ) : (
                                                    <span className="text-xs font-bold text-gray-800 truncate block">
                                                        {rev.product?.title || `Product (${rev.targetId})`}
                                                    </span>
                                                )}
                                                {rev.orderNumber && (
                                                    <span className="text-[10px] font-mono text-gray-400">
                                                        Order #{rev.orderNumber}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Reviewer Header */}
                                        <div className="flex items-center gap-3">
                                            {rev.userImage ? (
                                                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-200">
                                                    <Image src={rev.userImage} alt={rev.userName} fill className="object-cover" />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center">
                                                    {rev.userName?.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-gray-900">{rev.userName}</p>
                                                    {rev.verifiedPurchase && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                                            <Icon icon="solar:check-circle-bold" width={10} />
                                                            Verified Buyer
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-gray-400">{fmtDate(rev.createdAt)}</p>
                                            </div>
                                        </div>

                                        {/* Stars & Title */}
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center text-amber-400">
                                                {[...Array(5)].map((_, i) => (
                                                    <Icon
                                                        key={i}
                                                        icon={i < rev.rating ? "solar:star-bold" : "solar:star-outline"}
                                                        width={16}
                                                        className={i < rev.rating ? "text-amber-400" : "text-gray-200"}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-xs font-black text-gray-700">{rev.rating}.0</span>
                                            {rev.title && (
                                                <span className="text-xs font-bold text-gray-900 ml-1">
                                                    — {rev.title}
                                                </span>
                                            )}
                                        </div>

                                        {/* Review text */}
                                        <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed bg-gray-50/50 p-3.5 rounded-2xl border border-gray-100">
                                            {rev.content}
                                        </p>

                                        {/* Images */}
                                        {rev.images && rev.images.length > 0 && (
                                            <div className="flex gap-2 flex-wrap pt-1">
                                                {rev.images.map((img, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={img}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="relative w-16 h-16 rounded-xl border border-gray-200 overflow-hidden hover:opacity-90 transition block"
                                                    >
                                                        <img src={img} alt="attachment" className="w-full h-full object-cover" />
                                                    </a>
                                                ))}
                                            </div>
                                        )}

                                        {/* Existing Reply */}
                                        {rev.reply?.content && (
                                            <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 space-y-1">
                                                <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                                                    <span className="flex items-center gap-1.5">
                                                        <Icon icon="solar:chat-round-dots-bold" width={14} className="text-indigo-600" />
                                                        Official Response ({rev.reply.authorRole === "admin" ? "Admin" : "Seller"} — {rev.reply.authorName || "Store"})
                                                    </span>
                                                    {rev.reply.createdAt && (
                                                        <span className="text-[10px] text-indigo-400 font-normal">
                                                            {fmtDate(rev.reply.createdAt)}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-indigo-800 whitespace-pre-line pt-1 leading-relaxed">
                                                    {rev.reply.content}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: Actions & Status */}
                                    <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
                                        {/* Status Badge */}
                                        <span
                                            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-2xl border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                                        >
                                            <Icon icon={statusCfg.icon} width={13} />
                                            {statusCfg.label}
                                        </span>

                                        {/* Action buttons */}
                                        <div className="flex flex-wrap items-center gap-2 pt-1">
                                            {rev.status !== "approved" && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(rev._id, "approved")}
                                                    disabled={isProcessing}
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs shadow-emerald-200 disabled:opacity-50"
                                                >
                                                    <Icon icon="solar:check-circle-bold" width={14} />
                                                    Approve
                                                </button>
                                            )}

                                            {rev.status !== "rejected" && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(rev._id, "rejected")}
                                                    disabled={isProcessing}
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition disabled:opacity-50"
                                                >
                                                    <Icon icon="solar:close-circle-bold" width={14} />
                                                    Reject
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setReplyModalReview(rev);
                                                    setReplyText(rev.reply?.content || "");
                                                }}
                                                disabled={isProcessing}
                                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition"
                                            >
                                                <Icon icon="solar:chat-line-bold" width={14} />
                                                {rev.reply?.content ? "Edit Reply" : "Reply"}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleDeleteReview(rev._id)}
                                                disabled={isProcessing}
                                                className="p-2 rounded-2xl bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
                                                title="Delete Review"
                                            >
                                                <Icon icon="solar:trash-bin-trash-bold" width={15} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-400 font-semibold">
                        Showing page {page} of {totalPages} ({total} reviews)
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-4 py-2 rounded-2xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="px-4 py-2 rounded-2xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Reply Modal */}
            {replyModalReview && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setReplyModalReview(null);
                    }}
                >
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                <Icon icon="solar:chat-round-dots-bold" width={20} className="text-indigo-600" />
                                Reply to Review
                            </h3>
                            <button
                                onClick={() => setReplyModalReview(null)}
                                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Customer Review Quote */}
                        <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 text-xs text-gray-600 space-y-1">
                            <p className="font-bold text-gray-800">Review by {replyModalReview.userName}:</p>
                            <p className="italic line-clamp-3">"{replyModalReview.content}"</p>
                        </div>

                        {/* Reply Form */}
                        <form onSubmit={handleSubmitReply} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Official Response <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    rows={4}
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="Thank the customer or address their concerns professionally..."
                                    required
                                    className="w-full text-sm border border-gray-200 rounded-2xl p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none leading-relaxed"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setReplyModalReview(null)}
                                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-2xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!replyText.trim() || processingId === replyModalReview._id}
                                    className="flex-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-sm shadow-indigo-200 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
                                >
                                    <Icon icon="solar:plain-bold" width={15} />
                                    Post Public Reply
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
