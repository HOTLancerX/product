'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import Image from 'next/image';
import Link from 'next/link';
import { getCart, updateCartItemQuantity, removeFromCart, CartItem } from '@/plugin/product/lib/cart';
import useSettings from '@/lib/useSettings';

const BADGE_KEY = 'cart_badge_count';

function getCachedCount(): number {
    if (typeof window === 'undefined') return 0;
    try { return parseInt(localStorage.getItem(BADGE_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function setCachedCount(n: number) {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(BADGE_KEY, String(n)); } catch { /* ignore */ }
}

function formatPrice(amount: number, currencySymbol: string) {
    const formatted = Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
    });
    return currencySymbol ? `${currencySymbol} ${formatted}` : formatted;
}

export type CartDisplayType = 'drawer-right' | 'drawer-left' | 'dropdown';

export default function CartExtended({
    displayType = 'drawer-right',
    fontSize = 20,
    color = '#374151',
    icon = 'mdi:cart-outline',
}: {
    displayType?: CartDisplayType;
    fontSize?: number;
    color?: string;
    icon?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [cartCount, setCartCount] = useState<number>(0);

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

    // Close dropdown on click outside
    useEffect(() => {
        if (!isOpen || displayType !== 'dropdown') return;
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, displayType]);

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

    const toggleCart = () => setIsOpen(!isOpen);

    const renderCartItems = () => {
        if (cart.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                        <Icon icon="mdi:cart-outline" width={28} height={28} />
                    </div>
                    <p className="text-sm font-medium text-gray-500">Your cart is empty</p>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-xs text-indigo-600 hover:underline mt-1 font-semibold"
                    >
                        Continue shopping
                    </button>
                </div>
            );
        }

        return (
            <div className="space-y-3">
                {cart.map((item) => {
                    const itemKey = `${item.productId}-${item.variantId || 'single'}`;
                    return (
                        <div key={itemKey} className="flex gap-2.5 p-2.5 bg-gray-50 rounded-xl border border-gray-100/80">
                            {/* Image */}
                            {item.productImage ? (
                                <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-white border border-gray-100">
                                    <Image
                                        src={item.productImage}
                                        alt={item.productTitle}
                                        fill
                                        className="object-cover"
                                        sizes="48px"
                                    />
                                </div>
                            ) : (
                                <div className="w-12 h-12 shrink-0 rounded-lg bg-gray-200 flex items-center justify-center">
                                    <Icon icon="mdi:image-off" width={18} className="text-gray-400" />
                                </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1">
                                    <h3 className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">
                                        {item.productTitle}
                                    </h3>
                                    <button
                                        onClick={() => handleRemove(item.productId, item.variantId)}
                                        className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                        aria-label={`Remove ${item.productTitle}`}
                                    >
                                        <Icon icon="mdi:close" width={12} height={12} />
                                    </button>
                                </div>

                                {item.variantOptions && Object.keys(item.variantOptions).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {Object.entries(item.variantOptions).map(([key, value]) => (
                                            <span key={key} className="text-[9px] px-1 py-0.5 bg-white border border-gray-150 rounded text-gray-500">
                                                {key}: <span className="font-medium text-gray-700">{value}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center justify-between mt-1.5">
                                    {/* Qty stepper */}
                                    <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg overflow-hidden scale-90 origin-left">
                                        <button
                                            onClick={() => handleQuantityChange(item.productId, item.variantId, item.quantity - 1)}
                                            className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                                            aria-label="Decrease quantity"
                                        >
                                            <Icon icon="mdi:minus" width={11} />
                                        </button>
                                        <span className="w-5 text-center text-xs font-semibold text-gray-800">
                                            {item.quantity}
                                        </span>
                                        <button
                                            onClick={() => handleQuantityChange(item.productId, item.variantId, item.quantity + 1)}
                                            disabled={item.quantity >= item.maxQuantity}
                                            className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-30"
                                            aria-label="Increase quantity"
                                        >
                                            <Icon icon="mdi:plus" width={11} />
                                        </button>
                                    </div>

                                    {/* Price */}
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-gray-900">
                                            {formatPrice(item.price * item.quantity, currencySymbol)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div ref={containerRef} className="relative inline-block z-100">
            {/* Styles inject */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                @keyframes slideInLeft {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .anim-fade-in { animation: fadeIn 0.2s ease-out forwards; }
                .anim-slide-right { animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .anim-slide-left { animation: slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .anim-scale-in { animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}} />

            {/* Trigger Button */}
            <button
                onClick={toggleCart}
                className="relative p-2 rounded-full hover:bg-black/5 transition-colors"
                aria-label="Shopping Cart"
            >
                <Icon icon={icon || "mdi:cart-outline"} width={fontSize || 20} height={fontSize || 20} color={color} />
                {mounted && cartCount > 0 && (
                    <span className="absolute top-0 right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                        {cartCount > 99 ? '99+' : cartCount}
                    </span>
                )}
            </button>

            {/* ── Dropdown display inline under the trigger ── */}
            {mounted && isOpen && displayType === 'dropdown' && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white shadow-2xl border border-gray-150/70 rounded-2xl z-100 flex flex-col p-4 anim-scale-in">
                    <div className="flex items-center justify-between pb-3 border-b mb-3">
                        <div className="flex items-center gap-1.5">
                            <Icon icon="mdi:cart-outline" className="text-indigo-600" width={16} />
                            <span className="text-xs font-bold text-gray-900">My Cart ({totalItems})</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                            <Icon icon="mdi:close" width={16} />
                        </button>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto pr-1">
                        {renderCartItems()}
                    </div>

                    {cart.length > 0 && (
                        <div className="border-t pt-3 mt-3 space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500 font-medium">Subtotal:</span>
                                <span className="font-bold text-gray-900">{formatPrice(subtotal, currencySymbol)}</span>
                            </div>
                            <Link
                                href="/checkout"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center justify-center gap-1.5 w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 rounded-xl transition"
                            >
                                Checkout
                                <Icon icon="mdi:arrow-right" width={14} />
                            </Link>
                        </div>
                    )}
                </div>
            )}

            {/* ── Drawer portal (left or right) ── */}
            {mounted && isOpen && displayType !== 'dropdown' && createPortal(
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-9999 anim-fade-in"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    />

                    {/* Drawer container */}
                    <div
                        role="dialog"
                        aria-label="Shopping cart"
                        className={`fixed top-0 h-full w-full max-w-sm sm:max-w-md bg-white shadow-2xl z-99999 flex flex-col ${
                            displayType === 'drawer-left' ? 'left-0 anim-slide-left' : 'right-0 anim-slide-right'
                        }`}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b bg-white shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                                    <Icon icon="mdi:cart-outline" className="text-indigo-600" width={18} height={18} />
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
                        <div className="flex-1 overflow-y-auto px-4 py-3">
                            {renderCartItems()}
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
                                    className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-3.5 rounded-2xl transition shadow-md shadow-indigo-600/10"
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
        </div>
    );
}
