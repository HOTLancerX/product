'use client';

/**
 * Product Box 2 — Minimal dark-accent card with hover overlay.
 *
 * Differences from Product-1:
 *   - Image fills the whole card; info overlays at the bottom on hover
 *   - Color swatches from variant attributes shown below the title
 *   - "Quick View" link replaces the Add to Cart button
 *     (links to the full product page)
 *   - Dark backdrop on image hover reveals title + price smoothly
 *
 * Flash-sale safety: if the flash-sale plugin is not installed the dynamic
 * import resolves to a no-op hook that returns original prices untouched.
 */

import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@iconify/react';
// ── Flash Sale integration ────────────────────────────────────────────────────
import useFlashSale from '@/plugin/flash-sale/lib/useFlashSale';

interface ProductBoxProps {
    data: {
        _id: string;
        title: string;
        slug: string;
        status: string;
        category?: string | null;
        createdAt?: string;
        info: Record<string, string>;
    };
    productUrl: string;
    currencySymbol?: string;
    /**
     * Optional: pre-resolved flash-sale campaign injected by FlashSalePage.
     * When absent the useFlashSale hook auto-fetches active campaigns.
     */
    flashSaleCampaign?: import('@/plugin/flash-sale/lib/applyFlashSale').FlashSaleCampaignRef | null;
}

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

export default function ProductBox2({ data, productUrl, currencySymbol = '$', flashSaleCampaign }: ProductBoxProps) {
    const { resolvePrice } = useFlashSale();

    const variate      = parseJson<Record<string, any>>(data.info?._variate, {});
    const priceType    = (variate.priceType ?? 'single') as string;
    const variants     = (variate.variants ?? []) as any[];
    const sellingPrice = parseFloat(variate.sellingprice ?? '0') || 0;
    const regularPrice = parseFloat(variate.regularprice ?? '0') || 0;
    const stock        = parseInt(variate.stock ?? '0', 10) || 0;

    const basePrice = priceType === 'single'
        ? (sellingPrice > 0 ? sellingPrice : regularPrice)
        : 0;
    const inStock = priceType === 'single'
        ? stock > 0
        : variants.some((v: any) => parseInt(v.quantity || '0') > 0);

    // Flash-sale price resolution (same pattern as Product-1)
    const flashResult = flashSaleCampaign
        ? ((): import('@/plugin/flash-sale/lib/applyFlashSale').FlashSaleResult => {
              const { applyFlashSale: _apply, findMatchingCampaign: _find } =
                  require('@/plugin/flash-sale/lib/applyFlashSale') as
                      typeof import('@/plugin/flash-sale/lib/applyFlashSale');
              const matched = _find([flashSaleCampaign], String(data._id), data.category ?? null);
              return _apply(basePrice, matched);
          })()
        : resolvePrice(basePrice, String(data._id), data.category ?? null);

    // ── Display price logic ───────────────────────────────────────────────────
    const hasFlash = flashResult.applied;

    const productHasDiscount = !hasFlash
        && priceType === 'single'
        && sellingPrice > 0
        && regularPrice > sellingPrice;

    const displayRegular  = hasFlash
        ? flashResult.regularPrice
        : (productHasDiscount ? regularPrice : basePrice);
    const currentPrice    = priceType === 'single'
        ? (hasFlash ? flashResult.sellingPrice : basePrice)
        : 0;
    const discountPercent = hasFlash
        ? flashResult.discountPercent
        : (productHasDiscount
            ? Math.round(((regularPrice - sellingPrice) / regularPrice) * 100)
            : 0);
    const showStrike = hasFlash || productHasDiscount;

    // First available image
    let img = '';
    for (const v of variants) {
        if (v.image) { img = v.image; break; }
    }
    if (!img) {
        const imgs = parseJson<string[]>(data.info?.images, []);
        img = imgs[0] ?? '';
    }

    // Color swatches — pick first attribute with color values or just first attribute
    const selectedAttrs = (variate.selectedAttributes ?? []) as any[];
    const swatches: { color?: string; value: string }[] = [];

    if (variants.length > 0) {
        // Build attribute value map
        const attrMap: Record<string, Set<string>> = {};
        for (const v of variants) {
            if (!v.options) continue;
            for (const [k, val] of Object.entries(v.options)) {
                if (!attrMap[k]) attrMap[k] = new Set();
                attrMap[k].add(val as string);
            }
        }

        const labels = Object.keys(attrMap).sort((a, b) => {
            const pA = selectedAttrs.find((s: any) => s.label === a)?.position ?? 0;
            const pB = selectedAttrs.find((s: any) => s.label === b)?.position ?? 0;
            return pA - pB;
        });
        void labels; // used below via targetLabel

        // Pick colour axis: explicit color displayStyle > any attr with .color values > first
        const getColor = (label: string, value: string) =>
            variants.find((v: any) => v.options && Object.values(v.options).includes(value))?.color;

        const targetLabel =
            labels.find(l => {
                const s = selectedAttrs.find((a: any) => a.label === l);
                return s?.displayStyle === 'color' || s?.displayStyle === 'color-text';
            }) ??
            labels.find(l => Array.from(attrMap[l]).some(v => !!getColor(l, v))) ??
            labels[0];        if (targetLabel) {
            const seen = new Set<string>();
            for (const value of Array.from(attrMap[targetLabel]).slice(0, 6)) {
                const color = getColor(targetLabel, value);
                const key   = color || value;
                if (seen.has(key)) continue;
                seen.add(key);
                swatches.push({ color, value });
            }
        }
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
            shippingInside: parseFloat(data.info?.shipping_inside ?? '') || undefined,
            shippingOutside: parseFloat(data.info?.shipping_outside ?? '') || undefined,
        });
    };

    return (
        <div className="group relative rounded-2xl overflow-hidden bg-gray-900 aspect-3/4 flex flex-col cursor-pointer shadow-sm hover:shadow-xl transition-shadow">

            {/* Discount badge */}
            {discountPercent > 0 && (
                <span className={`absolute top-3 left-3 z-20 text-white text-xs font-bold px-2 py-0.5 rounded-full ${hasFlash ? 'bg-rose-500' : 'bg-red-500'}`}>
                    -{discountPercent}%
                </span>
            )}

            {/* Flash sale tag icon */}
            {hasFlash && (
                <span className="absolute top-3 right-3 z-20">
                    <Icon icon="solar:tag-price-bold" width={16} className="text-rose-400" />
                </span>
            )}

            {/* Out of stock badge */}
            {!inStock && (
                <span className={`absolute z-20 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full ${discountPercent > 0 ? 'top-8 right-3' : 'top-3 right-3'}`}>
                    Out of stock
                </span>
            )}

            {/* Background image */}
            <Link href={productUrl} className="absolute inset-0 z-0">
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
                        <Icon icon="mdi:image-off" width="48" height="48" className="text-gray-300" />
                    </div>
                )}
            </Link>

            {/* Gradient overlay — always visible at bottom */}
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/90 via-black/40 to-transparent z-10 pointer-events-none" />

            {/* Info — sits above gradient */}
            <div className="relative z-20 mt-auto p-3 flex flex-col gap-2">

                {/* Color swatches */}
                {swatches.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {swatches.map(s => (
                            <span
                                key={s.value}
                                title={s.value}
                                className="w-4 h-4 rounded-full border-2 border-white/60 shadow shrink-0"
                                style={s.color ? { backgroundColor: s.color } : { backgroundColor: '#e5e7eb' }}
                            />
                        ))}
                    </div>
                )}

                {/* Title */}
                <Link href={productUrl}
                    className="text-sm font-semibold text-white hover:text-white/80 transition-colors line-clamp-2 leading-snug">
                    {data.title}
                </Link>

                {/* Price */}
                <div className="flex items-center gap-2">
                    {priceType === 'single' && currentPrice > 0 ? (
                        <>
                            <span className={`text-base font-bold ${hasFlash ? 'text-rose-300' : 'text-white'}`}>
                                {currencySymbol} {fmtPrice(currentPrice)}
                            </span>
                            {showStrike && (
                                <span className="text-xs text-white/50 line-through">
                                    {currencySymbol} {fmtPrice(displayRegular)}
                                </span>
                            )}
                        </>
                    ) : priceType === 'variant' && variants.length > 0 ? (
                        <span className="text-xs text-white/60 italic">
                            {variants.length} variant{variants.length !== 1 ? 's' : ''}
                        </span>
                    ) : null}
                </div>

                {/* Actions row — visible on hover */}
                <div className="flex gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200">
                    <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={!inStock}
                        className="flex-1 py-2 rounded-lg bg-white text-gray-900 text-xs font-bold hover:bg-white/90 disabled:bg-white/30 disabled:text-white/50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                    >
                        <Icon icon="mdi:cart-plus" width="14" height="14" />
                        {inStock ? 'Add to Cart' : 'Out of Stock'}
                    </button>
                    <Link
                        href={productUrl}
                        className="px-3 py-2 rounded-lg bg-white/20 text-white text-xs font-semibold hover:bg-white/30 transition-colors flex items-center gap-1 whitespace-nowrap"
                    >
                        <Icon icon="mdi:eye" width="14" height="14" />
                        View
                    </Link>
                </div>
            </div>
        </div>
    );
}
