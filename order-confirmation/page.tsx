'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@iconify/react';
import useSettings from '@/lib/useSettings';

interface OrderItem {
    productId: string;
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
    paymentGatewayType: string;
    items: OrderItem[];
    shippingAddress: {
        name: string;
        phone: string;
        email: string;
        address: string;
        state: string;
        city: string;
        zipCode?: string;
    };
    shippingMethod: 'inside' | 'outside';
    shippingCost: number;
    subtotal: number;
    total: number;
    notes?: string;
    createdAt: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
    pending:    { label: 'Pending',    color: 'bg-yellow-100 text-yellow-700',  icon: 'mdi:clock-outline' },
    processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700',     icon: 'mdi:cog-outline' },
    shipped:    { label: 'Shipped',    color: 'bg-indigo-100 text-indigo-700', icon: 'mdi:truck-delivery-outline' },
    delivered:  { label: 'Delivered',  color: 'bg-green-100 text-green-700',   icon: 'mdi:check-circle-outline' },
    cancelled:  { label: 'Cancelled',  color: 'bg-red-100 text-red-700',       icon: 'mdi:close-circle-outline' },
};

const PAYMENT_MAP: Record<string, { label: string; color: string }> = {
    pending:  { label: 'Pending',  color: 'bg-yellow-100 text-yellow-700' },
    paid:     { label: 'Paid',     color: 'bg-green-100 text-green-700' },
    failed:   { label: 'Failed',   color: 'bg-red-100 text-red-700' },
    refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-700' },
};

function fmt(amount: number, symbol: string) {
    return `${symbol} ${Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
    })}`.trim();
}

export default function OrderConfirmationPage() {
    const pathname = usePathname();
    const router = useRouter();
    // Last path segment is the orderNumber: /order-confirmation/ORD-xxx → "ORD-xxx"
    const orderNumber = pathname?.split("/").filter(Boolean).pop() ?? "";
    const { settings } = useSettings();
    const currencySymbol = settings?.currency_symbol || settings?.product_currency_symbol || '';

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!orderNumber) return;
        fetch(`/api/orders/${orderNumber}`)
            .then(async (res) => {
                if (res.status === 404) { setNotFound(true); return; }
                const data = await res.json();
                setOrder(data.order ?? null);
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));
    }, [orderNumber]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] text-gray-400">
                <Icon icon="svg-spinners:ring-resize" width={36} />
            </div>
        );
    }

    if (notFound || !order) {
        return (
            <div className="container mx-auto px-4 py-20 text-center max-w-lg">
                <Icon icon="mdi:receipt-text-remove-outline" width={64} className="mx-auto mb-4 text-gray-300" />
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Order not found</h1>
                <p className="text-gray-500 mb-6">We couldn't find order <strong>{orderNumber}</strong>.</p>
                <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-main text-white rounded-lg font-medium hover:bg-main/90 transition">
                    <Icon icon="mdi:home-outline" width={18} />
                    Back to home
                </Link>
            </div>
        );
    }

    const statusInfo  = STATUS_MAP[order.status]  ?? STATUS_MAP.pending;
    const paymentInfo = PAYMENT_MAP[order.paymentStatus] ?? PAYMENT_MAP.pending;

    return (
        <div className="container mx-auto px-4 py-10 max-w-3xl">

            {/* ── Success banner ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <Icon icon="mdi:check-circle" width={36} className="text-green-500" />
                </div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Order Placed!</h1>
                <p className="text-gray-500 text-sm mb-4">
                    Thank you for your order. We'll get it ready soon.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <Icon icon="mdi:receipt-text-outline" width={16} className="text-gray-500" />
                    <span className="text-sm text-gray-500">Order number</span>
                    <span className="text-sm font-bold text-gray-900 font-mono">{order.orderNumber}</span>
                </div>

                {/* Status badges */}
                <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${statusInfo.color}`}>
                        <Icon icon={statusInfo.icon} width={14} />
                        {statusInfo.label}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${paymentInfo.color}`}>
                        <Icon icon="mdi:credit-card-outline" width={14} />
                        Payment: {paymentInfo.label}
                    </span>
                </div>
            </div>

            {/* ── Order items ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Icon icon="mdi:package-variant-closed" width={18} className="text-gray-500" />
                    Items ({order.items.length})
                </h2>
                <div className="divide-y divide-gray-50">
                    {order.items.map((item, i) => (
                        <div key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                            {item.productImage && (
                                <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                                    <Image src={item.productImage} alt={item.productTitle} fill className="object-cover" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 line-clamp-2">{item.productTitle}</p>
                                {item.variantOptions && Object.keys(item.variantOptions).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {Object.entries(item.variantOptions).map(([k, v]) => (
                                            <span key={k} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                {k}: <span className="font-medium">{v}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {item.sku && <p className="text-xs text-gray-400 mt-0.5">SKU: {item.sku}</p>}
                                {item.orderNote && (
                                    <p className="text-xs text-gray-500 mt-1 italic">Note: {item.orderNote}</p>
                                )}
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-gray-900">{fmt(item.subtotal, currencySymbol)}</p>
                                <p className="text-xs text-gray-400">×{item.quantity} @ {fmt(item.price, currencySymbol)}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Totals */}
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Subtotal</span>
                        <span className="font-medium">{fmt(order.subtotal, currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Shipping ({order.shippingMethod})</span>
                        <span className="font-medium">{fmt(order.shippingCost, currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-100">
                        <span>Total</span>
                        <span className="text-main">{fmt(order.total, currencySymbol)}</span>
                    </div>
                </div>
            </div>

            {/* ── Shipping address ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Icon icon="mdi:map-marker-outline" width={18} className="text-gray-500" />
                    Shipping Address
                </h2>
                <div className="text-sm text-gray-700 space-y-1">
                    <p className="font-semibold text-gray-900">{order.shippingAddress.name}</p>
                    {order.shippingAddress.phone && <p>{order.shippingAddress.phone}</p>}
                    {order.shippingAddress.email && <p className="text-gray-500">{order.shippingAddress.email}</p>}
                    {order.shippingAddress.address && <p>{order.shippingAddress.address}</p>}
                    {(order.shippingAddress.city || order.shippingAddress.state) && (
                        <p>{[order.shippingAddress.city, order.shippingAddress.state].filter(Boolean).join(', ')}</p>
                    )}
                    {order.shippingAddress.zipCode && <p>{order.shippingAddress.zipCode}</p>}
                </div>
            </div>

            {/* ── Payment info ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Icon icon="mdi:credit-card-outline" width={18} className="text-gray-500" />
                    Payment
                </h2>
                <p className="text-sm text-gray-700 capitalize">
                    Method: <span className="font-medium">{(order.paymentGatewayType || 'N/A').replace(/_/g, ' ')}</span>
                </p>
                {order.notes && (
                    <p className="text-sm text-gray-500 mt-2 italic">Note: {order.notes}</p>
                )}
            </div>

            {/* ── Actions ── */}
            <div className="flex flex-col sm:flex-row gap-3">
                <Link
                    href="/account/orders"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-main text-white rounded-xl font-semibold hover:bg-main/90 transition"
                >
                    <Icon icon="mdi:receipt-text-outline" width={18} />
                    View My Orders
                </Link>
                <Link
                    href="/"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition"
                >
                    <Icon icon="mdi:shopping-outline" width={18} />
                    Continue Shopping
                </Link>
            </div>
        </div>
    );
}
