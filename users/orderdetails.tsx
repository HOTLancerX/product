"use client";

/**
 * User account — Order Detail  (/account/orders/:id)
 * Read-only view: items, totals, address, payment proof, timeline, notes.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { useSession } from "next-auth/react";
import useSettings from "@/lib/useSettings";
import ReviewModal, { type ReviewItemData } from "./ReviewModal";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
    productId?: string;
    productSlug?: string;
    productTitle: string;
    productImage?: string;
    variantOptions?: Record<string, string>;
    sku?: string;
    price: number;
    quantity: number;
    subtotal: number;
    orderNote?: string;
    uploadedBy?: string;
}

interface Order {
    _id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    paymentGatewayType?: string;
    paymentProof?: { transactionId?: string; paymentInfo?: string; proofImage?: string };
    items: OrderItem[];
    shippingAddress: {
        name: string; phone: string; email: string;
        address: string; state: string; city: string; zipCode?: string;
    };
    shippingMethod: string;
    shippingCost: number;
    subtotal: number;
    total: number;
    notes?: string;
    timeline: { status: string; note: string; createdByName: string; createdAt: string }[];
    createdAt: string;
}

// ── Visual config ─────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; icon: string; bg: string; text: string; border: string; bar: string; ring: string }> = {
    pending:    { label: "Pending",    icon: "solar:clock-circle-bold",   bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",  bar: "bg-amber-400",   ring: "ring-amber-400/30"   },
    processing: { label: "Processing", icon: "solar:refresh-circle-bold", bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",   bar: "bg-blue-500",    ring: "ring-blue-400/30"    },
    shipped:    { label: "Shipped",    icon: "solar:delivery-bold",       bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200", bar: "bg-violet-500",  ring: "ring-violet-400/30"  },
    delivered:  { label: "Delivered",  icon: "solar:check-circle-bold",   bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200",bar: "bg-emerald-500", ring: "ring-emerald-400/30" },
    cancelled:  { label: "Cancelled",  icon: "solar:close-circle-bold",   bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",    bar: "bg-red-400",     ring: "ring-red-400/30"     },
    paid:       { label: "Paid",       icon: "solar:check-circle-bold",   bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200",bar: "bg-emerald-500", ring: "ring-emerald-400/30" },
    failed:     { label: "Failed",     icon: "solar:close-circle-bold",   bg: "bg-red-50",     text: "text-red-600",     border: "border-red-200",    bar: "bg-red-400",     ring: "ring-red-400/30"     },
    refunded:   { label: "Refunded",   icon: "solar:transfer-horizontal-bold", bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200",  bar: "bg-gray-400",    ring: "ring-gray-400/30"    },
};

const STEPS = [
    { key: "pending",    label: "Order Placed",  icon: "solar:cart-check-bold"   },
    { key: "processing", label: "Preparing",     icon: "solar:box-bold"          },
    { key: "shipped",    label: "On the Way",    icon: "solar:delivery-bold"     },
    { key: "delivered",  label: "Delivered",     icon: "solar:home-smile-bold"   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, symbol: string) {
    return `${symbol}${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function fmtDateShort(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ── Section card wrapper ──────────────────────────────────────────────────────

function Section({ title, icon, iconBg, iconColor, children }: {
    title: string; icon: string; iconBg: string; iconColor: string; children: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                    <Icon icon={icon} width={16} className={iconColor} />
                </span>
                <h2 className="text-sm font-bold text-gray-800">{title}</h2>
            </div>
            <div className="px-5 py-4">{children}</div>
        </div>
    );
}

// ── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
            <span className="text-xs font-semibold text-gray-400 w-28 shrink-0 pt-0.5">{label}</span>
            <span className="text-sm text-gray-800 flex-1">{value}</span>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function UserOrderDetails() {
    const pathname = usePathname();
    const id = pathname?.split("/").filter(Boolean).pop() ?? "";
    const { settings } = useSettings();
    const symbol = (settings?.product_currency_symbol || settings?.currency_symbol || "") as string;
    const { data: session } = useSession();

    const [order,   setOrder]   = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState("");
    const [locationMap, setLocationMap] = useState<Record<string, string>>({});

    // ── Review state ──────────────────────────────────────────────────────────
    const [reviewedMap,       setReviewedMap]       = useState<Record<string, any>>({});
    const [reviewModalItem,   setReviewModalItem]   = useState<ReviewItemData | null>(null);
    const [reviewSuccessMsg,  setReviewSuccessMsg]  = useState("");

    // ── Return request state ──────────────────────────────────────────────────
    const [returnRequests,     setReturnRequests]     = useState<any[]>([]);
    const [withinReturnWindow, setWithinReturnWindow] = useState(false);
    const [returnDeadline,     setReturnDeadline]     = useState<string | null>(null);
    const [showReturnForm,     setShowReturnForm]     = useState(false);
    const [returnReason,       setReturnReason]       = useState("");
    const [submittingReturn,   setSubmittingReturn]   = useState(false);
    const [returnMsg,          setReturnMsg]          = useState("");

    const fetchReturnInfo = async (orderNumber: string) => {
        try {
            const res = await fetch(`/api/orders/${orderNumber}/return`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            setReturnRequests(data.returnRequests ?? []);
            setWithinReturnWindow(data.withinReturnWindow ?? false);
            setReturnDeadline(data.returnDeadline ?? null);
        } catch { /* silent */ }
    };

    const fetchReviews = async (orderNumber: string, userId?: string) => {
        try {
            const qs = new URLSearchParams({ orderNumber });
            if (userId) qs.set("userId", userId);
            const res = await fetch(`/api/comments?${qs}`, { credentials: "include" });
            if (!res.ok) return;
            const json = await res.json();
            const map: Record<string, any> = {};
            for (const r of json.data || []) {
                if (r.targetId) map[r.targetId] = r;
            }
            setReviewedMap(map);
        } catch { /* silent */ }
    };

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        fetch(`/api/orders/id/${id}`, { credentials: "include" })
            .then(async res => {
                if (res.status === 404) { setError("Order not found."); return; }
                if (!res.ok)            { setError("Could not load order."); return; }
                const data = await res.json();
                setOrder(data.order);
                // Fetch return info if delivered
                if (data.order?.status === "delivered") {
                    fetchReturnInfo(data.order.orderNumber);
                }
                if (data.order?.orderNumber) {
                    const uId = (session?.user as any)?._id || "";
                    fetchReviews(data.order.orderNumber, uId);
                }
            })
            .catch(() => setError("Network error — please try again."))
            .finally(() => setLoading(false));
    }, [id, (session?.user as any)?._id]);

    useEffect(() => {
        fetch("/api/location/category?type=location")
            .then((r) => (r.ok ? r.json() : { categories: [] }))
            .then((data) => {
                const map: Record<string, string> = {};
                for (const loc of data.categories || []) {
                    const locId = loc.id || loc._id;
                    if (locId) map[locId] = loc.title;
                }
                setLocationMap(map);
            })
            .catch(() => {});
    }, []);

    const handleSubmitReturn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!order || !returnReason.trim()) return;
        setSubmittingReturn(true);
        setReturnMsg("");
        try {
            const res = await fetch(`/api/orders/${order.orderNumber}/return`, {
                method:      "POST",
                credentials: "include",
                headers:     { "Content-Type": "application/json" },
                body:        JSON.stringify({ reason: returnReason.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setReturnMsg(`Error: ${data.error}`);
            } else {
                setReturnMsg("Return request submitted! The seller will review it shortly.");
                setReturnReason("");
                setShowReturnForm(false);
                fetchReturnInfo(order.orderNumber);
            }
        } catch {
            setReturnMsg("Network error — please try again.");
        } finally {
            setSubmittingReturn(false);
        }
    };

    // ── Loading skeleton ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="space-y-5 animate-pulse">
                <div className="flex items-center gap-3">
                    <div className="h-4 w-24 bg-gray-100 rounded-lg" />
                    <div className="h-4 w-4 bg-gray-100 rounded" />
                    <div className="h-4 w-36 bg-gray-100 rounded-lg" />
                </div>
                <div className="h-28 bg-white rounded-3xl border border-gray-100 shadow-sm" />
                <div className="h-48 bg-white rounded-3xl border border-gray-100 shadow-sm" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="h-36 bg-white rounded-3xl border border-gray-100 shadow-sm" />
                    <div className="h-36 bg-white rounded-3xl border border-gray-100 shadow-sm" />
                </div>
            </div>
        );
    }

    // ── Error state ───────────────────────────────────────────────────────────
    if (error || !order) {
        return (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm py-20 text-center px-6">
                <div className="relative w-20 h-20 mx-auto mb-5">
                    <div className="absolute inset-0 rounded-3xl bg-red-100 rotate-6" />
                    <div className="absolute inset-0 rounded-3xl bg-red-50 flex items-center justify-center">
                        <Icon icon="solar:receipt-remove-bold" width={36} className="text-red-400" />
                    </div>
                </div>
                <p className="text-lg font-black text-gray-700">{error || "Order not found."}</p>
                <p className="text-sm text-gray-400 mt-1 mb-5">We couldn't load this order. Please try again.</p>
                <Link href="/account/orders"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200">
                    <Icon icon="solar:arrow-left-bold" width={14} />
                    Back to My Orders
                </Link>
            </div>
        );
    }

    const os  = STATUS[order.status]        ?? STATUS.pending;
    const ps  = STATUS[order.paymentStatus] ?? STATUS.pending;
    const stepIdx = STEPS.findIndex(s => s.key === order.status);

    return (
        <div className="space-y-5">

            {/* ── Breadcrumb + header ── */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <div className="flex items-center gap-2 text-sm mb-1">
                        <Link href="/account/orders"
                            className="flex items-center gap-1 text-gray-400 hover:text-indigo-600 font-medium transition-colors">
                            <Icon icon="solar:arrow-left-bold" width={13} />
                            My Orders
                        </Link>
                        <Icon icon="solar:alt-arrow-right-bold" width={11} className="text-gray-300" />
                        <span className="text-gray-500 font-mono font-bold">{order.orderNumber}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                        Placed {fmtDateShort(order.createdAt)}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${os.bg} ${os.text} ${os.border}`}>
                        <Icon icon={os.icon} width={12} />
                        {os.label}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${ps.bg} ${ps.text}`}>
                        <Icon icon={ps.icon} width={12} />
                        {ps.label}
                    </span>
                </div>
            </div>

            {/* ── Hero summary banner ── */}
            <div className={`relative overflow-hidden rounded-3xl ${os.bg} border ${os.border} p-5`}>
                <div className="absolute top-0 left-0 right-0 h-1 ${os.bar}" />
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl ${os.bar} flex items-center justify-center shadow-sm shrink-0`}>
                            <Icon icon={os.icon} width={22} className="text-white" />
                        </div>
                        <div>
                            <p className={`text-xs font-bold uppercase tracking-widest ${os.text} opacity-70`}>Order Status</p>
                            <p className={`text-xl font-black ${os.text}`}>{os.label}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400 font-medium">Order Total</p>
                        <p className="text-2xl font-black text-gray-900">{fmt(order.total, symbol)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Progress stepper ── */}
            {order.status !== "cancelled" ? (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Order Progress</p>
                    <div className="flex items-start">
                        {STEPS.map((step, i) => {
                            const done   = i <= stepIdx;
                            const active = i === stepIdx;
                            const scfg   = STATUS[step.key] ?? STATUS.pending;
                            return (
                                <div key={step.key} className="flex items-start flex-1 last:flex-none">
                                    <div className="flex flex-col items-center gap-2 flex-1">
                                        <div className={`relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 shrink-0
                                            ${done ? `${scfg.bar} text-white shadow-md` : "bg-gray-100 text-gray-300"}
                                            ${active ? `ring-4 ${scfg.ring} scale-110` : ""}`}>
                                            <Icon icon={step.icon} width={18} />
                                            {done && i < stepIdx && (
                                                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white flex items-center justify-center">
                                                    <Icon icon="solar:check-bold" width={8} className="text-white" />
                                                </span>
                                            )}
                                        </div>
                                        <span className={`text-[10px] font-bold text-center leading-tight px-1 ${done ? "text-gray-700" : "text-gray-300"}`}>
                                            {step.label}
                                        </span>
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className={`flex-1 h-0.5 mt-5 mx-1 rounded-full transition-all duration-500 ${i < stepIdx ? os.bar : "bg-gray-100"}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-3xl px-5 py-4">
                    <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                        <Icon icon="solar:close-circle-bold" width={20} className="text-red-500" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-red-700">Order Cancelled</p>
                        <p className="text-xs text-red-500 mt-0.5">This order has been cancelled and will not be processed.</p>
                    </div>
                </div>
            )}

            {/* ── Items ── */}
            <Section title={`Order Items (${order.items.length})`} icon="solar:box-bold" iconBg="bg-indigo-50" iconColor="text-indigo-600">
                <div className="space-y-4 pt-4">
                    {order.items.map((item, i) => (
                        <div key={i} className={`flex gap-4 ${i > 0 ? "pt-4 border-t border-gray-50" : ""}`}>
                            {/* Image */}
                            <div className="relative w-18 h-18 rounded-2xl overflow-hidden bg-gray-100 border border-gray-100 shrink-0"
                                style={{ width: 72, height: 72 }}>
                                {item.productImage ? (
                                    <Image src={item.productImage} alt={item.productTitle}
                                        fill className="object-cover" sizes="72px" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Icon icon="solar:box-bold" width={28} className="text-gray-300" />
                                    </div>
                                )}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug">{item.productTitle}</p>

                                {/* Variant chips */}
                                {item.variantOptions && Object.keys(item.variantOptions).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {Object.entries(item.variantOptions).map(([k, v]) => (
                                            <span key={k} className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600">
                                                {k}: {v}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                    {item.sku && (
                                        <span className="text-[11px] font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg">
                                            SKU: {item.sku}
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-500">
                                        ×{item.quantity} @ <span className="font-semibold text-gray-700">{fmt(item.price, symbol)}</span>
                                    </span>
                                </div>

                                {item.orderNote && (
                                    <p className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-xl mt-1.5 italic border border-amber-100">
                                        Note: {item.orderNote}
                                    </p>
                                )}

                                {/* ── Review status / Rate action ── */}
                                {order.status !== "cancelled" && (
                                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                                        {(() => {
                                            const existingReview = reviewedMap[item.productId || ""] || reviewedMap[item.productSlug || ""];
                                            if (existingReview) {
                                                const isApproved = existingReview.status === "approved";
                                                return (
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl border ${
                                                                isApproved
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                                            }`}
                                                        >
                                                            <Icon
                                                                icon={isApproved ? "solar:star-bold" : "solar:clock-circle-bold"}
                                                                width={13}
                                                                className={isApproved ? "text-amber-500" : "text-amber-600"}
                                                            />
                                                            Rated {existingReview.rating}★ · {isApproved ? "Approved" : "Pending Review"}
                                                        </span>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setReviewModalItem({
                                                            productId: item.productId || item.productSlug || "",
                                                            productTitle: item.productTitle,
                                                            productImage: item.productImage,
                                                            productSlug: item.productSlug,
                                                            uploadedBy: item.uploadedBy,
                                                            orderNumber: order.orderNumber,
                                                            orderId: order._id,
                                                            variantOptions: item.variantOptions,
                                                        })
                                                    }
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 text-xs font-bold transition-all shadow-xs"
                                                >
                                                    <Icon icon="solar:star-bold" width={13} className="text-amber-500" />
                                                    Rate & Review Product
                                                </button>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>

                            {/* Subtotal */}
                            <div className="text-right shrink-0">
                                <p className="text-base font-black text-gray-900">{fmt(item.subtotal, symbol)}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Price breakdown */}
                <div className="mt-5 pt-4 border-t border-gray-100 space-y-2">
                    <div className="flex justify-between text-sm text-gray-500">
                        <span>Subtotal</span>
                        <span className="font-semibold text-gray-700">{fmt(order.subtotal, symbol)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                        <span className="flex items-center gap-1.5">
                            <Icon icon="solar:delivery-bold" width={13} />
                            Shipping
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg font-semibold">
                                {order.shippingMethod}
                            </span>
                        </span>
                        <span className="font-semibold text-gray-700">{fmt(order.shippingCost, symbol)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                        <span className="text-base font-black text-gray-900">Total</span>
                        <span className="text-xl font-black text-indigo-600">{fmt(order.total, symbol)}</span>
                    </div>
                </div>
            </Section>

            {/* ── Two-column grid: Address + Payment ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Delivery address */}
                <Section title="Delivery Address" icon="solar:map-point-bold" iconBg="bg-emerald-50" iconColor="text-emerald-600">
                    <div className="space-y-2">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                                <Icon icon="solar:user-bold" width={14} className="text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-900">{order.shippingAddress.name}</p>
                                {order.shippingAddress.email && (
                                    <p className="text-xs text-gray-400 mt-0.5">{order.shippingAddress.email}</p>
                                )}
                            </div>
                        </div>

                        {order.shippingAddress.phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Icon icon="solar:phone-bold" width={14} className="text-gray-400 shrink-0" />
                                {order.shippingAddress.phone}
                            </div>
                        )}

                        <div className="flex items-start gap-2 text-sm text-gray-600">
                            <Icon icon="solar:map-point-bold" width={14} className="text-gray-400 shrink-0 mt-0.5" />
                            <div>
                                {order.shippingAddress.address && <p>{order.shippingAddress.address}</p>}
                                {(order.shippingAddress.city || order.shippingAddress.state) && (
                                    <p>{[locationMap[order.shippingAddress.city] || order.shippingAddress.city, locationMap[order.shippingAddress.state] || order.shippingAddress.state].filter(Boolean).join(", ")}</p>
                                )}
                                {order.shippingAddress.zipCode && <p>{order.shippingAddress.zipCode}</p>}
                            </div>
                        </div>
                    </div>
                </Section>

                {/* Payment info */}
                <Section title="Payment Details" icon="solar:card-bold" iconBg="bg-violet-50" iconColor="text-violet-600">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${ps.bg}`}>
                                <Icon icon={ps.icon} width={16} className={ps.text} />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-400">Status</p>
                                <p className={`text-sm font-bold ${ps.text}`}>{ps.label}</p>
                            </div>
                        </div>

                        {order.paymentGatewayType && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Icon icon="solar:card-2-bold" width={14} className="text-gray-400 shrink-0" />
                                <span className="capitalize font-medium">
                                    {order.paymentGatewayType.replace(/_/g, " ")}
                                </span>
                            </div>
                        )}

                        {order.paymentProof?.transactionId && (
                            <div className="text-sm text-gray-600">
                                <p className="text-xs font-semibold text-gray-400 mb-0.5">Transaction ID</p>
                                <code className="text-xs font-mono bg-gray-100 text-gray-800 px-2.5 py-1 rounded-lg block">
                                    {order.paymentProof.transactionId}
                                </code>
                            </div>
                        )}

                        {order.paymentProof?.paymentInfo && (
                            <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
                                {order.paymentProof.paymentInfo}
                            </p>
                        )}

                        {order.paymentProof?.proofImage && (
                            <div>
                                <p className="text-xs font-semibold text-gray-400 mb-1.5">Payment Proof</p>
                                <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-gray-100 border border-gray-100">
                                    <Image src={order.paymentProof.proofImage} alt="Payment proof"
                                        fill className="object-contain" />
                                </div>
                            </div>
                        )}
                    </div>
                </Section>
            </div>

            {/* ── Timeline ── */}
            {order.timeline.length > 0 && (
                <Section title="Order Timeline" icon="solar:history-bold" iconBg="bg-sky-50" iconColor="text-sky-600">
                    <div className="relative">
                        {/* Vertical line */}
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100 rounded-full" />

                        <ol className="space-y-5">
                            {[...order.timeline].reverse().map((entry, i) => {
                                const sc = STATUS[entry.status] ?? STATUS.pending;
                                const isFirst = i === 0;
                                return (
                                    <li key={i} className="relative flex gap-4 pl-10">
                                        {/* Dot */}
                                        <span className={`absolute left-0 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border-2 border-white shadow-sm ${isFirst ? sc.bar + " text-white" : "bg-gray-100 text-gray-400"}`}>
                                            <Icon icon={sc.icon} width={14} />
                                        </span>

                                        <div className="flex-1 min-w-0 pb-1">
                                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                                <div>
                                                    <p className={`text-sm font-bold capitalize ${isFirst ? "text-gray-900" : "text-gray-600"}`}>
                                                        {entry.status}
                                                    </p>
                                                    {entry.note && (
                                                        <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{entry.note}</p>
                                                    )}
                                                    {entry.createdByName && (
                                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                                            By {entry.createdByName}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className={`text-[11px] font-semibold whitespace-nowrap shrink-0 px-2.5 py-1 rounded-xl ${isFirst ? sc.bg + " " + sc.text : "bg-gray-50 text-gray-400"}`}>
                                                    {fmtDate(entry.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                </Section>
            )}

            {/* ── Notes ── */}
            {order.notes && (
                <Section title="Order Notes" icon="solar:notes-bold" iconBg="bg-amber-50" iconColor="text-amber-600">
                    <div className="flex items-start gap-3">
                        <Icon icon="solar:notes-bold" width={16} className="text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{order.notes}</p>
                    </div>
                </Section>
            )}

            {/* ── Return Request section (delivered orders only) ── */}
            {order.status === "delivered" && (
                <Section title="Return Request" icon="solar:box-minimalistic-bold" iconBg="bg-orange-50" iconColor="text-orange-600">
                    <div className="space-y-4">

                        {/* Return window banner */}
                        {withinReturnWindow && returnDeadline ? (
                            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                                <Icon icon="solar:danger-triangle-bold" width={16} className="text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-700">
                                    You can request a return until{" "}
                                    <strong>{new Date(returnDeadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong>.
                                    Returns must be requested within 7 days of delivery.
                                </p>
                            </div>
                        ) : (
                            <div className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                                <Icon icon="solar:clock-circle-bold" width={16} className="text-gray-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-gray-500">
                                    The 7-day return window for this order has expired.
                                </p>
                            </div>
                        )}

                        {/* Existing return requests */}
                        {returnRequests.length > 0 && (
                            <div className="space-y-2">
                                {returnRequests.map((r: any) => {
                                    const STATUS_CLS: Record<string, string> = {
                                        pending_seller:  "bg-yellow-100 text-yellow-700",
                                        pending_admin:   "bg-blue-100 text-blue-700",
                                        approved:        "bg-emerald-100 text-emerald-700",
                                        rejected_seller: "bg-red-100 text-red-700",
                                        rejected_admin:  "bg-red-100 text-red-700",
                                    };
                                    const STATUS_LABEL: Record<string, string> = {
                                        pending_seller:  "Awaiting Seller Review",
                                        pending_admin:   "Awaiting Admin Review",
                                        approved:        "Return Approved — Refund Initiated",
                                        rejected_seller: "Return Rejected by Seller",
                                        rejected_admin:  "Return Rejected by Admin",
                                    };
                                    return (
                                        <div key={r._id} className="bg-gray-50 rounded-2xl border border-gray-100 p-4 space-y-2">
                                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${STATUS_CLS[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                                                    {STATUS_LABEL[r.status] ?? r.status}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    Submitted {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-700">
                                                <span className="font-semibold text-gray-500 mr-1.5">Reason:</span>
                                                {r.reason}
                                            </p>
                                            {r.sellerNote && (
                                                <p className="text-xs text-gray-500">
                                                    <span className="font-semibold">Seller:</span> {r.sellerNote}
                                                </p>
                                            )}
                                            {r.adminNote && (
                                                <p className="text-xs text-gray-500">
                                                    <span className="font-semibold">Admin:</span> {r.adminNote}
                                                </p>
                                            )}
                                            {r.refundProcessed && (
                                                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                                                    <Icon icon="solar:check-circle-bold" width={13} />
                                                    Order cancelled and refund has been processed.
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Return success message */}
                        {returnMsg && (
                            <div className={`text-sm font-medium px-4 py-3 rounded-xl border ${returnMsg.startsWith("Error") ? "bg-red-50 text-red-600 border-red-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"}`}>
                                {returnMsg}
                            </div>
                        )}

                        {/* Submit return form */}
                        {withinReturnWindow && returnRequests.filter((r: any) => ["pending_seller","pending_admin"].includes(r.status)).length === 0 && (
                            <>
                                {showReturnForm ? (
                                    <form onSubmit={handleSubmitReturn} className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                                Reason for Return <span className="text-red-500">*</span>
                                            </label>
                                            <textarea
                                                rows={3}
                                                value={returnReason}
                                                onChange={e => setReturnReason(e.target.value)}
                                                placeholder="Please describe why you want to return this order…"
                                                required
                                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="submit" disabled={submittingReturn || !returnReason.trim()}
                                                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-2xl disabled:opacity-50 transition">
                                                {submittingReturn ? <><Icon icon="svg-spinners:ring-resize" width={15} /> Submitting…</> : "Submit Return Request"}
                                            </button>
                                            <button type="button" onClick={() => { setShowReturnForm(false); setReturnReason(""); }}
                                                className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-2xl hover:bg-gray-200 transition">
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <button onClick={() => setShowReturnForm(true)}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-orange-200 bg-orange-50 text-orange-600 text-sm font-bold hover:bg-orange-100 transition">
                                        <Icon icon="solar:box-minimalistic-bold" width={15} />
                                        Request Return
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </Section>
            )}

            {/* ── Review Success Alert ── */}
            {reviewSuccessMsg && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white px-5 py-3.5 rounded-2xl shadow-xl border border-gray-700 animate-in fade-in slide-in-from-bottom-5">
                    <Icon icon="solar:check-circle-bold" width={20} className="text-emerald-400 shrink-0" />
                    <p className="text-sm font-medium">{reviewSuccessMsg}</p>
                    <button
                        onClick={() => setReviewSuccessMsg("")}
                        className="ml-2 text-gray-400 hover:text-white"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* ── Review Modal ── */}
            {reviewModalItem && session?.user && (
                <ReviewModal
                    item={reviewModalItem}
                    isOpen={Boolean(reviewModalItem)}
                    onClose={() => setReviewModalItem(null)}
                    onSuccess={(newRev) => {
                        setReviewedMap((prev) => ({
                            ...prev,
                            [newRev.targetId]: newRev,
                        }));
                        setReviewSuccessMsg("Thank you! Your review has been submitted for moderation.");
                        setTimeout(() => setReviewSuccessMsg(""), 5000);
                    }}
                    user={{
                        _id: (session.user as any)._id || "",
                        name: session.user.name || "Customer",
                        image: session.user.image || "",
                    }}
                />
            )}

            {/* ── Bottom action ── */}
            <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
                <Link href="/account/orders"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">
                    <Icon icon="solar:arrow-left-bold" width={14} />
                    All Orders
                </Link>
                <Link href="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all hover:-translate-y-px">
                    <Icon icon="solar:cart-large-bold" width={15} />
                    Continue Shopping
                </Link>
            </div>

        </div>
    );
}
