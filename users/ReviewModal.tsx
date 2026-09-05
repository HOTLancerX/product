"use client";

import { useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";

export interface ReviewItemData {
    productId: string;
    productTitle: string;
    productImage?: string;
    productSlug?: string;
    uploadedBy?: string; // Seller ID
    orderNumber: string;
    orderId?: string;
    variantOptions?: Record<string, string>;
}

interface ReviewModalProps {
    item: ReviewItemData;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newReview: any) => void;
    user: {
        _id: string;
        name: string;
        image?: string;
    };
}

// Rating-specific suggested texts (auto-suggestions)
const RATING_SUGGESTIONS: Record<number, string[]> = {
    5: [
        "Outstanding product quality! 🔥",
        "Super fast and secure delivery! ⚡",
        "Exactly as described, loved it! ❤️",
        "Worth every penny, highly recommended! 💯",
        "Excellent packaging and great service! ✨",
        "Will definitely order again soon! 👍",
    ],
    4: [
        "Good quality product and timely delivery. 👍",
        "Very satisfied with this purchase.",
        "Matches the pictures and description.",
        "Great value for money.",
        "Well packaged and arrived in good condition.",
    ],
    3: [
        "Decent product for the price.",
        "Average quality, meets basic expectations.",
        "Delivery took longer than expected.",
        "Good product but has minor flaws.",
    ],
    2: [
        "Product quality is below expectations.",
        "Item looks different from the description.",
        "Late delivery and poor packaging.",
        "Not very satisfied with the material.",
    ],
    1: [
        "Very disappointed with this purchase.",
        "Item arrived damaged or defective.",
        "Completely different from product description.",
        "Poor build quality and slow shipping.",
    ],
};

// Feature tags that can be clicked to quickly build review feedback
const QUICK_TAGS = [
    { label: "High Quality", icon: "solar:crown-bold", text: "Top-notch build quality." },
    { label: "Fast Shipping", icon: "solar:delivery-bold", text: "Delivered very quickly." },
    { label: "Accurate Sizing", icon: "solar:ruler-bold", text: "Fit and dimensions are accurate." },
    { label: "Value for Money", icon: "solar:tag-price-bold", text: "Exceptional value for the price." },
    { label: "Great Packaging", icon: "solar:box-bold", text: "Secure and neat packaging." },
    { label: "Friendly Seller", icon: "solar:user-hand-up-bold", text: "Great customer service from seller." },
];

const RATING_LABELS: Record<number, string> = {
    1: "Very Poor",
    2: "Poor",
    3: "Average",
    4: "Good",
    5: "Excellent!",
};

export default function ReviewModal({ item, isOpen, onClose, onSuccess, user }: ReviewModalProps) {
    const [rating, setRating] = useState<number>(5);
    const [hoverRating, setHoverRating] = useState<number>(0);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [selectedChips, setSelectedChips] = useState<string[]>([]);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [imageInput, setImageInput] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    if (!isOpen) return null;

    // Handle suggestion chip click: adds/toggles text into textarea
    const handleChipClick = (suggestionText: string) => {
        const isSelected = selectedChips.includes(suggestionText);
        if (isSelected) {
            // Remove selection state
            setSelectedChips((prev) => prev.filter((t) => t !== suggestionText));
        } else {
            setSelectedChips((prev) => [...prev, suggestionText]);
            // Add suggested text to content textarea with smart formatting
            setContent((prev) => {
                const trimmed = prev.trim();
                if (!trimmed) {
                    return suggestionText;
                }
                // If text ends with punctuation, add space; otherwise add period and space
                const endsWithPunct = /[.!?]$/.test(trimmed);
                return `${trimmed}${endsWithPunct ? " " : ". "}${suggestionText}`;
            });
        }
    };

    const handleAddImage = () => {
        if (!imageInput.trim()) return;
        if (imageUrls.length >= 4) {
            setErrorMsg("You can attach up to 4 photos.");
            return;
        }
        setImageUrls((prev) => [...prev, imageInput.trim()]);
        setImageInput("");
        setErrorMsg("");
    };

    const handleRemoveImage = (index: number) => {
        setImageUrls((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) {
            setErrorMsg("Please write some feedback for your review.");
            return;
        }
        if (rating < 1 || rating > 5) {
            setErrorMsg("Please select a star rating (1 to 5).");
            return;
        }

        setSubmitting(true);
        setErrorMsg("");

        try {
            const res = await fetch("/api/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetType: "product",
                    targetId: item.productId,
                    ownerId: item.uploadedBy || "",
                    userId: user._id,
                    userName: user.name || "Customer",
                    userImage: user.image || "",
                    rating,
                    title: title.trim(),
                    content: content.trim(),
                    images: imageUrls,
                    orderNumber: item.orderNumber,
                    orderId: item.orderId || "",
                    verifiedPurchase: true,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setErrorMsg(data.error || "Failed to submit review. Please try again.");
            } else {
                onSuccess(data.data);
                onClose();
            }
        } catch {
            setErrorMsg("Network error. Please check your connection and try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const currentRating = hoverRating || rating;
    const activeSuggestions = RATING_SUGGESTIONS[rating] || RATING_SUGGESTIONS[5];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={(e) => {
                if (e.target === e.currentTarget && !submitting) onClose();
            }}
        >
            <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="relative px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
                            <Icon icon="solar:star-bold" width={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-gray-900">Write a Product Review</h2>
                            <p className="text-xs text-gray-400 font-mono">Order #{item.orderNumber}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition"
                    >
                        <Icon icon="solar:close-circle-bold" width={18} />
                    </button>
                </div>

                {/* Product Summary */}
                <div className="flex items-center gap-3 px-6 py-3 bg-gray-50/80 border-b border-gray-100">
                    <div className="relative w-12 h-12 rounded-xl bg-white border border-gray-200 overflow-hidden shrink-0">
                        {item.productImage ? (
                            <Image src={item.productImage} alt={item.productTitle} fill className="object-cover" sizes="48px" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <Icon icon="solar:box-bold" width={20} />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800 line-clamp-1">{item.productTitle}</p>
                        {item.variantOptions && Object.keys(item.variantOptions).length > 0 && (
                            <p className="text-[11px] text-gray-400 mt-0.5">
                                {Object.entries(item.variantOptions).map(([k, v]) => `${k}: ${v}`).join(", ")}
                            </p>
                        )}
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        <Icon icon="solar:check-circle-bold" width={12} />
                        Verified Purchase
                    </span>
                </div>

                {/* Review Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Star Rating Selector */}
                    <div className="text-center bg-linear-to-b from-amber-50/40 to-transparent p-4 rounded-2xl border border-amber-100/60">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Overall Rating</p>
                        <div className="flex items-center justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => {
                                const isFilled = star <= currentRating;
                                return (
                                    <button
                                        key={star}
                                        type="button"
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        onClick={() => {
                                            setRating(star);
                                            setSelectedChips([]);
                                        }}
                                        className="p-1 text-3xl transition-transform hover:scale-125 focus:outline-none"
                                    >
                                        <Icon
                                            icon={isFilled ? "solar:star-bold" : "solar:star-outline"}
                                            className={isFilled ? "text-amber-400 drop-shadow-sm" : "text-gray-300"}
                                            width={34}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-sm font-black text-amber-600 mt-1.5 min-h-5">
                            {RATING_LABELS[currentRating] || ""}
                        </p>
                    </div>

                    {/* Auto-suggested text chips (Click to add) */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                                <Icon icon="solar:magic-stick-3-bold" width={14} className="text-indigo-500" />
                                Suggested Feedback <span className="text-[10px] font-normal text-gray-400">(Click to auto-insert)</span>
                            </label>
                            {selectedChips.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedChips([])}
                                    className="text-[11px] text-gray-400 hover:text-gray-600"
                                >
                                    Reset chips
                                </button>
                            )}
                        </div>

                        {/* Rating-specific suggestion tags */}
                        <div className="flex flex-wrap gap-1.5">
                            {activeSuggestions.map((suggestion) => {
                                const isSelected = selectedChips.includes(suggestion);
                                return (
                                    <button
                                        key={suggestion}
                                        type="button"
                                        onClick={() => handleChipClick(suggestion)}
                                        className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-xl border transition-all duration-150 text-left ${
                                            isSelected
                                                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs scale-98"
                                                : "bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                                        }`}
                                    >
                                        <Icon
                                            icon={isSelected ? "solar:check-circle-bold" : "solar:add-circle-bold"}
                                            width={13}
                                            className={isSelected ? "text-white" : "text-indigo-500"}
                                        />
                                        {suggestion}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Quick Feature Tags */}
                        <div className="flex flex-wrap gap-1 pt-1">
                            {QUICK_TAGS.map((tag) => (
                                <button
                                    key={tag.label}
                                    type="button"
                                    onClick={() => handleChipClick(tag.text)}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition"
                                >
                                    <Icon icon={tag.icon} width={11} className="text-gray-400" />
                                    {tag.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Review Title (Optional) */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Review Title <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Great quality and fast shipping!"
                            maxLength={100}
                            className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                        />
                    </div>

                    {/* Review Content */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-bold text-gray-700">
                                Your Detailed Review <span className="text-red-500">*</span>
                            </label>
                            <span className="text-[11px] text-gray-400">{content.length} characters</span>
                        </div>
                        <textarea
                            rows={4}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Describe your experience with the product, fit, material quality, and packaging..."
                            required
                            className="w-full text-sm border border-gray-200 rounded-2xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition leading-relaxed"
                        />
                    </div>

                    {/* Photo Attachments (URL input & thumbnails) */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">
                            Add Photos <span className="text-gray-400 font-normal">(optional, up to 4)</span>
                        </label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="url"
                                value={imageInput}
                                onChange={(e) => setImageInput(e.target.value)}
                                placeholder="Paste image URL (https://...)"
                                className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                            <button
                                type="button"
                                onClick={handleAddImage}
                                disabled={!imageInput.trim() || imageUrls.length >= 4}
                                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl disabled:opacity-40 transition shrink-0"
                            >
                                Add Photo
                            </button>
                        </div>

                        {imageUrls.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                                {imageUrls.map((url, i) => (
                                    <div key={i} className="relative w-16 h-16 rounded-xl border border-gray-200 overflow-hidden group">
                                        <img src={url} alt="Review attachment" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveImage(i)}
                                            className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] opacity-90 hover:opacity-100"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Error Banner */}
                    {errorMsg && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-semibold text-red-600">
                            <Icon icon="solar:danger-triangle-bold" width={16} className="shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Note about moderation */}
                    <div className="flex items-start gap-2 text-[11px] text-gray-500 bg-amber-50/60 border border-amber-100 p-3 rounded-2xl">
                        <Icon icon="solar:info-circle-bold" width={15} className="text-amber-600 shrink-0 mt-0.5" />
                        <span>Reviews are approved by store moderators before appearing publicly on the product page.</span>
                    </div>

                    {/* Form Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-2xl transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !content.trim()}
                            className="flex-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-2xl shadow-sm shadow-indigo-200 disabled:opacity-50 transition flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <Icon icon="svg-spinners:ring-resize" width={16} />
                                    Submitting Review...
                                </>
                            ) : (
                                <>
                                    <Icon icon="solar:check-read-bold" width={16} />
                                    Submit Review
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
