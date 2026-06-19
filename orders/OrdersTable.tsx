"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

interface OrderItem {
    productTitle: string;
    quantity: number;
    subtotal: number;
}

interface Order {
    _id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    shippingAddress: { name: string; phone: string; email: string };
    items: OrderItem[];
    total: number;
    createdAt: string;
}

interface PagedOrders {
    orders: Order[];
    total: number;
    page: number;
    pages: number;
}

const ORDER_STATUSES  = ["pending", "processing", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];

const STATUS_BADGE: Record<string, string> = {
    pending:    "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300",
    processing: "bg-blue-100 text-blue-700 ring-1 ring-blue-300",
    shipped:    "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300",
    delivered:  "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300",
    cancelled:  "bg-red-100 text-red-700 ring-1 ring-red-300",
};

const PAYMENT_BADGE: Record<string, string> = {
    pending:  "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300",
    paid:     "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300",
    failed:   "bg-red-100 text-red-700 ring-1 ring-red-300",
    refunded: "bg-gray-100 text-gray-600 ring-1 ring-gray-300",
};

function fmt(n: number) {
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

interface OrdersTableProps {
    /** Pre-filter by order status. When set, the status dropdown is hidden. */
    defaultStatus?: string;
    /** Page heading */
    title?: string;
    /** Show the order-status filter dropdown (default true) */
    showStatusFilter?: boolean;
}

export default function OrdersTable({
    defaultStatus = "",
    title = "Orders",
    showStatusFilter = true,
}: OrdersTableProps) {
    const [data,          setData]    = useState<PagedOrders | null>(null);
    const [loading,       setLoading] = useState(true);
    const [page,          setPage]    = useState(1);
    const [search,        setSearch]  = useState("");
    const [statusFilter,  setStatus]  = useState(defaultStatus);
    const [paymentFilter, setPayment] = useState("");
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchOrders = useCallback(async (p: number, q: string, s: string, ps: string) => {
        setLoading(true);
        try {
            const qs = new URLSearchParams({ all: "true", page: String(p), limit: "20" });
            if (q)  qs.set("search",        q);
            if (s)  qs.set("status",        s);
            if (ps) qs.set("paymentStatus", ps);
            const res = await fetch(`/api/orders?${qs}`, { credentials: "include" });
            if (res.ok) setData(await res.json());
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    // Debounced search
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            setPage(1);
            fetchOrders(1, search, statusFilter, paymentFilter);
        }, 350);
        return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
    }, [search]);

    // Immediate re-fetch on filter / page change
    useEffect(() => {
        fetchOrders(page, search, statusFilter, paymentFilter);
    }, [page, statusFilter, paymentFilter]);

    const orders = data?.orders ?? [];

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {data ? `${data.total} order${data.total !== 1 ? "s" : ""} total` : ""}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Icon icon="solar:magnifer-linear" width={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search order #, name, email…"
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                    {search && (
                        <button onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <Icon icon="mdi:close" width={14} />
                        </button>
                    )}
                </div>

                {showStatusFilter && (
                    <select
                        value={statusFilter}
                        onChange={e => { setStatus(e.target.value); setPage(1); }}
                        className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">All statuses</option>
                        {ORDER_STATUSES.map(s => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                    </select>
                )}

                <select
                    value={paymentFilter}
                    onChange={e => { setPayment(e.target.value); setPage(1); }}
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">All payments</option>
                    {PAYMENT_STATUSES.map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                </select>

                {(search || (showStatusFilter && statusFilter) || paymentFilter) && (
                    <button
                        onClick={() => { setSearch(""); if (showStatusFilter) setStatus(""); setPayment(""); setPage(1); }}
                        className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition"
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20 text-gray-400">
                    <Icon icon="svg-spinners:ring-resize" width={32} />
                </div>
            )}

            {/* Empty */}
            {!loading && orders.length === 0 && (
                <div className="text-center py-20 text-gray-400">
                    <Icon icon="solar:receipt-outline" width={48} className="mx-auto mb-3 opacity-40" />
                    <p className="text-lg font-medium text-gray-500">No orders found</p>
                    {(search || statusFilter || paymentFilter) && (
                        <p className="text-sm mt-1">Try adjusting your search or filters.</p>
                    )}
                </div>
            )}

            {/* Table */}
            {!loading && orders.length > 0 && (
                <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm bg-white">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Order</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Customer</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Items</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Total</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Payment</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Date</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {orders.map(order => (
                                <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-800">
                                        {order.orderNumber}
                                    </td>
                                    <td className="px-5 py-3">
                                        <p className="font-medium text-gray-800 truncate max-w-[140px]">{order.shippingAddress?.name ?? "—"}</p>
                                        <p className="text-xs text-gray-400 truncate max-w-[140px]">{order.shippingAddress?.phone ?? ""}</p>
                                    </td>
                                    <td className="px-5 py-3 text-gray-500">
                                        {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                                    </td>
                                    <td className="px-5 py-3 font-semibold text-gray-800">{fmt(order.total)}</td>
                                    <td className="px-5 py-3">
                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_BADGE[order.status] ?? STATUS_BADGE.pending}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${PAYMENT_BADGE[order.paymentStatus] ?? PAYMENT_BADGE.pending}`}>
                                            {order.paymentStatus}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(order.createdAt)}</td>
                                    <td className="px-5 py-3">
                                        <Link href={`/admin/orders/${order._id}`}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition whitespace-nowrap">
                                            <Icon icon="solar:eye-bold" width={13} />
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {data && data.pages > 1 && (
                <div className="flex items-center justify-between gap-4 pt-2">
                    <p className="text-sm text-gray-500">Page {data.page} of {data.pages} — {data.total} orders</p>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            aria-label="Previous">
                            <Icon icon="mdi:chevron-left" width={18} />
                        </button>
                        <span className="text-sm font-medium text-gray-700 px-1">{page}</span>
                        <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page >= data.pages}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            aria-label="Next">
                            <Icon icon="mdi:chevron-right" width={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
