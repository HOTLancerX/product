'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import Image from 'next/image';
import Link from 'next/link';
import { getCart, updateCartItemQuantity, removeFromCart, CartItem } from '@/plugin/product/lib/cart';
import useSettings from '@/lib/useSettings';

// ── Simple localStorage badge cache ───────────────────────────────────────────
// Persists the last-known cart count so the badge never flashes to 0 on revisit.
const BADGE_KEY = 'cart_badge_count';

function getCachedCount(): number {
    if (typeof window === 'undefined') return 0;
    try { return parseInt(localStorage.getItem(BADGE_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function setCachedCount(n: number) {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(BADGE_KEY, String(n)); } catch { /* ignore */ }
}

// ── Price formatter ───────────────────────────────────────────────────────────

function formatPrice(amount: number, currencySymbol: string) {
    const formatted = Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
    });
    return currencySymbol ? `${currencySymbol} ${formatted}` : formatted;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Cart({
    trigger,
    fontSize = 20,
    color = '#374151',
}: {
    trigger?: (open: () => void, cartCount: number) => React.ReactNode;
    fontSize?: number;
    color?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);

    // Initialise directly from localStorage — no skeleton flash on revisit
    const [cart, setCart] = useState<CartItem[]>(() => {
        if (typeof window === 'undefined') return [];
        return getCart();
    });

    const [cartCount, setCartCount] = useState<number>(() => {
        if (typeof window === 'undefined') return 0;
        const live = getCart().reduce((sum, item) => sum + item.quantity, 0);
        // Fall back to cached badge count to avoid flashing 0 while cart loads
        return live > 0 ? live : getCachedCount();
    });

    const [mounted, setMounted] = useState(false);
    const { settings } = useSettings();
    const currencySymbol = (settings?.product_currency_symbol || settings?.currency_symbol || '') as string;

    const updateCartState = () => {
        const currentCart = getCart();
        const count = currentCart.reduce((sum, item) => sum + item.quantity, 0);
        setCart(currentCart);
        setCartCount(count);
        setCachedCount(count);
    };

    useEffect(() => {
        setMounted(true);
        updateCartState();
        window.addEventListener('cartUpdated', updateCartState);
        return () => window.removeEventListener('cartUpdated', updateCartState);
    }, []);

    const handleQuantityChange = (productId: string, variantId: string | undefined, newQuantity: number) => {
        updateCartItemQuantity(productId, variantId, newQuantity);
        updateCartState();
    };

    const handleRemove = (productId: string, variantId: string | undefined) => {
        removeFromCart(productId, variantId);
        updateCartState();
    };

    const subtotal   = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <>
            {/* ── Trigger ── */}
            {trigger ? (
                trigger(() => setIsOpen(true), cartCount)
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    className="relative p-2 rounded-full hover:bg-black/5 transition-colors"
                    aria-label="Shopping Cart"
                >
                    <Icon icon="mdi:cart-outline" width={fontSize || 20} height={fontSize || 20} color={color} />
                    {cartCount > 0 && (
                        <span className="absolute top-0 right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                            {cartCount > 99 ? '99+' : cartCount}
                        </span>
                    )}
                </button>
            )}

            {/* ── Drawer portal (only after hydration) ── */}
            {mounted && isOpen && createPortal(
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    />

                    {/* Drawer */}
                    <div
                        role="dialog"
                        aria-label="Shopping cart"
                        className="fixed right-0 top-0 h-full w-full max-w-sm sm:max-w-md bg-white shadow-2xl z-50 flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b bg-white shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-main/10 flex items-center justify-center">
                                    <Icon icon="mdi:cart-outline" className="text-main" width={18} height={18} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-gray-900 leading-tight">My Cart</h2>
                                    <p className="text-xs text-gray-400">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                                aria-label="Close cart"
                            >
                                <Icon icon="mdi:close" width={20} height={20} />
                            </button>
                        </div>

                        {/* Items */}
                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                            {cart.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 py-16">
                                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                                        <Icon icon="mdi:cart-outline" width={36} height={36} />
                                    </div>
                                    <p className="text-base font-medium text-gray-500">Your cart is empty</p>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="text-sm text-main hover:underline"
                                    >
                                        Continue shopping
                                    </button>
                                </div>
                            ) : (
                                cart.map((item) => {
                                    const itemKey = `${item.productId}-${item.variantId || 'single'}`;
                                    return (
                                        <div key={itemKey} className="flex gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                            {/* Image */}
                                            {item.productImage ? (
                                                <div className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-white border border-gray-100">
                                                    <Image
                                                        src={item.productImage}
                                                        alt={item.productTitle}
                                                        fill
                                                        className="object-cover"
                                                        sizes="64px"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-16 h-16 shrink-0 rounded-xl bg-gray-200 flex items-center justify-center">
                                                    <Icon icon="mdi:image-off" width={24} className="text-gray-400" />
                                                </div>
                                            )}

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-1">
                                                    <h3 className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">
                                                        {item.productTitle}
                                                    </h3>
                                                    <button
                                                        onClick={() => handleRemove(item.productId, item.variantId)}
                                                        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
                                                        aria-label={`Remove ${item.productTitle}`}
                                                    >
                                                        <Icon icon="mdi:close" width={14} height={14} />
                                                    </button>
                                                </div>

                                                {item.variantOptions && Object.keys(item.variantOptions).length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {Object.entries(item.variantOptions).map(([key, value]) => (
                                                            <span key={key} className="text-[10px] px-1.5 py-0.5 bg-white border border-gray-200 rounded-md text-gray-500">
                                                                {key}: <span className="font-medium text-gray-700">{value}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {item.sku && (
                                                    <p className="text-[10px] text-gray-400 mt-0.5">SKU: {item.sku}</p>
                                                )}

                                                <div className="flex items-center justify-between mt-2">
                                                    {/* Qty stepper */}
                                                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl overflow-hidden">
                                                        <button
                                                            onClick={() => handleQuantityChange(item.productId, item.variantId, item.quantity - 1)}
                                                            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                                                            aria-label="Decrease quantity"
                                                        >
                                                            <Icon icon="mdi:minus" width={14} />
                                                        </button>
                                                        <span className="w-7 text-center text-sm font-semibold text-gray-800">
                                                            {item.quantity}
                                                        </span>
                                                        <button
                                                            onClick={() => handleQuantityChange(item.productId, item.variantId, item.quantity + 1)}
                                                            disabled={item.quantity >= item.maxQuantity}
                                                            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-30"
                                                            aria-label="Increase quantity"
                                                        >
                                                            <Icon icon="mdi:plus" width={14} />
                                                        </button>
                                                    </div>

                                                    {/* Price */}
                                                    <div className="text-right">
                                                        <div className="text-sm font-bold text-main">
                                                            {formatPrice(item.price * item.quantity, currencySymbol)}
                                                        </div>
                                                        {item.quantity > 1 && (
                                                            <div className="text-[10px] text-gray-400">
                                                                {formatPrice(item.price, currencySymbol)} each
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        {cart.length > 0 && (
                            <div className="border-t bg-white px-5 py-4 space-y-3 shrink-0">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-500">{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
                                    <div className="text-right">
                                        <span className="text-xs text-gray-400 block">Subtotal</span>
                                        <span className="text-xl font-bold text-gray-900">
                                            {formatPrice(subtotal, currencySymbol)}
                                        </span>
                                    </div>
                                </div>
                                <Link
                                    href="/checkout"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center justify-center gap-2 w-full bg-main hover:opacity-90 text-white text-sm font-semibold py-3.5 rounded-2xl transition-opacity shadow-md shadow-main/20"
                                >
                                    Proceed to Checkout
                                    <Icon icon="mdi:arrow-right" width={18} height={18} />
                                </Link>
                            </div>
                        )}
                    </div>
                </>,
                document.body
            )}
        </>
    );
}
