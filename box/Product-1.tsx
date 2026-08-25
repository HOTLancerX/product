'use client';

/**
 * plugin/product/box/Product-1.tsx
 *
 * Clean product card — image top, info below.
 *
 * Single mode:
 *  - Discount badge, selling/regular price, stock indicator, Add to Cart
 *  - Flash-sale price override when campaign is active
 *
 * Variant mode:
 *  - Price range displayed (e.g. $100 – $500)
 *  - Color swatches below title (max 5 + overflow count)
 *    Clicking a swatch swaps the preview image
 *  - "Select Options" opens VariantPopup (portal, qty-aware)
 */

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import { useFlashSale, applyFlashSale } from './flashSaleOptional';
import VariantPopup, { type VariantData } from './VariantPopup';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductBoxProps {
    data: {
        _id:       string;
        title:     string;
        slug:      string;
        status:    string;
        category?: string | null;
        createdAt?: string;
        info:      Record<string, string>;
    };
    productUrl:        string;
    currencySymbol?:   string;
    flashSaleCampaign?: import('./flashSaleOptional').FlashSaleCampaignFull | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function addToCartDirect(item: Record<string, unknown>) {
    try {
        const raw    = localStorage.getItem('shopping_cart');
        const cart: any[] = raw ? JSON.parse(raw) : [];
        const idx    = cart.findIndex(
            (c: any) => c.productId === item.productId && c.variantId === item.variantId
        );
        const maxQty = (item.maxQuantity as number) ?? 9999;
        const addQty = Math.max(1, (item.quantity as number) || 1);
        if (idx >= 0) {
            cart[idx].quantity = Math.min((cart[idx].quantity ?? 0) + addQty, maxQty);
        } else {
            cart.push({ ...item, quantity: Math.min(addQty, maxQty) });
        }
        localStorage.setItem('shopping_cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cartUpdated'));
    } catch { /* localStorage unavailable */ }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductBox1({
    data,
    productUrl,
    currencySymbol = '$',
    flashSaleCampaign,
}: ProductBoxProps) {
    const { resolvePrice } = useFlashSale();
    const slug = data?.slug || String(data?._id || '');
    const finalProductUrl = productUrl || `/product/${slug}`;

    const variate   = parseJson<Record<string, any>>(data.info?._variate, {});
    const priceType = (variate.priceType ?? 'single') as 'single' | 'variant';
    const variants  = (variate.variants ?? []) as VariantData[];

    // ── Single ────────────────────────────────────────────────────────────────
    const sellingPrice = parseFloat(variate.sellingprice ?? '0') || 0;
    const regularPrice = parseFloat(variate.regularprice ?? '0') || 0;
    const singleStock  = parseInt(variate.stock ?? '0', 10) || 0;
    const basePrice    = sellingPrice > 0 ? sellingPrice : regularPrice;

    const flashResult = flashSaleCampaign
        ? applyFlashSale(basePrice, flashSaleCampaign)
        : resolvePrice(basePrice, String(data._id), data.category ?? null);

    const hasFlash          = flashResult.applied;
    const productHasDisc    = !hasFlash && sellingPrice > 0 && regularPrice > sellingPrice;
    const displayRegular    = hasFlash ? flashResult.regularPrice : (productHasDisc ? regularPrice : basePrice);
    const displaySelling    = hasFlash ? flashResult.sellingPrice : basePrice;
    const discountPercent   = hasFlash
        ? flashResult.discountPercent
        : (productHasDisc ? Math.round(((regularPrice - sellingPrice) / regularPrice) * 100) : 0);
    const currentPrice      = priceType === 'single' ? displaySelling : 0;
    const showStrike        = hasFlash || productHasDisc;

    // ── Variant ───────────────────────────────────────────────────────────────
    const variantPrices = variants.map((v) => parseFloat(v.price ?? '0') || 0).filter((p) => p > 0);
    const minVarPrice   = variantPrices.length ? Math.min(...variantPrices) : 0;
    const maxVarPrice   = variantPrices.length ? Math.max(...variantPrices) : 0;
    const variantStock  = variants.reduce((s, v) => s + (parseInt(v.quantity ?? '0', 10) || 0), 0);

    const selectedAttributes: { label: string; values: string[]; displayStyle?: string }[] =
        variate.selectedAttributes ?? [];

    const colorAttr =
        selectedAttributes.find((a) => (a.displayStyle ?? '').includes('color')) ??
        selectedAttributes.find((a) => variants.some((v) => v.options[a.label] && v.color));

    type Swatch = { value: string; hex: string; image: string };
    const swatches: Swatch[] = [];
    if (colorAttr) {
        const seen = new Set<string>();
        for (const val of colorAttr.values) {
            if (seen.has(val)) continue;
            seen.add(val);
            const m = variants.find((v) => v.options[colorAttr.label] === val);
            swatches.push({ value: val, hex: m?.color ?? '', image: m?.image ?? '' });
        }
    }

    // ── State ─────────────────────────────────────────────────────────────────
    const [activeSwatch, setActiveSwatch] = useState<string | null>(swatches[0]?.value ?? null);
    const [showPopup, setShowPopup]       = useState(false);

    // Resolve display image
    let img = '';
    if (priceType === 'variant' && activeSwatch && colorAttr) {
        img = variants.find((v) => v.options[colorAttr.label] === activeSwatch)?.image ?? '';
    }
    if (!img) { for (const v of variants) { if (v.image) { img = v.image; break; } } }
    if (!img) { img = parseJson<string[]>(data.info?.images, [])[0] ?? ''; }

    const inStock = priceType === 'single' ? singleStock > 0 : variantStock > 0;

    // ── Cart handlers ─────────────────────────────────────────────────────────
    const handleSingleCart = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!inStock) return;
        addToCartDirect({
            productId:       String(data._id),
            productSlug:     data.slug,
            productTitle:    data.title,
            productImage:    img,
            price:           currentPrice,
            maxQuantity:     singleStock,
            shippingInside:  parseFloat(data.info?.shipping_inside ?? '') || undefined,
            shippingOutside: parseFloat(data.info?.shipping_outside ?? '') || undefined,
        });
    };

    const handleVariantCart = (variant: VariantData, qty: number) => {
        addToCartDirect({
            productId:       String(data._id),
            productSlug:     data.slug,
            productTitle:    data.title,
            productImage:    variant.image || img,
            variantId:       variant.id,
            variantOptions:  variant.options,
            sku:             variant.sku,
            price:           parseFloat(variant.price ?? '0') || 0,
            maxQuantity:     parseInt(variant.quantity ?? '0', 10) || 9999,
            quantity:        qty,
            shippingInside:  parseFloat(data.info?.shipping_inside ?? '') || undefined,
            shippingOutside: parseFloat(data.info?.shipping_outside ?? '') || undefined,
        });
    };

    const MAX_SW      = 5;
    const visibleSw   = swatches.slice(0, MAX_SW);
    const extraSw     = swatches.length - MAX_SW;

    return (
        <>
            <div className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">

                {/* Badges */}
                {discountPercent > 0 && (
                    <span className={`absolute top-3 left-3 z-10 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow ${hasFlash ? 'bg-rose-500' : 'bg-red-500'}`}>
                        -{discountPercent}%
                    </span>
                )}
                {hasFlash && (
                    <span className="absolute top-3 right-3 z-10">
                        <Icon icon="solar:tag-price-bold" width={16} className="text-rose-500" />
                    </span>
                )}
                {!inStock && (
                    <span className="absolute top-3 right-3 z-10 bg-gray-600/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        Sold Out
                    </span>
                )}

                {/* Image */}
                <Link href={finalProductUrl} className="block aspect-square overflow-hidden bg-gray-50" tabIndex={-1}>
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
                            <Icon icon="mdi:image-off" width={48} />
                        </div>
                    )}
                </Link>

                {/* Body */}
                <div className="flex flex-col flex-1 p-3 gap-2">

                    {/* Title */}
                    <Link
                        href={finalProductUrl}
                        className="text-sm font-semibold text-gray-900 hover:text-main transition-colors line-clamp-2 leading-snug"
                    >
                        {data.title}
                    </Link>

                    {/* Price */}
                    <div className="flex items-center gap-2 flex-wrap mt-auto">
                        {priceType === 'single' ? (
                            currentPrice > 0 && (
                                <>
                                    {showStrike && (
                                        <span className="text-xs text-gray-400 line-through">
                                            {currencySymbol} {fmtPrice(displayRegular)}
                                        </span>
                                    )}
                                    <span className={`text-base font-bold ${hasFlash ? 'text-rose-600' : 'text-main'}`}>
                                        {currencySymbol} {fmtPrice(currentPrice)}
                                    </span>
                                </>
                            )
                        ) : (
                            minVarPrice > 0 ? (
                                <span className="text-base font-bold text-main">
                                    {minVarPrice === maxVarPrice
                                        ? `${currencySymbol} ${fmtPrice(minVarPrice)}`
                                        : `${currencySymbol} ${fmtPrice(minVarPrice)} – ${currencySymbol} ${fmtPrice(maxVarPrice)}`
                                    }
                                </span>
                            ) : (
                                <span className="text-xs text-gray-400 italic">See options</span>
                            )
                        )}
                    </div>

                    {/* Color swatches (variant) */}
                    {priceType === 'variant' && visibleSw.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {visibleSw.map((sw) => (
                                sw.hex ? (
                                    <button
                                        key={sw.value}
                                        type="button"
                                        title={sw.value}
                                        onClick={(e) => { e.preventDefault(); setActiveSwatch(sw.value); }}
                                        className={`w-5 h-5 rounded-full border-2 shrink-0 transition-all ${
                                            activeSwatch === sw.value
                                                ? 'border-main scale-110 ring-1 ring-main/40'
                                                : 'border-white shadow-sm hover:scale-105 hover:border-main/50'
                                        }`}
                                        style={{ backgroundColor: sw.hex }}
                                    />
                                ) : (
                                    <button
                                        key={sw.value}
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); setActiveSwatch(sw.value); }}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-all ${
                                            activeSwatch === sw.value
                                                ? 'bg-main text-white border-main'
                                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-main'
                                        }`}
                                    >
                                        {sw.value}
                                    </button>
                                )
                            ))}
                            {extraSw > 0 && (
                                <span className="text-[10px] text-gray-400">+{extraSw}</span>
                            )}
                        </div>
                    )}

                    {/* Stock indicator (single only) */}
                    {priceType === 'single' && (
                        <span className={`text-xs flex items-center gap-1 ${inStock ? 'text-green-600' : 'text-red-400'}`}>
                            <Icon icon={inStock ? 'mdi:check-circle' : 'mdi:close-circle'} width={13} />
                            {inStock ? 'In stock' : 'Out of stock'}
                        </span>
                    )}

                    {/* CTA */}
                    <button
                        type="button"
                        onClick={priceType === 'variant'
                            ? (e) => { e.preventDefault(); if (inStock) setShowPopup(true); }
                            : handleSingleCart
                        }
                        disabled={!inStock}
                        className="w-full mt-1 py-2 rounded-xl bg-main text-white text-sm font-bold hover:opacity-90 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-main/20 active:scale-[0.98]"
                    >
                        <Icon icon="mdi:cart-plus" width={16} />
                        {inStock
                            ? (priceType === 'variant' ? 'Select Options' : 'Add to Cart')
                            : 'Out of Stock'
                        }
                    </button>
                </div>
            </div>

            {/* Variant popup */}
            {showPopup && priceType === 'variant' && (
                <VariantPopup
                    productId={String(data._id)}
                    productSlug={data.slug}
                    productTitle={data.title}
                    productImage={img}
                    variants={variants}
                    selectedAttributes={selectedAttributes}
                    currencySymbol={currencySymbol}
                    onClose={() => setShowPopup(false)}
                    onAddToCart={handleVariantCart}
                />
            )}
        </>
    );
}
