"use client";

/**
 * User account — My Orders  (/account/orders)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { useSession } from "next-auth/react";
import useSettings from "@/lib/useSettings";
import ReviewModal, { type ReviewItemData } from "./ReviewModal";

interface OrderItem {
    productId?: string;
    productSlug?: string;
    productTitle: string;
    productImage?: string;
    quantity: number;
    price: number;
    subtotal: number;
    uploadedBy?: string;
    variantOptions?: Record<string, string>;
}

interface Order {
    _id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    items: OrderItem[];
    total: number;
    shippingMethod: string;
    createdAt: string;
}

interface PagedOrders {
    orders: Order[];
    total: number;
    page: number;
    pages: number;
}

// ── Visual config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
    label: string; icon: string; step: number;
    bg: string; text: string; border: string; dot: string;
    barColor: string; iconBg: string;
}> = {
    pending:    { label: "Pending",    icon: "solar:clock-circle-bold",      step: 0, bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",  dot: "bg-amber-400",   barColor: "bg-amber-400",   iconBg: "bg-amber-100"   },
    processing: { label: "Processing", icon: "solar:refresh-circle-bold",    step: 1, bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",   dot: "bg-blue-400",    barColor: "bg-blue-500",    iconBg: "bg-blue-100"    },
    shipped:    { label: "Shipped",    icon: "solar:delivery-bold",          step: 2, bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200", dot: "bg-violet-400",  barColor: "bg-violet-500",  iconBg: "bg-violet-100"  },
    delivered:  { label: "Delivered",  icon: "solar:check-circle-bold",      step: 3, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200",dot: "bg-emerald-400", barColor: "bg-emerald-500", iconBg: "bg-emerald-100" },
    cancelled:  { label: "Cancelled",  icon: "solar:close-circle-bold",      step:-1, bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",    dot: "bg-red-400",     barColor: "bg-red-400",     iconBg: "bg-red-100"     },
};

const PAYMENT_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
    pending:  { label: "Unpaid",   bg: "bg-amber-50",   text: "text-amber-700",   icon: "solar:clock-circle-bold"        },
    paid:     { label: "Paid",     bg: "bg-emerald-50", text: "text-emerald-700", icon: "solar:check-circle-bold"        },
    failed:   { label: "Failed",   bg: "bg-red-50",     text: "text-red-600",     icon: "solar:close-circle-bold"        },
    refunded: { label: "Refunded", bg: "bg-gray-100",   text: "text-gray-600",    icon: "solar:transfer-horizontal-bold" },
};

const PROGRESS_STEPS: Array<{ key: string; label: string; icon: string }> = [
    { key: "pending",    label: "Placed",    icon: "solar:cart-check-bold"      },
    { key: "processing", label: "Preparing", icon: "solar:box-bold"             },
    { key: "shipped",    label: "On the way",icon: "solar:delivery-bold"        },
    { key: "delivered",  label: "Delivered", icon: "solar:home-smile-bold"      },
];

function fmt(n: number, symbol: string) {
    return `${symbol}${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
            <div className="h-1.5 bg-gray-100" />
            <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="h-4 bg-gray-100 rounded-lg w-32" />
                    <div className="h-6 bg-gray-100 rounded-full w-20" />
                </div>
                <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                        <div className="h-4 bg-gray-100 rounded-lg w-3/4" />
                        <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
                        <div className="h-3 bg-gray-100 rounded-lg w-1/3" />
                    </div>
                </div>
                <div className="flex gap-3 pt-1">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex-1 h-1 rounded-full bg-gray-100" />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function UserOrderList() {
    const { settings } = useSettings();
    const symbol = (settings?.product_currency_symbol || settings?.currency_symbol || "") as string;
    const { data: session } = useSession();

    const [data,             setData]             = useState<PagedOrders | null>(null);
    const [loading,          setLoading]          = useState(true);
    const [page,             setPage]             = useState(1);
    const [status,           setStatus]           = useState("");
    const [reviewModalItem,  setReviewModalItem]  = useState<ReviewItemData | null>(null);
    const [reviewSuccessMsg, setReviewSuccessMsg] = useState("");

    useEffect(() => {
        setLoading(true);
        const qs = new URLSearchParams({ page: String(page), limit: "10" });
        if (status) qs.set("status", status);
        fetch(`/api/orders?${qs}`, { credentials: "include" })
            .then(async res => { if (res.ok) setData(await res.json()); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [page, status]);

    const orders = data?.orders ?? [];

    // Count per status for filter chips
    const counts = orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-6">

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
                    onSuccess={() => {
                        setReviewSuccessMsg("Review submitted successfully! It will appear after moderation.");
                        setTimeout(() => setReviewSuccessMsg(""), 5000);
                    }}
                    user={{
                        _id: (session.user as any)._id || "",
                        name: session.user.name || "Customer",
                        image: session.user.image || "",
                    }}
                />
            )}

            {/* ── Page title ── */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">My Orders</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        {loading ? "Loading…" : data ? `${data.total} order${data.total !== 1 ? "s" : ""}` : "0 orders"}
                    </p>
                </div>
                <Link href="/"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all hover:-translate-y-px">
                    <Icon icon="solar:cart-large-bold" width={16} />
                    Shop More
                </Link>
            </div>

            {/* ── Filter chips ── */}
            <div className="flex items-center gap-2 flex-wrap">
                {([{ key: "", label: "All orders" }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))] as { key: string; label: string }[]).map(item => {
                    const cfg = item.key ? STATUS_CONFIG[item.key] : null;
                    const isActive = status === item.key;
                    return (
                        <button key={item.key}
                            onClick={() => { setStatus(item.key); setPage(1); }}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all border ${
                                isActive
                                    ? cfg ? `${cfg.bg} ${cfg.text} ${cfg.border}` : "bg-gray-900 text-white border-gray-900"
                                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                            }`}>
                            {cfg && <span className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />}
                            {item.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Loading skeletons ── */}
            {loading && (
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} style={{ animationDelay: `${i * 100}ms` }}>
                            <SkeletonCard />
                        </div>
                    ))}
                </div>
            )}

            {/* ── Empty state ── */}
            {!loading && orders.length === 0 && (
                <div className="bg-white rounded-3xl border border-dashed border-gray-200 py-20 text-center">
                    <div className="relative w-20 h-20 mx-auto mb-5">
                        <div className="absolute inset-0 rounded-3xl bg-indigo-100 rotate-6" />
                        <div className="absolute inset-0 rounded-3xl bg-indigo-50 flex items-center justify-center">
                            <Icon icon="solar:bag-5-bold" width={36} className="text-indigo-400" />
                        </div>
                    </div>
                    <p className="text-lg font-black text-gray-700">No orders yet</p>
                    <p className="text-sm text-gray-400 mt-1 mb-6">
                        {status ? `No orders with "${STATUS_CONFIG[status]?.label}" status.` : "Time to treat yourself!"}
                    </p>
                    <Link href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-linear-to-r from-indigo-600 to-purple-600 text-white rounded-2xl text-sm font-bold shadow-md shadow-indigo-200 hover:-translate-y-px transition-all">
                        <Icon icon="solar:cart-large-bold" width={17} />
                        Start Shopping
                    </Link>
                </div>
            )}

            {/* ── Order cards ── */}
            {!loading && orders.map((order, cardIdx) => {
                const s      = STATUS_CONFIG[order.status]         ?? STATUS_CONFIG.pending;
                const ps     = PAYMENT_CONFIG[order.paymentStatus] ?? PAYMENT_CONFIG.pending;
                const fi     = order.items[0];
                const more   = order.items.length - 1;
                const stepIdx = PROGRESS_STEPS.findIndex(p => p.key === order.status);

                return (
                    <div key={order._id}
                        className="group bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">

                        {/* Colored top accent bar */}
                        <div className={`h-1.5 ${s.barColor}`} />

                        {/* ── Card header ── */}
                        <div className="flex items-center justify-between gap-2 px-5 mt-4 pb-3 flex-wrap">
                            {/* Order number + date */}
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${s.iconBg}`}>
                                    <Icon icon={s.icon} width={18} className={s.text} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-gray-900 font-mono leading-none">
                                        {order.orderNumber}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">{fmtDate(order.createdAt)}</p>
                                </div>
                            </div>

                            {/* Badges + total */}
                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full border ${s.bg} ${s.text} ${s.border}`}>
                                    <Icon icon={s.icon} width={11} />
                                    {s.label}
                                </span>
                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full ${ps.bg} ${ps.text}`}>
                                    <Icon icon={ps.icon} width={11} />
                                    {ps.label}
                                </span>
                                <span className="text-base font-black text-gray-900 ml-1">
                                    {fmt(order.total, symbol)}
                                </span>
                            </div>
                        </div>

                        {/* ── Progress stepper ── */}
                        {order.status !== "cancelled" && (
                            <div className="px-5 py-3 bg-gray-50/60 border-y border-gray-100">
                                <div className="flex items-center">
                                    {PROGRESS_STEPS.map((step, i) => {
                                        const done   = i <= stepIdx;
                                        const active = i === stepIdx;
                                        return (
                                            <div key={step.key} className="flex items-center flex-1 last:flex-none">
                                                <div className="flex flex-col items-center gap-1 shrink-0">
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300
                                                        ${done
                                                            ? `${s.barColor} text-white shadow-sm`
                                                            : "bg-gray-200 text-gray-400"
                                                        }
                                                        ${active ? "scale-110 ring-4 ring-offset-1 ring-current/20" : ""}`}>
                                                        <Icon icon={step.icon} width={13} />
                                                    </div>
                                                    <span className={`text-[9px] font-bold whitespace-nowrap leading-none ${done ? s.text : "text-gray-300"}`}>
                                                        {step.label}
                                                    </span>
                                                </div>
                                                {i < PROGRESS_STEPS.length - 1 && (
                                                    <div className={`flex-1 h-0.5 mx-1 mb-3.5 rounded-full transition-all duration-500 ${i < stepIdx ? s.barColor : "bg-gray-200"}`} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Cancelled banner */}
                        {order.status === "cancelled" && (
                            <div className="mx-5 my-3 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-red-50 border border-red-100">
                                <Icon icon="solar:close-circle-bold" width={16} className="text-red-400 shrink-0" />
                                <p className="text-xs font-semibold text-red-600">This order has been cancelled.</p>
                            </div>
                        )}

                        {/* ── Item preview ── */}
                        <div className="flex items-center gap-4 px-5 py-4">
                            {/* Product image */}
                            <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                                {fi?.productImage ? (
                                    <Image src={fi.productImage} alt={fi.productTitle}
                                        fill className="object-cover" sizes="64px" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Icon icon="solar:box-bold" width={26} className="text-gray-300" />
                                    </div>
                                )}
                                {order.items.length > 1 && (
                                    <div className="absolute bottom-0 right-0 bg-gray-900/70 text-white text-[9px] font-black px-1.5 py-0.5 rounded-tl-lg">
                                        +{order.items.length - 1}
                                    </div>
                                )}
                            </div>

                            {/* Product info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                                    {fi?.productTitle ?? "—"}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-400">
                                        Qty: <span className="font-semibold text-gray-600">{fi?.quantity ?? 1}</span>
                                    </span>
                                    {fi?.price != null && (
                                        <span className="text-xs text-gray-400">
                                            @ <span className="font-semibold text-gray-600">{fmt(fi.price, symbol)}</span>
                                        </span>
                                    )}
                                    {more > 0 && (
                                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                            +{more} more
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                    <Icon icon="solar:delivery-bold" width={11} className="inline mr-1" />
                                    {order.shippingMethod}
                                </p>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                                {order.status !== "cancelled" && fi && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setReviewModalItem({
                                                productId: fi.productId || fi.productSlug || "",
                                                productTitle: fi.productTitle,
                                                productImage: fi.productImage,
                                                productSlug: fi.productSlug,
                                                uploadedBy: fi.uploadedBy,
                                                orderNumber: order.orderNumber,
                                                orderId: order._id,
                                                variantOptions: fi.variantOptions,
                                            })
                                        }
                                        className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 transition-all shadow-xs"
                                    >
                                        <Icon icon="solar:star-bold" width={13} className="text-amber-500" />
                                        Rate
                                    </button>
                                )}

                                <Link href={`/account/orders/${order._id}`}
                                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${s.bg} ${s.text} hover:opacity-80`}>
                                    View
                                    <Icon icon="solar:arrow-right-bold" width={13} />
                                </Link>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* ── Pagination ── */}
            {data && data.pages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all">
                        <Icon icon="solar:arrow-left-bold" width={14} />
                        Previous
                    </button>

                    <div className="flex items-center gap-1">
                        {[...Array(data.pages)].map((_, i) => (
                            <button key={i} onClick={() => setPage(i + 1)}
                                className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${
                                    page === i + 1
                                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                                        : "text-gray-500 hover:bg-gray-100"
                                }`}>
                                {i + 1}
                            </button>
                        ))}
                    </div>

                    <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page >= data.pages}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all">
                        Next
                        <Icon icon="solar:arrow-right-bold" width={14} />
                    </button>
                </div>
            )}
        </div>
    );
}
