'use client';

/**
 * Product Box 1 — Clean card style.
 *
 * Used as a reusable product card in listings, category pages, and search results.
 * Receives the same `data` shape as the full product page layouts.
 *
 * Displays:
 *   - Product image (first variant image → product images → placeholder)
 *   - Category badge (optional)
 *   - Title with link to the product page
 *   - Discount badge + regular/selling price (single mode)
 *     or "Variants available" label (variant mode)
 *   - Stock status
 *   - Add to Cart button (dispatches to localStorage cart via cms_cart_updated)
 *
 * Props:
 *   data            — post + info map (from the slug page or a listing query)
 *   productUrl      — full URL to the product page (built from permalink prefix)
 *   currencySymbol  — from product settings (default "$")
 */

import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@iconify/react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductBoxProps {
    data: {
        _id: string;
        title: string;
        slug: string;
        status: string;
        createdAt?: string;
        info: Record<string, string>;
    };
    /** Full URL, e.g. /product/my-slug — built by parent from permalink map */
    productUrl: string;
    currencySymbol?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseJson<T>(raw: string | undefined, fallback: T): T {
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function fmtPrice(n: number): string {
    return Number(n).toLocaleString('en-US', {
        minimumFractionDigits: n % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
    });
}

function addToCart(item: Record<string, unknown>) {
    try {
        const raw  = localStorage.getItem('shopping_cart');
        const cart: any[] = raw ? JSON.parse(raw) : [];
        const idx  = cart.findIndex(
            (c: any) => c.productId === item.productId && c.variantId === item.variantId
        );
        const maxQty = (item.maxQuantity as number) ?? 9999;
        if (idx >= 0) {
            cart[idx].quantity = Math.min((cart[idx].quantity ?? 0) + 1, maxQty);
        } else {
            cart.push({ ...item, quantity: 1 });
        }
        localStorage.setItem('shopping_cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cartUpdated'));
    } catch { /* localStorage unavailable */ }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProductBox1({ data, productUrl, currencySymbol = '$' }: ProductBoxProps) {
    const variate      = parseJson<Record<string, any>>(data.info?._variate, {});
    const priceType    = (variate.priceType ?? 'single') as string;
    const variants     = (variate.variants ?? []) as any[];
    const sellingPrice = parseFloat(variate.sellingprice ?? '0') || 0;
    const regularPrice = parseFloat(variate.regularprice ?? '0') || 0;
    const stock        = parseInt(variate.stock ?? '0', 10) || 0;

    const currentPrice = priceType === 'single' ? (sellingPrice || regularPrice) : 0;
    const inStock      = priceType === 'single' ? stock > 0 : variants.some((v: any) => parseInt(v.quantity || '0') > 0);

    const hasDiscount     = priceType === 'single' && sellingPrice > 0 && regularPrice > sellingPrice;
    const discountPercent = hasDiscount
        ? Math.round(((regularPrice - sellingPrice) / regularPrice) * 100)
        : 0;

    // First available image
    let img = '';
    for (const v of variants) {
        if (v.image) { img = v.image; break; }
    }
    if (!img) {
        const imgs = parseJson<string[]>(data.info?.images, []);
        img = imgs[0] ?? '';
    }

    const firstVariant = variants[0];

    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!inStock) return;
        addToCart({
            productId:      String(data._id),
            productSlug:    data.slug,
            productTitle:   data.title,
            productImage:   img,
            variantId:      firstVariant?.id,
            variantOptions: firstVariant?.options,
            sku:            firstVariant?.sku,
            price:          currentPrice || parseFloat(firstVariant?.price || '0') || 0,
            maxQuantity:    stock || parseInt(firstVariant?.quantity || '0', 10) || 9999,
        });
    };

    return (
        <div className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
            {/* Discount badge */}
            {hasDiscount && (
                <span className="absolute top-3 left-3 z-10 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    -{discountPercent}%
                </span>
            )}

            {/* Image */}
            <Link href={productUrl} className="block aspect-square overflow-hidden bg-gray-50">
                {img ? (
                    <Image
                        src={img}
                        alt={data.title}
                        width={400}
                        height={400}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200">
                        <Icon icon="mdi:image-off" width="48" height="48" />
                    </div>
                )}
            </Link>

            {/* Info */}
            <div className="flex flex-col flex-1 p-3 gap-2">
                {/* Title */}
                <Link href={productUrl}
                    className="text-sm font-semibold text-gray-900 hover:text-main transition-colors line-clamp-2 leading-snug">
                    {data.title}
                </Link>

                {/* Price */}
                <div className="flex items-center gap-2 flex-wrap mt-auto">
                    {priceType === 'single' && currentPrice > 0 ? (
                        <>
                            {hasDiscount && (
                                <span className="text-xs text-gray-400 line-through">
                                    {currencySymbol} {fmtPrice(regularPrice)}
                                </span>
                            )}
                            <span className="text-base font-bold text-main">
                                {currencySymbol} {fmtPrice(currentPrice)}
                            </span>
                        </>
                    ) : priceType === 'variant' && variants.length > 0 ? (
                        <span className="text-xs text-gray-500 italic">
                            {variants.length} variant{variants.length !== 1 ? 's' : ''} available
                        </span>
                    ) : null}
                </div>

                {/* Stock */}
                {inStock ? (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                        <Icon icon="mdi:check-circle" width="13" height="13" />
                        In stock
                    </span>
                ) : (
                    <span className="text-xs text-red-400">Out of stock</span>
                )}

                {/* Add to Cart */}
                <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={!inStock}
                    className="w-full mt-1 py-2 rounded-lg bg-main text-white text-sm font-semibold hover:bg-main/80 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                >
                    <Icon icon="mdi:cart-plus" width="16" height="16" />
                    {inStock ? 'Add to Cart' : 'Out of Stock'}
                </button>
            </div>
        </div>
    );
}
