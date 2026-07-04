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
 *   data              — post + info map (from the slug page or a listing query)
 *   productUrl        — full URL to the product page (built from permalink map)
 *   currencySymbol    — from product settings (default "$")
 *   flashSaleCampaign — optional; injected by the flash-sale plugin's page.
 *                       When present overrides price display. When absent the
 *                       useFlashSale hook handles dynamic fetch automatically.
 *
 * Flash-sale safety: if the flash-sale plugin is not installed the dynamic
 * import resolves to a no-op hook that returns original prices untouched.
 */

import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@iconify/react';
// ── Flash Sale integration (lazy — does not break if plugin absent) ────────────
import { useFlashSale, applyFlashSale } from './flashSaleOptional';

// ── Types ─────────────────────────────────────────────────────────────────────

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
    /** Full URL, e.g. /product/my-slug — built by parent from permalink map */
    productUrl: string;
    currencySymbol?: string;
    /**
     * Optional: pre-resolved flash-sale campaign (passed by FlashSalePage server
     * component to avoid a redundant client fetch). When omitted the hook fetches
     * active campaigns itself.
     */
    flashSaleCampaign?: import('./flashSaleOptional').FlashSaleCampaignFull | null;
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

export default function ProductBox1({ data, productUrl, currencySymbol = '$', flashSaleCampaign }: ProductBoxProps) {
    // ── Flash Sale hook ───────────────────────────────────────────────────────
    // Provides a resolvePrice helper. When no campaign is active (or the plugin
    // is not installed) it returns the original prices with applied=false.
    const { resolvePrice } = useFlashSale();

    const variate      = parseJson<Record<string, any>>(data.info?._variate, {});
    const priceType    = (variate.priceType ?? 'single') as string;
    const variants     = (variate.variants ?? []) as any[];
    const sellingPrice = parseFloat(variate.sellingprice ?? '0') || 0;
    const regularPrice = parseFloat(variate.regularprice ?? '0') || 0;
    const stock        = parseInt(variate.stock ?? '0', 10) || 0;

    // basePrice: always the effective selling price if set, else regular price.
    // Flash-sale % is applied to this value — the product's regularPrice is
    // never used as the calculation base when a campaign is active.
    const basePrice = priceType === 'single'
        ? (sellingPrice > 0 ? sellingPrice : regularPrice)
        : 0;
    const inStock = priceType === 'single'
        ? stock > 0
        : variants.some((v: any) => parseInt(v.quantity || '0') > 0);

    // Resolve flash-sale pricing
    // If flashSaleCampaign is provided directly (from FlashSalePage), use it;
    // otherwise let the hook compute it from the fetched campaigns.
    const flashResult = flashSaleCampaign
        ? applyFlashSale(basePrice, flashSaleCampaign)
        : resolvePrice(basePrice, String(data._id), data.category ?? null);

    // ── Display price logic ───────────────────────────────────────────────────
    // When a flash-sale is active: use only campaign-computed prices.
    // When no flash-sale: fall back to the product's own discount display
    //   (show regularPrice crossed-out if sellingPrice < regularPrice).
    const hasFlash = flashResult.applied;

    // Product-level discount (only shown when no flash-sale overrides it)
    const productHasDiscount = !hasFlash
        && priceType === 'single'
        && sellingPrice > 0
        && regularPrice > sellingPrice;

    const displayRegular  = hasFlash
        ? flashResult.regularPrice          // campaign "was" price
        : (productHasDiscount ? regularPrice : basePrice);
    const displaySelling  = hasFlash
        ? flashResult.sellingPrice          // campaign "now" price
        : basePrice;
    const discountPercent = hasFlash
        ? flashResult.discountPercent
        : (productHasDiscount
            ? Math.round(((regularPrice - sellingPrice) / regularPrice) * 100)
            : 0);
    const currentPrice = priceType === 'single' ? displaySelling : 0;
    const showStrike   = hasFlash || productHasDiscount;

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
            shippingInside: parseFloat(data.info?.shipping_inside ?? '') || undefined,
            shippingOutside: parseFloat(data.info?.shipping_outside ?? '') || undefined,
        });
    };

    return (
        <div className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
            {/* Discount badge */}
            {discountPercent > 0 && (
                <span className={`absolute top-3 left-3 z-10 text-white text-xs font-bold px-2 py-0.5 rounded-full ${hasFlash ? 'bg-rose-500' : 'bg-red-500'}`}>
                    -{discountPercent}%
                </span>
            )}
            {/* Flash sale tag icon */}
            {hasFlash && (
                <span className="absolute top-3 right-3 z-10">
                    <Icon icon="solar:tag-price-bold" width={16} className="text-rose-500" />
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
                            {showStrike && (
                                <span className="text-xs text-gray-400 line-through">
                                    {currencySymbol} {fmtPrice(displayRegular)}
                                </span>
                            )}
                            <span className={`text-base font-bold ${hasFlash ? 'text-rose-600' : 'text-main'}`}>
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
