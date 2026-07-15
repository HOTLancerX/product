"use client";

import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";

export interface CartItem {
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
        const raw = localStorage.getItem("shopping_cart");
        const cart: CartItem[] = raw ? JSON.parse(raw) : [];
        const idx = cart.findIndex(
            (c) => c.productId === item.productId && c.variantId === item.variantId
        );
        if (idx >= 0) {
            cart[idx].quantity = Math.min(cart[idx].quantity + item.quantity, item.maxQuantity);
        } else {
            cart.push(item);
        }
        localStorage.setItem("shopping_cart", JSON.stringify(cart));
        window.dispatchEvent(new Event("cartUpdated"));
    } catch {
        // localStorage unavailable
    }
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

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
        label,
        values: Array.from(values),
    }));
}

function fmtPrice(n: number) {
    return Number(n).toLocaleString("en-US", {
        minimumFractionDigits: n % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
    });
}

interface ProductContextType {
    isMock?: boolean;
    data: any;
    priceType: "single" | "variant";
    regularPrice: number;
    sellingPrice: number;
    displayPrice: number;
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
    handleSocial: (platform: "whatsapp" | "messenger" | "telegram") => void;
    socialCount: number;
    whatsappNumber: string;
    facebookPageId: string;
    telegramUsername: string;
    shortDescription: string;
    description: string;
    htmlDescription: string;
    orderNote: string;
    currencySymbol: string;
    variants: any[];
    categoryLinks: { title: string; url: string }[];
    specifications: any[];
    flashSaleBanner?: any | null;
}

const ProductContext = createContext<ProductContextType | null>(null);

export function ProductProvider({
    children,
    data,
    settings = {},
    permalinkMap = {},
    pageData,
}: {
    children: React.ReactNode;
    data: any;
    settings?: Record<string, any>;
    permalinkMap?: Record<string, string>;
    pageData?: any;
}) {
    const { success, error } = useToast();

    const variate = useMemo(() => parseJson<Record<string, any>>(data?.info?._variate, {}), [data]);
    const priceType = variate.priceType ?? "single";
    const regularPrice = parseFloat(variate.regularprice ?? "0") || 0;
    const sellingPrice = parseFloat(variate.sellingprice ?? "0") || 0;
    const singleStock = parseInt(variate.stock ?? "0", 10) || 0;
    const variants = variate.variants ?? [];
    const selectedAttributes = variate.selectedAttributes ?? [];
    const variantDisplayStyle = variate.variantDisplayStyle ?? "text";

    const variantImages: string[] = [];
    for (const v of variants) {
        if (v.image) variantImages.push(v.image);
        if (v.gallery?.length) variantImages.push(...v.gallery);
    }
    const defaultImages = useMemo(() => parseJson<string[]>(data?.info?.images, []), [data]);
    const allImages = useMemo(() => [...new Set([...defaultImages, ...variantImages])].filter(Boolean), [defaultImages, variantImages]);

    const specifications = useMemo(() => parseJson<any[]>(data?.info?._specifications, []), [data]);
    const currencySymbol = (settings.product_currency_symbol as string) || "$";
    const whatsappNumber = (settings.product_whatsapp_number as string) || "";
    const telegramUsername = (settings.product_telegram_username as string) || "";
    const facebookPageId = (settings.product_facebook_page_id as string) || "";

    const shortDescription = data?.info?.shortDescription ?? "";
    const description = data?.info?.description ?? "";
    const htmlDescription = data?.info?.htmlDescription ?? "";
    const orderNote = data?.info?.orderNote ?? "";
    const shippingInside = parseFloat(data?.info?.shipping_inside ?? "") || undefined;
    const shippingOutside = parseFloat(data?.info?.shipping_outside ?? "") || undefined;

    const ancestors = pageData?.ancestors ?? [];
    const catPrefix = (permalinkMap["product-category"] ?? "product/category").trim().replace(/^\/+|\/+$/g, "");
    const categoryLinks = useMemo(() => ancestors.map((cat: any) => ({
        title: cat.title,
        url: catPrefix ? `/${catPrefix}/${cat.slug}` : `/${cat.slug}`,
    })), [ancestors, catPrefix]);

    const flashSaleCampaign = pageData?.flashSaleCampaign ?? null;
    const hasFlash = !!flashSaleCampaign;
    const displayPrice = priceType === "single" ? (sellingPrice > 0 ? sellingPrice : regularPrice) : 0;

    const effectivePrice = hasFlash
        ? (flashSaleCampaign.saleType === "fake"
            ? displayPrice
            : Math.round(displayPrice * (1 - flashSaleCampaign.percentage / 100) * 100) / 100)
        : displayPrice;

    const effectiveRegular = hasFlash
        ? (flashSaleCampaign.saleType === "fake"
            ? Math.round(displayPrice * (1 + flashSaleCampaign.percentage / 100) * 100) / 100
            : displayPrice)
        : regularPrice;

    const effectiveDiscount = hasFlash
        ? (flashSaleCampaign.saleType === "fake"
            ? Math.round(((effectiveRegular - effectivePrice) / effectiveRegular) * 100)
            : flashSaleCampaign.percentage)
        : priceType === "single" && sellingPrice > 0 && regularPrice > sellingPrice
            ? Math.round(((regularPrice - sellingPrice) / regularPrice) * 100)
            : 0;

    const effectiveHasDiscount = hasFlash || (priceType === "single" && sellingPrice > 0 && regularPrice > sellingPrice);

    const [selectedVariant, setSelectedVariant] = useState<any>(() => variants[0] ?? null);
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => variants[0]?.options ? { ...variants[0].options } : {});

    const attributes = useMemo(() => buildAttributes(variants, selectedAttributes), [variants, selectedAttributes]);

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

    const gallery = useMemo(() => {
        const imgs: string[] = [];
        if (selectedVariant?.gallery?.length) imgs.push(...selectedVariant.gallery);
        if (selectedVariant?.image) imgs.push(selectedVariant.image);
        if (imgs.length === 0) imgs.push(...allImages);
        return [...new Set(imgs)].filter(Boolean);
    }, [selectedVariant, allImages]);

    const currentPrice = useMemo(() => {
        if (priceType === "single") return effectivePrice;
        if (!selectedVariant) return 0;
        if (selectedVariant.priceTiers?.length > 0) {
            const tier = selectedVariant.priceTiers.find((t: any) => {
                const start = parseInt(t.rangeStart) || 0;
                const end = t.rangeEnd === "" ? Infinity : (parseInt(t.rangeEnd) || Infinity);
                return 1 >= start && 1 <= end;
            });
            if (tier) return parseFloat(tier.price) || 0;
        }
        return parseFloat(selectedVariant.price || "0") || 0;
    }, [priceType, effectivePrice, selectedVariant]);

    const currentStock = useMemo(() => {
        if (priceType === "single") return singleStock;
        if (!selectedVariant) return 0;
        return parseInt(selectedVariant.quantity || "0", 10) || 0;
    }, [priceType, singleStock, selectedVariant]);

    const [quantity, setQuantity] = useState(1);
    const [noteValue, setNoteValue] = useState("");

    const dec = () => setQuantity((q) => Math.max(1, q - 1));
    const inc = () => setQuantity((q) => Math.min(currentStock || 9999, q + 1));

    const makeCartItem = (): CartItem => ({
        productId: data?._id || data?.id,
        productSlug: data?.slug,
        productTitle: data?.title,
        productImage: gallery[0] ?? "",
        variantId: selectedVariant?.id,
        variantOptions: selectedVariant?.options,
        sku: selectedVariant?.sku,
        price: currentPrice,
        quantity,
        maxQuantity: currentStock || 9999,
        shippingInside,
        shippingOutside,
    });

    const handleAddToCart = () => {
        if (priceType === "variant" && !selectedVariant) {
            error("Please select product options");
            return;
        }
        addToCart(makeCartItem());
        success(`Added ${quantity} × ${data.title} to cart`);
        setQuantity(1);
    };

    const handleBuyNow = () => {
        if (priceType === "variant" && !selectedVariant) {
            error("Please select product options");
            return;
        }
        addToCart(makeCartItem());
        window.location.href = "/checkout";
    };

    const buildMessage = (bold: boolean) => {
        const b = (s: string) => bold ? `*${s}*` : s;
        let msg = `Hi, I'd like to order:\n\n`;
        msg += `${b("Product:")} ${data?.title}\n`;
        if (selectedVariant?.options) {
            const opts = Object.entries(selectedVariant.options as Record<string, string>)
                .map(([k, v]) => `${k}: ${v}`).join(", ");
            msg += `${b("Options:")} ${opts}\n`;
        }
        if (selectedVariant?.sku) msg += `${b("SKU:")} ${selectedVariant.sku}\n`;
        msg += `${b("Quantity:")} ${quantity}\n`;
        if (currentPrice > 0) {
            msg += `${b("Price:")} ${currencySymbol} ${fmtPrice(currentPrice)}\n`;
            msg += `${b("Total:")} ${currencySymbol} ${fmtPrice(currentPrice * quantity)}\n`;
        }
        msg += `\nLink: ${window.location.href}`;
        return msg;
    };

    const handleSocial = (platform: "whatsapp" | "messenger" | "telegram") => {
        if (priceType === "variant" && !selectedVariant) {
            error("Please select product options first");
            return;
        }
        const encoded = encodeURIComponent(buildMessage(platform === "whatsapp"));
        if (platform === "whatsapp") window.open(`https://wa.me/${whatsappNumber}?text=${encoded}`, "_blank");
        if (platform === "messenger") window.open(`https://m.me/${facebookPageId}?text=${encoded}`, "_blank");
        if (platform === "telegram") window.open(`https://t.me/${telegramUsername}?text=${encoded}`, "_blank");
    };

    const socialCount = [whatsappNumber, facebookPageId, telegramUsername].filter(Boolean).length;

    const value = useMemo(
        () => ({
            data,
            priceType,
            regularPrice: effectiveRegular,
            sellingPrice,
            displayPrice,
            hasDiscount: effectiveHasDiscount,
            discountPercent: effectiveDiscount,
            currentPrice,
            currentStock,
            quantity,
            noteValue,
            setNoteValue,
            dec,
            inc,
            setQuantity,
            gallery,
            attributes,
            selectedOptions,
            selectedVariant,
            variantDisplayStyle,
            handleOptionSelect,
            handleAddToCart,
            handleBuyNow,
            handleSocial,
            socialCount,
            whatsappNumber,
            facebookPageId,
            telegramUsername,
            shortDescription,
            description,
            htmlDescription,
            orderNote,
            currencySymbol,
            variants,
            categoryLinks,
            specifications,
            flashSaleBanner: hasFlash ? flashSaleCampaign : null,
        }),
        [
            data,
            priceType,
            effectiveRegular,
            sellingPrice,
            displayPrice,
            effectiveHasDiscount,
            effectiveDiscount,
            currentPrice,
            currentStock,
            quantity,
            noteValue,
            gallery,
            attributes,
            selectedOptions,
            selectedVariant,
            variantDisplayStyle,
            socialCount,
            whatsappNumber,
            facebookPageId,
            telegramUsername,
            shortDescription,
            description,
            htmlDescription,
            orderNote,
            currencySymbol,
            variants,
            categoryLinks,
            specifications,
            hasFlash,
            flashSaleCampaign,
        ]
    );

    return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProduct() {
    const ctx = useContext(ProductContext);
    return ctx;
}
