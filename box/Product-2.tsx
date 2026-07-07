'use client';

/**
 * plugin/product/box/Product-2.tsx
 *
 * Dark overlay card — image fills the card, info slides up on hover.
 *
 * Single mode:
 *  - Flash-sale price support
 *  - Add to Cart directly
 *
 * Variant mode:
 *  - Price range (e.g. $100 – $500)
 *  - Clickable color swatches swap the background image
 *  - "Select" button opens VariantPopup (portal, qty-aware)
 *  - "View" link to full product page
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

export default function ProductBox2({
    data,
    productUrl,
    currencySymbol = '$',
    flashSaleCampaign,
}: ProductBoxProps) {
    const { resolvePrice } = useFlashSale();

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

    const hasFlash        = flashResult.applied;
    const productHasDisc  = !hasFlash && sellingPrice > 0 && regularPrice > sellingPrice;
    const displayRegular  = hasFlash ? flashResult.regularPrice : (productHasDisc ? regularPrice : basePrice);
    const currentPrice    = hasFlash ? flashResult.sellingPrice : basePrice;
    const discountPercent = hasFlash
        ? flashResult.discountPercent
        : (productHasDisc ? Math.round(((regularPrice - sellingPrice) / regularPrice) * 100) : 0);
    const showStrike = hasFlash || productHasDisc;

    // ── Variant ───────────────────────────────────────────────────────────────
    const variantPrices = variants.map((v) => parseFloat(v.price ?? '0') || 0).filter((p) => p > 0);
    const minVarPrice   = variantPrices.length ? Math.min(...variantPrices) : 0;
    const maxVarPrice   = variantPrices.length ? Math.max(...variantPrices) : 0;
    const variantStock  = variants.reduce((s, v) => s + (parseInt(v.quantity ?? '0', 10) || 0), 0);

    const selectedAttributes: { label: string; values: string[]; displayStyle?: string }[] =
        variate.selectedAttributes ?? [];

    // Build color/swatch axis
    const colorAttr =
        selectedAttributes.find((a) => (a.displayStyle ?? '').includes('color')) ??
        selectedAttributes.find((a) => variants.some((v) => v.options[a.label] && v.color));

    type Swatch = { value: string; hex: string; image: string };
    const swatches: Swatch[] = [];
    if (colorAttr) {
        const seen = new Set<string>();
        for (const val of colorAttr.values.slice(0, 6)) {
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

    // ── Handlers ──────────────────────────────────────────────────────────────
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

    return (
        <>
            <div className="group relative rounded-2xl overflow-hidden bg-gray-900 aspect-3/4 flex flex-col cursor-pointer shadow-sm hover:shadow-2xl transition-shadow">

                {/* Badges */}
                {discountPercent > 0 && (
                    <span className={`absolute top-3 left-3 z-20 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow ${hasFlash ? 'bg-rose-500' : 'bg-red-500'}`}>
                        -{discountPercent}%
                    </span>
                )}
                {hasFlash && (
                    <span className="absolute top-3 right-3 z-20">
                        <Icon icon="solar:tag-price-bold" width={16} className="text-rose-400" />
                    </span>
                )}
                {!inStock && (
                    <span className="absolute top-3 right-3 z-20 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                        Sold Out
                    </span>
                )}

                {/* Background image */}
                <Link href={productUrl} className="absolute inset-0 z-0" tabIndex={-1}>
                    {img ? (
                        <Image
                            src={img}
                            alt={data.title}
                            fill
                            sizes="(max-width: 640px) 50vw, 25vw"
                            className="object-contain group-hover:scale-105 transition-transform duration-500 bg-gray-100"
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <Icon icon="mdi:image-off" width={48} className="text-gray-300" />
                        </div>
                    )}
                </Link>

                {/* Gradient overlay */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/90 via-black/50 to-transparent z-10 pointer-events-none" />

                {/* Info panel — above gradient */}
                <div className="relative z-20 mt-auto p-3 flex flex-col gap-2">

                    {/* Color swatches — clickable */}
                    {priceType === 'variant' && swatches.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {swatches.map((sw) => (
                                sw.hex ? (
                                    <button
                                        key={sw.value}
                                        type="button"
                                        title={sw.value}
                                        onClick={(e) => { e.preventDefault(); setActiveSwatch(sw.value); }}
                                        className={`w-5 h-5 rounded-full border-2 shrink-0 transition-all ${
                                            activeSwatch === sw.value
                                                ? 'border-white scale-110 ring-1 ring-white/60'
                                                : 'border-white/40 hover:border-white hover:scale-110'
                                        }`}
                                        style={{ backgroundColor: sw.hex }}
                                    />
                                ) : (
                                    <button
                                        key={sw.value}
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); setActiveSwatch(sw.value); }}
                                        className={`px-1.5 py-0.5 rounded text-[9px] border transition-all font-medium ${
                                            activeSwatch === sw.value
                                                ? 'bg-white text-gray-900 border-white'
                                                : 'bg-white/20 text-white border-white/30 hover:bg-white/30'
                                        }`}
                                    >
                                        {sw.value}
                                    </button>
                                )
                            ))}
                        </div>
                    )}

                    {/* Title */}
                    <Link
                        href={productUrl}
                        className="text-sm font-bold text-white hover:text-white/80 transition-colors line-clamp-2 leading-snug"
                    >
                        {data.title}
                    </Link>

                    {/* Price */}
                    <div className="flex items-center gap-2">
                        {priceType === 'single' && currentPrice > 0 ? (
                            <>
                                <span className={`text-base font-extrabold ${hasFlash ? 'text-rose-300' : 'text-white'}`}>
                                    {currencySymbol} {fmtPrice(currentPrice)}
                                </span>
                                {showStrike && (
                                    <span className="text-xs text-white/50 line-through">
                                        {currencySymbol} {fmtPrice(displayRegular)}
                                    </span>
                                )}
                            </>
                        ) : priceType === 'variant' && minVarPrice > 0 ? (
                            <span className="text-base font-extrabold text-white">
                                {minVarPrice === maxVarPrice
                                    ? `${currencySymbol} ${fmtPrice(minVarPrice)}`
                                    : `${currencySymbol} ${fmtPrice(minVarPrice)} – ${currencySymbol} ${fmtPrice(maxVarPrice)}`
                                }
                            </span>
                        ) : priceType === 'variant' ? (
                            <span className="text-xs text-white/60 italic">See options</span>
                        ) : null}
                    </div>

                    {/* Action row — slides up on hover */}
                    <div className="flex gap-2 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200">
                        <button
                            type="button"
                            onClick={priceType === 'variant'
                                ? (e) => { e.preventDefault(); if (inStock) setShowPopup(true); }
                                : handleSingleCart
                            }
                            disabled={!inStock}
                            className="flex-1 py-2 rounded-xl bg-white text-gray-900 text-xs font-bold hover:bg-white/90 disabled:bg-white/30 disabled:text-white/50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1 shadow-sm active:scale-[0.97]"
                        >
                            <Icon icon="mdi:cart-plus" width={14} />
                            {inStock
                                ? (priceType === 'variant' ? 'Select' : 'Add to Cart')
                                : 'Sold Out'
                            }
                        </button>
                        <Link
                            href={productUrl}
                            className="px-3 py-2 rounded-xl bg-white/15 backdrop-blur-sm text-white text-xs font-semibold hover:bg-white/25 transition-colors flex items-center gap-1 whitespace-nowrap border border-white/20"
                        >
                            <Icon icon="mdi:eye" width={14} />
                            View
                        </Link>
                    </div>
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
