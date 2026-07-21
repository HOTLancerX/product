'use client';

/**
 * ProductClient.tsx — Interactive product page shell.
 *
 * layout={1} → clean light theme (Layout1)
 * layout={2} → dark emerald theme (Layout2)
 *
 * Rule: title, variants, quantity, and cart buttons are ALWAYS rendered.
 * Price and stock badges are only shown when the values are > 0.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import { useToast } from '@/components/ui/Toast';
import Slider from './Slider';
import Variant from './Variant';
import Specification from './Specification';
import type { ComponentType } from 'react';
import { resolveLazyComponent } from '@/hook/pluginHooks';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProductClientProps {
    layout: 1 | 2;
    data: { id: string; title: string; slug: string };
    /** MongoDB _id — used by the flash-sale hook to match campaigns */
    productId?: string;
    /** Category _id — used by the flash-sale hook for category-wise campaigns */
    categoryId?: string | null;
    priceType: 'single' | 'variant';
    regularPrice: number;
    sellingPrice: number;
    displayPrice: number;
    hasDiscount: boolean;
    discountPercent: number;
    singleStock: number;
    variants: any[];
    selectedAttributes: any[];
    variantDisplayStyle: string;
    allImages: string[];
    specifications: any[];
    compareIds: string[];
    currencySymbol: string;
    whatsappNumber: string;
    telegramUsername: string;
    facebookPageId: string;
    shortDescription: string;
    description: string;
    htmlDescription: string;
    orderNote: string;
    shippingInside?: number;
    shippingOutside?: number;
    /** Category breadcrumb — root to leaf, each with title + url */
    categoryLinks?: { title: string; url: string }[];
    /** Seller info — injected server-side from PostInfo userId → User */
    seller?: {
        _id: string; name: string; image: string; slug: string;
        city: string; state: string; bio: string; website: string;
        twitter: string; profileUrl: string;
    } | null;
    /**
     * Compare products — pre-selected in admin form, injected server-side.
     * null = compare plugin not active.
     */
    compareProducts?: any[] | null;
    /** All products in same category — for the compare swap dropdown. */
    categoryProducts?: any[] | null;
    /**
     * Active flash-sale campaign matching this product — injected server-side.
     * null = no active campaign or flash-sale plugin not active.
     */
    flashSaleCampaign?: any | null;
}

interface ShellProps {
    data: { id: string; title: string; slug: string };
    priceType: string;
    regularPrice: number;
    hasDiscount: boolean;
    discountPercent: number;
    currentPrice: number;
    currentStock: number;
    quantity: number;
    noteValue: string;
    setNoteValue: (v: string) => void;
    dec: () => void;
    inc: () => void;
    setQuantity: (v: number) => void;
    gallery: string[];
    attributes: any[];
    selectedOptions: Record<string, string>;
    selectedVariant: any;
    variantDisplayStyle: string;
    handleOptionSelect: (label: string, value: string) => void;
    handleAddToCart: () => void;
    handleBuyNow: () => void;
    handleSocial: (platform: 'whatsapp' | 'messenger' | 'telegram') => void;
    socialCount: number;
    whatsappNumber: string;
    facebookPageId: string;
    telegramUsername: string;
    shortDescription: string;
    orderNote: string;
    currencySymbol: string;
    variants: any[];
    categoryLinks: { title: string; url: string }[];
    /** Flash-sale campaign that matched this product, or null */
    flashSaleBanner?: any | null;
}

// ── Cart ──────────────────────────────────────────────────────────────────────

interface CartItem {
    productId: string;
    productSlug: string;
    productTitle: string;
    productImage: string;
    variantId?: string;
    variantOptions?: Record<string, string>;
    sku?: string;
    price: number;
    quantity: number;
    maxQuantity: number;
    shippingInside?: number;
    shippingOutside?: number;
}

function addToCart(item: CartItem) {
    try {
        const raw  = localStorage.getItem('shopping_cart');
        const cart: CartItem[] = raw ? JSON.parse(raw) : [];
        const idx  = cart.findIndex(
            (c) => c.productId === item.productId && c.variantId === item.variantId
        );
        if (idx >= 0) {
            cart[idx].quantity = Math.min(cart[idx].quantity + item.quantity, item.maxQuantity);
        } else {
            cart.push(item);
        }
        localStorage.setItem('shopping_cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cartUpdated'));
    } catch { /* localStorage unavailable */ }
}

// ── Attribute builder ─────────────────────────────────────────────────────────

function buildAttributes(variants: any[], selectedAttributes: any[]) {
    if (!variants?.length) return [];

    const attrMap: Record<string, Set<string>> = {};
    variants.forEach((v: any) => {
        if (!v.options) return;
        Object.entries(v.options).forEach(([key, value]) => {
            if (!attrMap[key]) attrMap[key] = new Set();
            attrMap[key].add(value as string);
        });
    });

    if (selectedAttributes?.length > 0) {
        return [...selectedAttributes]
            .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
            .filter((sa: any) => attrMap[sa.label])
            .map((sa: any) => {
                const saved = (sa.values || []).filter((v: string) => attrMap[sa.label]?.has(v));
                const extra = Array.from(attrMap[sa.label] || []).filter((v) => !saved.includes(v));
                return { label: sa.label, values: [...saved, ...extra], displayStyle: sa.displayStyle, position: sa.position };
            });
    }

    return Object.entries(attrMap).map(([label, values]) => ({
        label, values: Array.from(values),
    }));
}

function fmtPrice(n: number) {
    return Number(n).toLocaleString('en-US', {
        minimumFractionDigits: n % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
    });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProductClient({
    layout,
    data,
    productId,
    categoryId,
    priceType,
    regularPrice,
    displayPrice,
    hasDiscount,
    discountPercent,
    singleStock,
    variants,
    selectedAttributes,
    variantDisplayStyle,
    allImages,
    specifications,
    compareIds,
    currencySymbol,
    whatsappNumber,
    telegramUsername,
    facebookPageId,
    shortDescription,
    description,
    htmlDescription,
    orderNote,
    shippingInside,
    shippingOutside,
    categoryLinks = [],
    seller = null,
    compareProducts = null,
    categoryProducts = null,
    flashSaleCampaign = null,
}: ProductClientProps) {
    const { success, error } = useToast();

    // ── Flash Sale — resolved from server-injected prop ───────────────────────
    // applyFlashSale is a pure sync computation — no client fetch needed.
    const hasFlash = !!flashSaleCampaign;
    const effectivePrice       = hasFlash
        ? (flashSaleCampaign.saleType === "fake"
            ? displayPrice
            : Math.round(displayPrice * (1 - flashSaleCampaign.percentage / 100) * 100) / 100)
        : displayPrice;
    const effectiveRegular     = hasFlash
        ? (flashSaleCampaign.saleType === "fake"
            ? Math.round(displayPrice * (1 + flashSaleCampaign.percentage / 100) * 100) / 100
            : displayPrice)
        : regularPrice;
    const effectiveDiscount    = hasFlash
        ? (flashSaleCampaign.saleType === "fake"
            ? Math.round(((effectiveRegular - effectivePrice) / effectiveRegular) * 100)
            : flashSaleCampaign.percentage)
        : discountPercent;
    const effectiveHasDiscount = hasFlash || hasDiscount;

    // ── Variant selection ─────────────────────────────────────────────────────
    const [selectedVariant, setSelectedVariant] = useState<any>(
        () => variants[0] ?? null
    );
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
        () => variants[0]?.options ? { ...variants[0].options } : {}
    );

    const attributes = useMemo(
        () => buildAttributes(variants, selectedAttributes),
        [variants, selectedAttributes]
    );

    const findVariantByOptions = useCallback(
        (opts: Record<string, string>) =>
            variants.find((v: any) => {
                if (!v.options) return false;
                return Object.entries(opts).every(([k, val]) => v.options[k] === val);
            }) ?? null,
        [variants]
    );

    const handleOptionSelect = (label: string, value: string) => {
        const next = { ...selectedOptions, [label]: value };
        setSelectedOptions(next);
        const variant = findVariantByOptions(next);
        if (variant) setSelectedVariant(variant);
    };

    // ── Gallery ───────────────────────────────────────────────────────────────
    const gallery = useMemo(() => {
        const imgs: string[] = [];
        if (selectedVariant?.gallery?.length) imgs.push(...selectedVariant.gallery);
        if (selectedVariant?.image)           imgs.push(selectedVariant.image);
        if (imgs.length === 0)                imgs.push(...allImages);
        return [...new Set(imgs)].filter(Boolean);
    }, [selectedVariant, allImages]);

    // ── Price & stock ─────────────────────────────────────────────────────────
    const currentPrice = useMemo(() => {
        if (priceType === 'single') return effectivePrice;
        if (!selectedVariant)       return 0;
        // Handle tiered pricing: pick the tier matching current quantity
        if (selectedVariant.priceTiers?.length > 0) {
            const tier = selectedVariant.priceTiers.find((t: any) => {
                const start = parseInt(t.rangeStart) || 0;
                const end   = t.rangeEnd === '' ? Infinity : (parseInt(t.rangeEnd) || Infinity);
                return 1 >= start && 1 <= end;
            });
            if (tier) return parseFloat(tier.price) || 0;
        }
        return parseFloat(selectedVariant.price || '0') || 0;
    }, [priceType, effectivePrice, selectedVariant]);

    const currentStock = useMemo(() => {
        if (priceType === 'single') return singleStock;
        if (!selectedVariant)       return 0;
        return parseInt(selectedVariant.quantity || '0', 10) || 0;
    }, [priceType, singleStock, selectedVariant]);

    // ── Quantity ──────────────────────────────────────────────────────────────
    const [quantity, setQuantity]   = useState(1);
    const [noteValue, setNoteValue] = useState('');

    const dec = () => setQuantity((q) => Math.max(1, q - 1));
    const inc = () => setQuantity((q) => Math.min(currentStock || 9999, q + 1));

    // ── Cart ──────────────────────────────────────────────────────────────────
    const makeCartItem = (): CartItem => ({
        productId:      data.id,
        productSlug:    data.slug,
        productTitle:   data.title,
        productImage:   gallery[0] ?? '',
        variantId:      selectedVariant?.id,
        variantOptions: selectedVariant?.options,
        sku:            selectedVariant?.sku,
        price:          currentPrice,
        quantity,
        maxQuantity:    currentStock || 9999,
        shippingInside: shippingInside ?? undefined,
        shippingOutside: shippingOutside ?? undefined,
    });

    const handleAddToCart = () => {
        if (priceType === 'variant' && !selectedVariant) {
            error('Please select product options');
            return;
        }
        addToCart(makeCartItem());
        success(`Added ${quantity} × ${data.title} to cart`);
        setQuantity(1);
    };

    const handleBuyNow = () => {
        if (priceType === 'variant' && !selectedVariant) {
            error('Please select product options');
            return;
        }
        addToCart(makeCartItem());
        window.location.href = '/checkout';
    };

    // ── Social ordering ───────────────────────────────────────────────────────
    const buildMessage = (bold: boolean) => {
        const b = (s: string) => bold ? `*${s}*` : s;
        let msg = `Hi, I'd like to order:\n\n`;
        msg += `${b('Product:')} ${data.title}\n`;
        if (selectedVariant?.options) {
            const opts = Object.entries(selectedVariant.options as Record<string, string>)
                .map(([k, v]) => `${k}: ${v}`).join(', ');
            msg += `${b('Options:')} ${opts}\n`;
        }
        if (selectedVariant?.sku) msg += `${b('SKU:')} ${selectedVariant.sku}\n`;
        msg += `${b('Quantity:')} ${quantity}\n`;
        if (currentPrice > 0) {
            msg += `${b('Price:')} ${currencySymbol} ${fmtPrice(currentPrice)}\n`;
            msg += `${b('Total:')} ${currencySymbol} ${fmtPrice(currentPrice * quantity)}\n`;
        }
        msg += `\nLink: ${window.location.href}`;
        return msg;
    };

    const handleSocial = (platform: 'whatsapp' | 'messenger' | 'telegram') => {
        if (priceType === 'variant' && !selectedVariant) {
            error('Please select product options first');
            return;
        }
        const encoded = encodeURIComponent(buildMessage(platform === 'whatsapp'));
        if (platform === 'whatsapp')  window.open(`https://wa.me/${whatsappNumber}?text=${encoded}`, '_blank');
        if (platform === 'messenger') window.open(`https://m.me/${facebookPageId}?text=${encoded}`, '_blank');
        if (platform === 'telegram')  window.open(`https://t.me/${telegramUsername}?text=${encoded}`, '_blank');
    };

    const socialCount = [whatsappNumber, facebookPageId, telegramUsername].filter(Boolean).length;

    // ── Shell props ───────────────────────────────────────────────────────────
    const shellProps: ShellProps = {
        data, priceType,
        regularPrice: effectiveRegular,
        hasDiscount: effectiveHasDiscount,
        discountPercent: effectiveDiscount,
        currentPrice, currentStock, quantity, noteValue, setNoteValue,
        dec, inc, setQuantity, gallery, attributes, selectedOptions,
        selectedVariant, variantDisplayStyle, handleOptionSelect,
        handleAddToCart, handleBuyNow, handleSocial, socialCount,
        whatsappNumber, facebookPageId, telegramUsername,
        shortDescription, orderNote, currencySymbol, variants,
        categoryLinks,
        flashSaleBanner: hasFlash ? flashSaleCampaign : null,
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            {layout === 1 ? <Layout1Shell {...shellProps} /> : <Layout2Shell {...shellProps} />}

            {/* ── Seller info card ── */}
            {seller && (
                <div className="container my-6">
                    <SellerCard seller={seller} />
                </div>
            )}

            {htmlDescription && (
                <div className="container my-6 description"
                    dangerouslySetInnerHTML={{ __html: htmlDescription }} />
            )}

            {(description || specifications.length > 0) && (
                <div className="container my-8">
                    <div className="flex flex-col md:flex-row gap-6">
                        {description && (
                            <div className="w-full md:w-2/3 bg-white p-4 md:p-6 rounded-2xl">
                                <h2 className="text-xl font-semibold mb-4">Description</h2>
                                <div className="prose max-w-none text-gray-700 description"
                                    dangerouslySetInnerHTML={{ __html: description }} />
                            </div>
                        )}
                        {specifications.length > 0 && (
                            <div className={description ? 'w-full md:w-1/3' : 'w-full'}>
                                <Specification specifications={specifications} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {compareIds.length > 0 && compareProducts && compareProducts.length > 0 && (
                <div className="container my-8">
                    <CompareSection
                        currentId={data.id}
                        compareProducts={compareProducts}
                        categoryProducts={categoryProducts ?? []}
                        currencySymbol={currencySymbol}
                    />
                </div>
            )}
        </>
    );
}

// ── Compare section ───────────────────────────────────────────────────────────
// Data is injected server-side via pageData — no client fetch needed.
// The Compare UI is dynamically imported so it's only in the bundle when used.

function CompareSection({ currentId, compareProducts, categoryProducts, currencySymbol }: {
    currentId: string;
    compareProducts: any[];
    categoryProducts: any[];
    currencySymbol: string;
}) {
    const [Comp, setComp] = useState<ComponentType<any> | null>(null);

    useEffect(() => {
        resolveLazyComponent("product.Compare")
            .then(comp => {
                if (comp) setComp(() => comp);
            })
            .catch(() => {});
    }, []);

    if (!Comp) return null;

    // The server fetches the current product + compare products together.
    // current = the product being viewed (matched by id), others = the rest.
    const current  = compareProducts.find((p: any) => p.id === currentId) ?? compareProducts[0];
    const others   = compareProducts.filter((p: any) => p.id !== currentId);

    if (!current) return null;

    return (
        <Comp
            current={current}
            compareProducts={others}
            categoryProducts={categoryProducts}
            currencySymbol={currencySymbol}
            style={1}
        />
    );
}

// ── Shared quantity stepper ───────────────────────────────────────────────────

function QuantityStepper({ quantity, currentStock, dec, inc, setQuantity }: Pick<ShellProps, 'quantity' | 'currentStock' | 'dec' | 'inc' | 'setQuantity'>) {
    return (
        <div className="flex items-center border rounded-lg overflow-hidden w-fit">
            <button type="button" onClick={dec} disabled={quantity <= 1} aria-label="Decrease quantity"
                className="px-4 py-2.5 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Icon icon="mdi:minus" width="18" height="18" />
            </button>
            <input
                type="text" inputMode="numeric" pattern="[0-9]*" value={quantity}
                onChange={(e) => {
                    const v = parseInt(e.target.value.replace(/\D/g, ''), 10) || 1;
                    setQuantity(Math.min(Math.max(1, v), currentStock || 9999));
                }}
                className="w-14 text-center border-x py-2.5 focus:outline-none text-sm font-medium"
                aria-label="Quantity"
            />
            <button type="button" onClick={inc}
                disabled={currentStock > 0 && quantity >= currentStock}
                aria-label="Increase quantity"
                className="px-4 py-2.5 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Icon icon="mdi:plus" width="18" height="18" />
            </button>
        </div>
    );
}

// ── Layout 1 Shell ────────────────────────────────────────────────────────────

function Layout1Shell(props: ShellProps) {
    const {
        data, priceType, regularPrice, hasDiscount, discountPercent,
        currentPrice, currentStock, quantity, noteValue, setNoteValue,
        dec, inc, setQuantity, gallery, attributes, selectedOptions,
        selectedVariant, variantDisplayStyle, handleOptionSelect,
        handleAddToCart, handleBuyNow, handleSocial, socialCount,
        whatsappNumber, facebookPageId, telegramUsername,
        shortDescription, orderNote, currencySymbol, variants,
        categoryLinks, flashSaleBanner,
    } = props;

    const inStock = currentStock > 0;

    return (
        <div className="container my-8">
            <div className="grid grid-cols-1 md:grid-cols-3 md:items-start gap-6 bg-white p-3 md:p-6 rounded-2xl">

                {/* ── Image column ── */}
                <div className="w-full md:sticky md:top-4">
                    <Slider gallery={gallery} alt={data.title} />
                </div>

                {/* ── Info column ── */}
                <div className="md:col-span-2 flex flex-col gap-4">
                    {/* Category breadcrumb */}
                    {categoryLinks.length > 0 && (
                        <nav aria-label="Category breadcrumb"
                            className="flex items-center gap-1.5 flex-wrap text-sm text-gray-500">
                            <Icon icon="mdi:tag-outline" width="15" height="15" className="shrink-0" />
                            {categoryLinks.map((cat, i) => (
                                <span key={cat.url} className="flex items-center gap-1.5">
                                    <Link href={cat.url}
                                        className="hover:text-main transition-colors font-medium">
                                        {cat.title}
                                    </Link>
                                    {i < categoryLinks.length - 1 && (
                                        <Icon icon="mdi:chevron-right" width="14" height="14" className="text-gray-300 shrink-0" />
                                    )}
                                </span>
                            ))}
                        </nav>
                    )}

                    {/* Title — always shown */}
                    <h1 className="text-xl md:text-3xl font-bold">{data.title}</h1>

                    {/* Short description */}
                    {shortDescription && (
                        <div className="text-gray-600 description"
                            dangerouslySetInnerHTML={{ __html: shortDescription }} />
                    )}

                    {/* Flash Sale banner — shown when a campaign matches this product */}
                    {flashSaleBanner && (
                        <Link href="/flash-sale"
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-linear-to-r from-rose-500 to-pink-600 text-white no-underline hover:opacity-90 transition">
                            {flashSaleBanner.image ? (
                                <img src={flashSaleBanner.image} alt=""
                                    className="w-8 h-8 rounded-lg object-cover shrink-0" />
                            ) : flashSaleBanner.icon ? (
                                <Icon icon={flashSaleBanner.icon} width={22} className="shrink-0" />
                            ) : (
                                <Icon icon="solar:tag-price-bold" width={22} className="shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold opacity-80 uppercase tracking-wide">
                                    Flash Sale
                                </p>
                                <p className="text-sm font-bold truncate">{flashSaleBanner.name}</p>
                            </div>
                            <span className="shrink-0 bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                {flashSaleBanner.percentage}% OFF
                            </span>
                            <Icon icon="solar:arrow-right-bold" width={16} className="shrink-0 opacity-70" />
                        </Link>
                    )}

                    {/* Price — only when > 0 */}
                    {currentPrice > 0 && (
                        <div className="flex items-center gap-3 flex-wrap">
                            {hasDiscount && regularPrice > 0 && (
                                <>
                                    <span className="text-lg text-gray-400 line-through">
                                        {currencySymbol}&nbsp;{fmtPrice(regularPrice)}
                                    </span>
                                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                                        {discountPercent}% OFF
                                    </span>
                                </>
                            )}
                            <span className="text-3xl font-bold text-main">
                                {currencySymbol}&nbsp;{fmtPrice(currentPrice)}
                            </span>
                        </div>
                    )}

                    {/* Variant selector — always shown when variants exist */}
                    {priceType === 'variant' && variants.length > 0 && (
                        <Variant
                            info={{ variants, selectedAttributes: [], variantDisplayStyle }}
                            attributes={attributes}
                            selectedOptions={selectedOptions}
                            selectedVariant={selectedVariant}
                            onOptionSelect={handleOptionSelect}
                            currencySymbol={currencySymbol}
                        />
                    )}

                    {/* Order note */}
                    {orderNote && (
                        <div>
                            <label className="block text-sm font-medium mb-1">{orderNote}</label>
                            <textarea rows={3} value={noteValue}
                                onChange={(e) => setNoteValue(e.target.value)}
                                placeholder="Add a note for this order (optional)"
                                className="w-full px-4 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    )}

                    {/* Stock badge — always shown */}
                    {inStock ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-green-600">
                            <Icon icon="mdi:package-variant-closed-check" width="18" height="18" />
                            {currentStock} in stock
                        </span>
                    ) : (
                        <span className="text-sm text-red-500 font-medium">Out of stock</span>
                    )}

                    {/* Quantity — always shown */}
                    <div>
                        <p className="text-sm font-medium mb-2">Quantity</p>
                        <QuantityStepper quantity={quantity} currentStock={currentStock}
                            dec={dec} inc={inc} setQuantity={setQuantity} />
                    </div>

                    {/* Cart buttons — always shown */}
                    <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={handleAddToCart} disabled={!inStock}
                            className="w-full py-3 rounded-lg bg-main text-white font-semibold hover:bg-main/80 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                            {inStock ? 'Add to Cart' : 'Out of Stock'}
                        </button>
                        <button type="button" onClick={handleBuyNow} disabled={!inStock}
                            className="w-full py-3 rounded-lg bg-gray-700 text-white font-semibold hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                            <Icon icon="mdi:lightning-bolt" width="18" height="18" />
                            {inStock ? 'Buy Now' : 'Out of Stock'}
                        </button>
                    </div>

                    {/* Social buttons */}
                    {socialCount > 0 && (
                        <div className="grid gap-2"
                            style={{ gridTemplateColumns: `repeat(${socialCount}, minmax(0, 1fr))` }}>
                            {whatsappNumber && (
                                <button type="button" onClick={() => handleSocial('whatsapp')} disabled={!inStock}
                                    className="w-full py-3 rounded-lg bg-[#25D366] text-white font-semibold hover:bg-[#20BA5A] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm">
                                    <Icon icon="mdi:whatsapp" width="20" height="20" />
                                    Order via WhatsApp
                                </button>
                            )}
                            {facebookPageId && (
                                <button type="button" onClick={() => handleSocial('messenger')} disabled={!inStock}
                                    className="w-full py-3 rounded-lg bg-[#0084FF] text-white font-semibold hover:bg-[#0073E6] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm">
                                    <Icon icon="mdi:facebook-messenger" width="20" height="20" />
                                    Order via Messenger
                                </button>
                            )}
                            {telegramUsername && (
                                <button type="button" onClick={() => handleSocial('telegram')} disabled={!inStock}
                                    className="w-full py-3 rounded-lg bg-[#0088cc] text-white font-semibold hover:bg-[#0077b5] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm">
                                    <Icon icon="mdi:telegram" width="20" height="20" />
                                    Order via Telegram
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Layout 2 Shell ────────────────────────────────────────────────────────────

function Layout2Shell(props: ShellProps) {
    const {
        data, priceType, regularPrice, hasDiscount, discountPercent,
        currentPrice, currentStock, quantity, noteValue, setNoteValue,
        dec, inc, setQuantity, gallery, attributes, selectedOptions,
        selectedVariant, variantDisplayStyle, handleOptionSelect,
        handleAddToCart, handleBuyNow, handleSocial, socialCount,
        whatsappNumber, facebookPageId, telegramUsername,
        shortDescription, orderNote, currencySymbol, variants,
        flashSaleBanner,
    } = props;

    const inStock = currentStock > 0;

    return (
        <div className="bg-[#0a0c10]">
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
                    <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl" />
                </div>

                <div className="relative container py-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:items-start">

                        {/* Image column */}
                        <div className="md:sticky md:top-4">
                            <Slider gallery={gallery} alt={data.title} aspectClass="aspect-square" />
                        </div>

                        {/* Info column */}
                        <div className="flex flex-col gap-5">

                            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
                                {data.title}
                            </h1>

                            {shortDescription && (
                                <div className="text-gray-400 description text-sm leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: shortDescription }} />
                            )}

                            {/* Flash Sale banner */}
                            {flashSaleBanner && (
                                <a href="/flash-sale"
                                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-linear-to-r from-rose-500 to-pink-600 text-white no-underline hover:opacity-90 transition">
                                    {flashSaleBanner.image ? (
                                        <img src={flashSaleBanner.image} alt=""
                                            className="w-8 h-8 rounded-lg object-cover shrink-0" />
                                    ) : flashSaleBanner.icon ? (
                                        <Icon icon={flashSaleBanner.icon} width={22} className="shrink-0" />
                                    ) : (
                                        <Icon icon="solar:tag-price-bold" width={22} className="shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold opacity-80 uppercase tracking-wide">Flash Sale</p>
                                        <p className="text-sm font-bold truncate">{flashSaleBanner.name}</p>
                                    </div>
                                    <span className="shrink-0 bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                        {flashSaleBanner.percentage}% OFF
                                    </span>
                                    <Icon icon="solar:arrow-right-bold" width={16} className="shrink-0 opacity-70" />
                                </a>
                            )}

                            {/* Price */}
                            {currentPrice > 0 && (
                                <div className="flex items-center gap-3 flex-wrap">
                                    {hasDiscount && regularPrice > 0 && (
                                        <>
                                            <span className="text-lg text-gray-500 line-through">
                                                {currencySymbol}&nbsp;{fmtPrice(regularPrice)}
                                            </span>
                                            <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                                                {discountPercent}% OFF
                                            </span>
                                        </>
                                    )}
                                    <span className="text-4xl font-black text-emerald-400 tabular-nums">
                                        {currencySymbol}&nbsp;{fmtPrice(currentPrice)}
                                    </span>
                                </div>
                            )}

                            {/* Variant selector */}
                            {priceType === 'variant' && variants.length > 0 && (
                                <div className="text-white">
                                    <Variant
                                        info={{ variants, selectedAttributes: [], variantDisplayStyle }}
                                        attributes={attributes}
                                        selectedOptions={selectedOptions}
                                        selectedVariant={selectedVariant}
                                        onOptionSelect={handleOptionSelect}
                                        currencySymbol={currencySymbol}
                                    />
                                </div>
                            )}

                            {/* Order note */}
                            {orderNote && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">{orderNote}</label>
                                    <textarea rows={3} value={noteValue}
                                        onChange={(e) => setNoteValue(e.target.value)}
                                        placeholder="Add a note (optional)"
                                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600" />
                                </div>
                            )}

                            {/* Stock */}
                            {inStock ? (
                                <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
                                    <Icon icon="mdi:package-variant-closed-check" width="18" height="18" />
                                    {currentStock} in stock
                                </span>
                            ) : (
                                <span className="text-sm text-red-400 font-medium">Out of stock</span>
                            )}

                            {/* Quantity */}
                            <div>
                                <p className="text-sm font-medium text-gray-300 mb-2">Quantity</p>
                                <div className="border border-white/10 rounded-lg w-fit overflow-hidden flex">
                                    <button type="button" onClick={dec} disabled={quantity <= 1}
                                        className="px-4 py-2.5 text-gray-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                        <Icon icon="mdi:minus" width="18" height="18" />
                                    </button>
                                    <input type="text" inputMode="numeric" value={quantity}
                                        onChange={(e) => {
                                            const v = parseInt(e.target.value.replace(/\D/g, ''), 10) || 1;
                                            setQuantity(Math.min(Math.max(1, v), currentStock || 9999));
                                        }}
                                        className="w-14 text-center bg-transparent border-x border-white/10 py-2.5 text-white text-sm focus:outline-none" />
                                    <button type="button" onClick={inc}
                                        disabled={currentStock > 0 && quantity >= currentStock}
                                        className="px-4 py-2.5 text-gray-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                        <Icon icon="mdi:plus" width="18" height="18" />
                                    </button>
                                </div>
                            </div>

                            {/* Cart buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <button type="button" onClick={handleAddToCart} disabled={!inStock}
                                    className="py-3.5 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-emerald-900/50">
                                    {inStock ? 'Add to Cart' : 'Out of Stock'}
                                </button>
                                <button type="button" onClick={handleBuyNow} disabled={!inStock}
                                    className="py-3.5 rounded-xl border border-emerald-500/40 text-emerald-400 font-bold hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
                                    <Icon icon="mdi:lightning-bolt" width="18" height="18" />
                                    {inStock ? 'Buy Now' : 'Out of Stock'}
                                </button>
                            </div>

                            {/* Social buttons */}
                            {socialCount > 0 && (
                                <div className="grid gap-2"
                                    style={{ gridTemplateColumns: `repeat(${socialCount}, minmax(0, 1fr))` }}>
                                    {whatsappNumber && (
                                        <button type="button" onClick={() => handleSocial('whatsapp')} disabled={!inStock}
                                            className="py-3 rounded-xl bg-[#25D366] text-white font-semibold hover:bg-[#20BA5A] disabled:opacity-40 transition flex items-center justify-center gap-2 text-sm">
                                            <Icon icon="mdi:whatsapp" width="20" height="20" /> WhatsApp
                                        </button>
                                    )}
                                    {facebookPageId && (
                                        <button type="button" onClick={() => handleSocial('messenger')} disabled={!inStock}
                                            className="py-3 rounded-xl bg-[#0084FF] text-white font-semibold hover:bg-[#0073E6] disabled:opacity-40 transition flex items-center justify-center gap-2 text-sm">
                                            <Icon icon="mdi:facebook-messenger" width="20" height="20" /> Messenger
                                        </button>
                                    )}
                                    {telegramUsername && (
                                        <button type="button" onClick={() => handleSocial('telegram')} disabled={!inStock}
                                            className="py-3 rounded-xl bg-[#0088cc] text-white font-semibold hover:bg-[#0077b5] disabled:opacity-40 transition flex items-center justify-center gap-2 text-sm">
                                            <Icon icon="mdi:telegram" width="20" height="20" /> Telegram
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Seller Card ───────────────────────────────────────────────────────────────

interface SellerCardProps {
    seller: {
        _id: string; name: string; image: string; slug: string;
        city: string; state: string; bio: string; website: string;
        twitter: string; profileUrl: string;
    };
}

function SellerCard({ seller }: SellerCardProps) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                Sold by
            </p>
            <div className="flex items-start gap-4">
                {/* Avatar */}
                <Link href={seller.profileUrl} className="shrink-0">
                    {seller.image ? (
                        <img
                            src={seller.image}
                            alt={seller.name}
                            className="w-14 h-14 rounded-xl object-cover ring-2 ring-orange-100"
                        />
                    ) : (
                        <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-2xl">
                            {seller.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                    <Link
                        href={seller.profileUrl}
                        className="text-base font-bold text-gray-900 hover:text-orange-600 transition-colors"
                    >
                        {seller.name}
                    </Link>

                    {(seller.city || seller.state) && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                            📍 {[seller.city, seller.state].filter(Boolean).join(", ")}
                        </p>
                    )}

                    {seller.bio && (
                        <p className="text-sm text-gray-600 line-clamp-2">{seller.bio}</p>
                    )}

                    {/* Links */}
                    <div className="flex flex-wrap gap-3 pt-1">
                        <Link
                            href={seller.profileUrl}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
                        >
                            🛒 View all products
                        </Link>
                        {seller.website && (
                            <a
                                href={seller.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
                            >
                                🌐 Website
                            </a>
                        )}
                        {seller.twitter && (
                            <a
                                href={`https://x.com/${seller.twitter.replace(/^@/, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
                            >
                                𝕏 {seller.twitter.startsWith('@') ? seller.twitter : `@${seller.twitter}`}
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
