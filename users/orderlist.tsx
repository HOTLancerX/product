"use client";

/**
 * User account — My Orders  (/account/orders)
 *
 * Fetches the logged-in user's orders from GET /api/orders.
 * No admin controls — read-only, links to order detail.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import useSettings from "@/lib/useSettings";

interface OrderItem {
    productTitle: string;
    productImage?: string;
    quantity: number;
    price: number;
    subtotal: number;
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

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: string }> = {
    pending:    { label: "Pending",    cls: "bg-yellow-100 text-yellow-700",  icon: "mdi:clock-outline" },
    processing: { label: "Processing", cls: "bg-blue-100 text-blue-700",     icon: "mdi:cog-outline" },
    shipped:    { label: "Shipped",    cls: "bg-indigo-100 text-indigo-700", icon: "mdi:truck-delivery-outline" },
    delivered:  { label: "Delivered",  cls: "bg-emerald-100 text-emerald-700", icon: "mdi:check-circle-outline" },
    cancelled:  { label: "Cancelled",  cls: "bg-red-100 text-red-700",       icon: "mdi:close-circle-outline" },
};

const PAYMENT_BADGE: Record<string, { label: string; cls: string }> = {
    pending:  { label: "Unpaid",    cls: "bg-yellow-100 text-yellow-700" },
    paid:     { label: "Paid",      cls: "bg-emerald-100 text-emerald-700" },
    failed:   { label: "Failed",    cls: "bg-red-100 text-red-700" },
    refunded: { label: "Refunded",  cls: "bg-gray-100 text-gray-600" },
};

function fmt(n: number, symbol: string) {
    return `${symbol} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`.trim();
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function UserOrderList() {
    const { settings } = useSettings();
    const symbol = (settings?.product_currency_symbol || settings?.currency_symbol || "") as string;

    const [data,    setData]    = useState<PagedOrders | null>(null);
    const [loading, setLoading] = useState(true);
    const [page,    setPage]    = useState(1);
    const [status,  setStatus]  = useState("");

    const fetchOrders = async (p: number, s: string) => {
        setLoading(true);
        try {
            const qs = new URLSearchParams({ page: String(p), limit: "10" });
            if (s) qs.set("status", s);
            const res = await fetch(`/api/orders?${qs}`, { credentials: "include" });
            if (res.ok) setData(await res.json());
        } catch { /* silent */ }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchOrders(page, status); }, [page, status]);

    const orders = data?.orders ?? [];

    return (
        <div className="space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
                    {data && <p className="text-sm text-gray-400 mt-0.5">{data.total} order{data.total !== 1 ? "s" : ""}</p>}
                </div>
                <select
                    value={status}
                    onChange={e => { setStatus(e.target.value); setPage(1); }}
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-main"
                >
                    <option value="">All statuses</option>
                    {Object.entries(STATUS_BADGE).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20 text-gray-300">
                    <Icon icon="svg-spinners:ring-resize" width={32} />
                </div>
            )}

            {/* Empty */}
            {!loading && orders.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
                    <Icon icon="solar:bag-outline" width={52} className="mx-auto mb-4 text-gray-200" />
                    <p className="text-base font-semibold text-gray-500">No orders yet</p>
                    <p className="text-sm text-gray-400 mt-1 mb-6">
                        {status ? "No orders match this filter." : "You haven't placed any orders."}
                    </p>
                    <Link href="/"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-main text-white rounded-xl text-sm font-semibold hover:opacity-90 transition">
                        <Icon icon="mdi:shopping-outline" width={16} />
                        Start Shopping
                    </Link>
                </div>
            )}

            {/* Order cards */}
            {!loading && orders.map(order => {
                const s  = STATUS_BADGE[order.status]  ?? STATUS_BADGE.pending;
                const ps = PAYMENT_BADGE[order.paymentStatus] ?? PAYMENT_BADGE.pending;
                const firstItem = order.items[0];
                const more = order.items.length - 1;

                return (
                    <div key={order._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {/* Card header */}
                        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-50 flex-wrap">
                            <div className="flex items-center gap-2">
                                <Icon icon="mdi:receipt-text-outline" width={16} className="text-gray-400" />
                                <span className="text-sm font-bold font-mono text-gray-800">{order.orderNumber}</span>
                                <span className="text-xs text-gray-400">{fmtDate(order.createdAt)}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>
                                    <Icon icon={s.icon} width={12} />
                                    {s.label}
                                </span>
                                <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${ps.cls}`}>
                                    {ps.label}
                                </span>
                                <span className="text-sm font-bold text-gray-900">{fmt(order.total, symbol)}</span>
                            </div>
                        </div>

                        {/* Item preview */}
                        <div className="flex items-center gap-4 px-5 py-4">
                            {firstItem?.productImage ? (
                                <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                                    <Image src={firstItem.productImage} alt={firstItem.productTitle}
                                        fill className="object-cover" sizes="56px" />
                                </div>
                            ) : (
                                <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                                    <Icon icon="mdi:package-variant" width={24} className="text-gray-300" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">{firstItem?.productTitle ?? "—"}</p>
                                {more > 0 && (
                                    <p className="text-xs text-gray-400 mt-0.5">+{more} more item{more !== 1 ? "s" : ""}</p>
                                )}
                            </div>
                            <Link
                                href={`/account/orders/${order._id}`}
                                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-main/10 text-main hover:bg-main/20 transition"
                            >
                                Details
                                <Icon icon="mdi:arrow-right" width={14} />
                            </Link>
                        </div>
                    </div>
                );
            })}

            {/* Pagination */}
            {data && data.pages > 1 && (
                <div className="flex items-center justify-center gap-3">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                        className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition"
                        aria-label="Previous">
                        <Icon icon="mdi:chevron-left" width={18} />
                    </button>
                    <span className="text-sm text-gray-600">Page {page} of {data.pages}</span>
                    <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page >= data.pages}
                        className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition"
                        aria-label="Next">
                        <Icon icon="mdi:chevron-right" width={18} />
                    </button>
                </div>
            )}
        </div>
    );
}
