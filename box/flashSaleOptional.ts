"use client";

/**
 * plugin/product/box/flashSaleOptional.ts
 *
 * Self-contained flash-sale types + hooks for product box components
 * (Product-1, Product-2, Daraz-1, etc.) used inside category listings.
 *
 * On PRODUCT pages: flashSaleCampaign is passed as a prop from server
 * (product/lib/serverHooks → pageData → Layout1/2 → ProductClient).
 * Box components receive it directly — no hook needed.
 *
 * On CATEGORY pages: boxes are rendered client-side and receive
 * flashSaleCampaign as a prop from the category template, which gets
 * it from pageData.flashSaleCampaign (fetched server-side by
 * product/lib/serverHooks "product-category" hook).
 * useFlashSale() is kept as a fallback for any context not covered above.
 *
 * NO imports from @/plugin/flash-sale/* — fully self-contained.
 */

import { useState, useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FlashSaleCampaignFull {
    _id:         string;
    name:        string;
    image:       string;
    icon:        string;
    coverPhoto:  string;
    saleType:    "fake" | "real";
    percentage:  number;
    targetType:  "category" | "product";
    categoryIds: string[];
    productIds:  string[];
    isActive:    boolean;
    startDate:   string | null;
    endDate:     string | null;
}

export interface FlashSaleResult {
    applied:         boolean;
    regularPrice:    number;
    sellingPrice:    number;
    discountPercent: number;
    campaign:        FlashSaleCampaignFull | null;
}

export interface UseFlashSaleReturn {
    ready:        boolean;
    resolvePrice: (
        originalPrice: number,
        productId:     string,
        categoryId?:   string | null
    ) => FlashSaleResult;
}

// ── Price computation (inline — no external dependency) ───────────────────────

function computeFlashSale(basePrice: number, campaign: FlashSaleCampaignFull): FlashSaleResult {
    const pct = campaign.percentage;
    if (campaign.saleType === "fake") {
        const inflated      = Math.round(basePrice * (1 + pct / 100) * 100) / 100;
        const discountShown = Math.round(((inflated - basePrice) / inflated) * 100);
        return { applied: true, regularPrice: inflated, sellingPrice: basePrice, discountPercent: discountShown, campaign };
    } else {
        const discounted = Math.round(basePrice * (1 - pct / 100) * 100) / 100;
        return { applied: true, regularPrice: basePrice, sellingPrice: discounted, discountPercent: pct, campaign };
    }
}

function isCampaignActive(c: FlashSaleCampaignFull): boolean {
    if (!c.isActive) return false;
    const now = Date.now();
    if (c.startDate && new Date(c.startDate).getTime() > now) return false;
    if (c.endDate   && new Date(c.endDate).getTime()   < now) return false;
    return true;
}

function noopResult(originalPrice: number): FlashSaleResult {
    return { applied: false, regularPrice: originalPrice, sellingPrice: originalPrice, discountPercent: 0, campaign: null };
}

// ── Synchronous helper ────────────────────────────────────────────────────────

/**
 * Apply a flash-sale campaign to a price. Pure computation, no React.
 * Used by box components that receive flashSaleCampaign as a prop.
 */
export function applyFlashSale(
    basePrice: number,
    campaign:  FlashSaleCampaignFull | null | undefined
): FlashSaleResult {
    if (!campaign || basePrice <= 0) return noopResult(basePrice);
    return computeFlashSale(basePrice, campaign);
}

// ── Module-level campaign cache (client-side fallback) ────────────────────────
// Used by useFlashSale() when no prop is available (e.g. standalone usage).
// Fetches /api/flash-sale?active=true once per page load.

let _campaigns:   FlashSaleCampaignFull[] | null = null;
let _fetchPromise: Promise<void> | null           = null;

async function loadCampaigns(): Promise<void> {
    if (_campaigns !== null) return;
    if (_fetchPromise)       return _fetchPromise;
    _fetchPromise = fetch("/api/flash-sale?active=true", { cache: "no-store" })
        .then(r => r.ok ? r.json() : { campaigns: [] })
        .then(data => { _campaigns = Array.isArray(data.campaigns) ? data.campaigns : []; })
        .catch(() => { _campaigns = []; });
    return _fetchPromise;
}

// ── useFlashSale hook ─────────────────────────────────────────────────────────

/**
 * Client hook — resolves flash-sale prices for category-listing contexts
 * where no server-injected campaign prop is available.
 *
 * On product pages, prefer the flashSaleCampaign prop instead.
 */
export function useFlashSale(): UseFlashSaleReturn {
    const [ready, setReady]  = useState(_campaigns !== null);
    const mountedRef         = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        if (_campaigns !== null) { setReady(true); return; }
        loadCampaigns().then(() => { if (mountedRef.current) setReady(true); });
        return () => { mountedRef.current = false; };
    }, []);

    const resolvePrice = (
        originalPrice: number,
        productId:     string,
        categoryId?:   string | null
    ): FlashSaleResult => {
        if (!_campaigns?.length) return noopResult(originalPrice);
        for (const c of _campaigns) {
            if (!isCampaignActive(c)) continue;
            if (c.targetType === "product" && c.productIds.includes(productId)) {
                return computeFlashSale(originalPrice, c);
            }
            if (c.targetType === "category" && categoryId && c.categoryIds.includes(categoryId)) {
                return computeFlashSale(originalPrice, c);
            }
        }
        return noopResult(originalPrice);
    };

    return { ready, resolvePrice };
}
