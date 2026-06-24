"use client";

/**
 * Admin — Return Requests Manager  (/admin/orders/returns)
 *
 * Lists all return requests. Admin can approve or reject requests
 * that are in "pending_admin" status.
 * Approving cancels the order, reverses seller wallet, sets paymentStatus → refunded.
 */

import { useEffect, useState, useCallback } from "react";
import { Icon } from "@iconify/react";

interface ReturnRequest {
    _id: string;
    orderNumber: string;
    userId: string;
    userEmail: string;
    reason: string;
    returnImages?: string[];
    status: string;
    sellerNote?: string;
    adminNote?: string;
    deliveredAt: string;
    sellerRespondedAt?: string;
    adminRespondedAt?: string;
    refundProcessed: boolean;
    createdAt: string;
}

const STATUS_CLS: Record<string, string> = {
    pending_seller:    "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300",
    pending_admin:     "bg-blue-100 text-blue-700 ring-1 ring-blue-300",
    approved:          "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300",
    rejected_seller:   "bg-red-100 text-red-700 ring-1 ring-red-300",
    rejected_admin:    "bg-red-100 text-red-700 ring-1 ring-red-300",
};

const STATUS_LABEL: Record<string, string> = {
    pending_seller:  "Awaiting Seller",
    pending_admin:   "Awaiting Admin",
    approved:        "Approved",
    rejected_seller: "Rejected by Seller",
    rejected_admin:  "Rejected by Admin",
};

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
    });
}

export default function ReturnManager() {
    const [requests,     setRequests]     = useState<ReturnRequest[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [statusFilter, setStatusFilter] = useState("pending_admin");
    const [page,         setPage]         = useState(1);
    const [totalPages,   setTotalPages]   = useState(1);
    const [total,        setTotal]        = useState(0);

    const [actionItem,  setActionItem]  = useState<ReturnRequest | null>(null);
    const [adminNote,   setAdminNote]   = useState("");
    const [processing,  setProcessing]  = useState(false);
    const [actionMsg,   setActionMsg]   = useState("");

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const qs = new URLSearchParams({ page: String(page) });
            if (statusFilter) qs.set("status", statusFilter);
            const res = await fetch(`/api/returns?${qs}`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            setRequests(data.returnRequests ?? []);
            setTotal(data.total ?? 0);
            setTotalPages(data.pages ?? 1);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [page, statusFilter]);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const handleAction = async (action: "approve" | "reject") => {
        if (!actionItem) return;
        setProcessing(true);
        setActionMsg("");
        try {
            const res = await fetch("/api/returns", {
                method:      "PUT",
                credentials: "include",
                headers:     { "Content-Type": "application/json" },
                body:        JSON.stringify({ id: actionItem._id, action, note: adminNote }),
            });
            const data = await res.json();
            if (!res.ok) {
                setActionMsg(`Error: ${data.error}`);
            } else {
                setActionItem(null);
                setAdminNote("");
                fetchRequests();
            }
        } catch {
            setActionMsg("Network error.");
        } finally {
            setProcessing(false);
        }
    };

    const STATUS_FILTERS = [
        { value: "pending_admin",   label: "Awaiting Admin" },
        { value: "pending_seller",  label: "Awaiting Seller" },
        { value: "approved",        label: "Approved" },
        { value: "rejected_seller", label: "Rejected (Seller)" },
        { value: "rejected_admin",  label: "Rejected (Admin)" },
        { value: "",                label: "All" },
    ];

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Return Requests</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{total} request{total !== 1 ? "s" : ""}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {STATUS_FILTERS.map(f => (
                    <button
                        key={f.value || "all"}
                        onClick={() => { setStatusFilter(f.value); setPage(1); }}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                            statusFilter === f.value
                                ? "bg-indigo-500 text-white"
                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-gray-300">
                    <Icon icon="svg-spinners:ring-resize" width={32} />
                </div>
            ) : requests.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    <Icon icon="solar:box-minimalistic-outline" width={48} className="mx-auto mb-3 opacity-40" />
                    <p className="text-lg font-medium">No return requests</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm bg-white">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Order</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Buyer</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Reason</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Delivered</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Requested</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {requests.map(r => (
                                <tr key={r._id} className="hover:bg-gray-50 transition">
                                    <td className="px-5 py-3 font-mono text-xs font-bold text-gray-800">
                                        {r.orderNumber}
                                    </td>
                                    <td className="px-5 py-3">
                                        <p className="text-xs text-gray-500">{r.userEmail}</p>
                                    </td>
                                    <td className="px-5 py-3 text-gray-600 max-w-[200px]">
                                        <p className="truncate">{r.reason}</p>
                                        {r.sellerNote && (
                                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                                                Seller: {r.sellerNote}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                                        {fmtDate(r.deliveredAt)}
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CLS[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                                            {STATUS_LABEL[r.status] ?? r.status}
                                        </span>
                                        {r.refundProcessed && (
                                            <p className="text-xs text-emerald-600 mt-0.5">Refund processed</p>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                                        {fmtDate(r.createdAt)}
                                    </td>
                                    <td className="px-5 py-3">
                                        {r.status === "pending_admin" && (
                                            <button
                                                onClick={() => { setActionItem(r); setAdminNote(""); setActionMsg(""); }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
                                            >
                                                <Icon icon="solar:eye-bold" width={13} /> Review
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 pt-2">
                    <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition">
                            <Icon icon="mdi:chevron-left" width={18} />
                        </button>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition">
                            <Icon icon="mdi:chevron-right" width={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {actionItem && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
                    onClick={e => { if (e.target === e.currentTarget) setActionItem(null); }}
                >
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900">Review Return Request</h2>
                            <button onClick={() => setActionItem(null)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                                <Icon icon="mdi:close" width={18} />
                            </button>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Order</span>
                                <span className="font-mono font-bold text-gray-900">{actionItem.orderNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Buyer</span>
                                <span className="text-gray-800">{actionItem.userEmail}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-gray-500 shrink-0">Reason</span>
                                <span className="text-gray-800 text-right">{actionItem.reason}</span>
                            </div>
                            {actionItem.sellerNote && (
                                <div className="flex justify-between gap-4">
                                    <span className="text-gray-500 shrink-0">Seller Note</span>
                                    <span className="text-gray-800 text-right">{actionItem.sellerNote}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-500">Delivered</span>
                                <span className="text-gray-600">{fmtDate(actionItem.deliveredAt)}</span>
                            </div>
                        </div>

                        {/* Warning about what approval does */}
                        <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                            <Icon icon="solar:danger-triangle-bold" width={15} className="shrink-0 mt-0.5" />
                            <p>
                                Approving will <strong>cancel the order</strong>, set payment status to{" "}
                                <strong>Refunded</strong>, and <strong>reverse the seller&apos;s wallet balance</strong>{" "}
                                for this order.
                            </p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700">
                                Admin Note <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <textarea
                                rows={2}
                                value={adminNote}
                                onChange={e => setAdminNote(e.target.value)}
                                placeholder="Reason, reference number…"
                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            />
                        </div>

                        {actionMsg && (
                            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{actionMsg}</p>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => handleAction("approve")}
                                disabled={processing}
                                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition"
                            >
                                {processing ? "Processing…" : "✓ Approve & Refund"}
                            </button>
                            <button
                                onClick={() => handleAction("reject")}
                                disabled={processing}
                                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition"
                            >
                                ✕ Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
