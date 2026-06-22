"use client";

/**
 * User account — Order Detail  (/account/orders/:id)
 *
 * Fetches a single order by MongoDB _id from GET /api/orders/id/:id.
 * Read-only — users cannot update status.
 * Shows: items, totals, shipping address, payment proof, timeline.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import useSettings from "@/lib/useSettings";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
    productTitle: string;
    productImage?: string;
    variantOptions?: Record<string, string>;
    sku?: string;
    price: number;
    quantity: number;
    subtotal: number;
    orderNote?: string;
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

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: string }> = {
    pending:    { label: "Pending",    cls: "bg-yellow-100 text-yellow-700",    icon: "mdi:clock-outline" },
    processing: { label: "Processing", cls: "bg-blue-100 text-blue-700",       icon: "mdi:cog-outline" },
    shipped:    { label: "Shipped",    cls: "bg-indigo-100 text-indigo-700",   icon: "mdi:truck-delivery-outline" },
    delivered:  { label: "Delivered",  cls: "bg-emerald-100 text-emerald-700", icon: "mdi:check-circle-outline" },
    cancelled:  { label: "Cancelled",  cls: "bg-red-100 text-red-700",         icon: "mdi:close-circle-outline" },
    paid:       { label: "Paid",       cls: "bg-emerald-100 text-emerald-700", icon: "mdi:credit-card-check-outline" },
    failed:     { label: "Failed",     cls: "bg-red-100 text-red-700",         icon: "mdi:credit-card-remove-outline" },
    refunded:   { label: "Refunded",   cls: "bg-gray-100 text-gray-600",       icon: "mdi:cash-refund" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, symbol: string) {
    return `${symbol} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`.trim();
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
                <Icon icon={icon} width={16} className="text-gray-400 shrink-0" />
                <h2 className="text-sm font-bold text-gray-800">{title}</h2>
            </div>
            <div className="px-5 py-4">{children}</div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function UserOrderDetails() {
    const pathname = usePathname();
    // Last segment of the URL is the _id
    const id = pathname?.split("/").filter(Boolean).pop() ?? "";

    const { settings } = useSettings();
    const symbol = (settings?.product_currency_symbol || settings?.currency_symbol || "") as string;

    const [order,   setOrder]   = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState("");

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        fetch(`/api/orders/id/${id}`, { credentials: "include" })
            .then(async res => {
                if (res.status === 404) { setError("Order not found."); return; }
                if (!res.ok)            { setError("Could not load order."); return; }
                const data = await res.json();
                setOrder(data.order);
            })
            .catch(() => setError("Network error."))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="space-y-5">
                <div className="flex items-center gap-3">
                    <div className="h-4 w-20 bg-gray-100 rounded-lg animate-pulse" />
                    <div className="h-4 w-32 bg-gray-100 rounded-lg animate-pulse" />
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 animate-pulse">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-10 bg-gray-50 rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
                    ))}
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                    <Icon icon="solar:receipt-remove-bold" width={32} className="text-red-300" />
                </div>
                <p className="text-base font-bold text-gray-500">{error || "Order not found."}</p>
                <Link href="/account/orders"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition">
                    <Icon icon="solar:arrow-left-bold" width={14} />
                    Back to Orders
                </Link>
            </div>
        );
    }

    const orderStatus   = STATUS_BADGE[order.status]         ?? STATUS_BADGE.pending;
    const paymentStatus = STATUS_BADGE[order.paymentStatus]  ?? STATUS_BADGE.pending;

    return (
        <div className="space-y-5">

            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                    <Link href="/account/orders"
                        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition shrink-0">
                        <Icon icon="solar:arrow-left-bold" width={14} />
                        <span className="hidden sm:inline">My Orders</span>
                    </Link>
                    <Icon icon="solar:alt-arrow-right-bold" width={12} className="text-gray-300 shrink-0" />
                    <h1 className="text-sm font-bold text-gray-900 font-mono truncate">{order.orderNumber}</h1>
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${orderStatus.cls}`}>
                        <Icon icon={orderStatus.icon} width={11} />
                        {orderStatus.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${paymentStatus.cls}`}>
                        {paymentStatus.label}
                    </span>
                    <span className="text-xs text-gray-400">
                        {new Date(order.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                </div>
            </div>

            {/* ── Progress tracker ── */}
            {order.status !== "cancelled" && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5">
                    {(() => {
                        const steps = ["pending", "processing", "shipped", "delivered"];
                        const current = steps.indexOf(order.status);
                        return (
                            <div className="flex items-center">
                                {steps.map((step, i) => {
                                    const done   = i <= current;
                                    const active = i === current;
                                    const s      = STATUS_BADGE[step] ?? STATUS_BADGE.pending;
                                    return (
                                        <div key={step} className="flex items-center flex-1 last:flex-none">
                                            <div className="flex flex-col items-center gap-1.5 shrink-0">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                                    done ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-300"
                                                } ${active ? "ring-4 ring-indigo-500/20 scale-110" : ""}`}>
                                                    <Icon icon={s.icon} width={15} />
                                                </div>
                                                <span className={`text-[9px] font-bold capitalize whitespace-nowrap ${done ? "text-indigo-500" : "text-gray-300"}`}>
                                                    {step}
                                                </span>
                                            </div>
                                            {i < steps.length - 1 && (
                                                <div className={`flex-1 h-0.5 mx-1.5 mb-4 rounded-full transition-all ${i < current ? "bg-indigo-500" : "bg-gray-100"}`} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Items */}
            <Card title={`Items (${order.items.length})`} icon="mdi:package-variant-closed">
                <div className="divide-y divide-gray-50">
                    {order.items.map((item, i) => (
                        <div key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                            {item.productImage ? (
                                <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                                    <Image src={item.productImage} alt={item.productTitle}
                                        fill className="object-cover" sizes="56px" />
                                </div>
                            ) : (
                                <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                                    <Icon icon="mdi:image-off" width={20} className="text-gray-300" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 line-clamp-2">{item.productTitle}</p>
                                {item.variantOptions && Object.keys(item.variantOptions).length > 0 && (
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {Object.entries(item.variantOptions).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                                    </p>
                                )}
                                {item.sku && <p className="text-xs text-gray-400">SKU: {item.sku}</p>}
                                {item.orderNote && <p className="text-xs text-gray-500 italic mt-0.5">Note: {item.orderNote}</p>}
                                <p className="text-xs text-gray-400 mt-1">×{item.quantity} @ {fmt(item.price, symbol)}</p>
                            </div>
                            <p className="text-sm font-bold text-gray-900 shrink-0">{fmt(item.subtotal, symbol)}</p>
                        </div>
                    ))}
                </div>

                {/* Totals */}
                <div className="mt-4 pt-4 border-t border-gray-50 space-y-1.5">
                    <div className="flex justify-between text-sm text-gray-500">
                        <span>Subtotal</span>
                        <span className="font-medium text-gray-700">{fmt(order.subtotal, symbol)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                        <span>Shipping <span className="text-xs">({order.shippingMethod})</span></span>
                        <span className="font-medium text-gray-700">{fmt(order.shippingCost, symbol)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-50">
                        <span>Total</span>
                        <span className="text-main">{fmt(order.total, symbol)}</span>
                    </div>
                </div>
            </Card>

            {/* Shipping address */}
            <Card title="Delivery Address" icon="mdi:map-marker-outline">
                <div className="text-sm text-gray-700 space-y-1">
                    <p className="font-semibold text-gray-900">{order.shippingAddress.name}</p>
                    {order.shippingAddress.phone && (
                        <p className="flex items-center gap-1.5 text-gray-500">
                            <Icon icon="mdi:phone-outline" width={14} />{order.shippingAddress.phone}
                        </p>
                    )}
                    {order.shippingAddress.address && <p>{order.shippingAddress.address}</p>}
                    {(order.shippingAddress.city || order.shippingAddress.state) && (
                        <p>{[order.shippingAddress.city, order.shippingAddress.state].filter(Boolean).join(", ")}</p>
                    )}
                    {order.shippingAddress.zipCode && <p>{order.shippingAddress.zipCode}</p>}
                </div>
            </Card>

            {/* Payment */}
            <Card title="Payment" icon="mdi:credit-card-outline">
                <div className="text-sm space-y-1">
                    <p className="text-gray-600">
                        Method: <span className="font-medium text-gray-800 capitalize">
                            {(order.paymentGatewayType ?? "—").replace(/_/g, " ")}
                        </span>
                    </p>
                    {order.paymentProof?.transactionId && (
                        <p className="text-gray-600">
                            Transaction ID: <span className="font-mono text-gray-800 text-xs">{order.paymentProof.transactionId}</span>
                        </p>
                    )}
                    {order.paymentProof?.proofImage && (
                        <div className="mt-2">
                            <div className="relative w-full max-w-xs aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-100">
                                <Image src={order.paymentProof.proofImage} alt="Payment proof"
                                    fill className="object-contain" />
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Timeline */}
            {order.timeline.length > 0 && (
                <Card title="Order Updates" icon="mdi:timeline-clock-outline">
                    <ol className="relative border-l border-gray-100 space-y-5 ml-3">
                        {[...order.timeline].reverse().map((entry, i) => {
                            const s = STATUS_BADGE[entry.status] ?? STATUS_BADGE.pending;
                            return (
                                <li key={i} className="ml-5">
                                    <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-gray-100 ring-4 ring-white">
                                        <Icon icon={s.icon} width={13} className="text-gray-400" />
                                    </span>
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800 capitalize">{entry.status}</p>
                                            <p className="text-sm text-gray-500 mt-0.5">{entry.note}</p>
                                        </div>
                                        <p className="text-xs text-gray-400 whitespace-nowrap shrink-0">{fmtDate(entry.createdAt)}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                </Card>
            )}

            {/* Notes */}
            {order.notes && (
                <Card title="Order Notes" icon="mdi:note-text-outline">
                    <p className="text-sm text-gray-700 whitespace-pre-line">{order.notes}</p>
                </Card>
            )}
        </div>
    );
}
