"use client";

/**
 * plugin/product/box/flashSaleOptional.ts
 *
 * Flash-sale price resolution for product box components.
 *
 * Instead of importing directly from @/plugin/flash-sale/* (which breaks the
 * build when that plugin is absent), the flash-sale plugin registers a price
 * resolver via addFilter("flash-sale.resolvePrice", ...) in its index.ts.
 *
 * When the flash-sale plugin is inactive or not installed:
 *   - No filter is registered → resolvePrice() returns the original price untouched.
 *
 * When active:
 *   - The filter runs synchronously (campaigns are cached module-level in useFlashSale).
 *   - resolvePrice() returns applied=true + discounted prices.
 *
 * No webpack aliases, no optional stubs, no cross-plugin file imports needed.
 */

import { useState, useEffect, useRef } from "react";

// ── Self-contained types (no import from flash-sale plugin) ──────────────────

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

// ── Hook registry (client-side, module-level singleton) ───────────────────────
// The flash-sale plugin calls registerFlashSaleResolver() once when it loads.
// Product boxes call resolveFlashSalePrice() which delegates to the resolver
// if one is registered, or returns a noop result.

type FlashSaleResolver = (
    originalPrice: number,
    productId:     string,
    categoryId?:   string | null
) => FlashSaleResult;

let _resolver: FlashSaleResolver | null = null;
let _readyCallbacks: Array<() => void>  = [];

/**
 * Called by the flash-sale plugin (in its client-side init) to register the
 * actual price resolver. Once called, any pending useFlashSale() hooks are
 * notified via the readyCallbacks queue.
 */
export function registerFlashSaleResolver(resolver: FlashSaleResolver): void {
    _resolver = resolver;
    _readyCallbacks.forEach((cb) => cb());
    _readyCallbacks = [];
}

// ── Noop fallback ─────────────────────────────────────────────────────────────

function noopResult(originalPrice: number): FlashSaleResult {
    return {
        applied: false, regularPrice: originalPrice,
        sellingPrice: originalPrice, discountPercent: 0, campaign: null,
    };
}

// ── useFlashSale hook ─────────────────────────────────────────────────────────

/**
 * Drop-in replacement for useFlashSale from the flash-sale plugin.
 * Safe to call whether or not the flash-sale plugin is active.
 */
export function useFlashSale(): UseFlashSaleReturn {
    const [ready, setReady] = useState(_resolver !== null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        if (_resolver !== null) {
            setReady(true);
            return;
        }
        // Wait for the resolver to be registered (flash-sale plugin init)
        const cb = () => { if (mountedRef.current) setReady(true); };
        _readyCallbacks.push(cb);
        return () => {
            mountedRef.current = false;
            _readyCallbacks = _readyCallbacks.filter((c) => c !== cb);
        };
    }, []);

    const resolvePrice = (
        originalPrice: number,
        productId:     string,
        categoryId?:   string | null
    ): FlashSaleResult => {
        if (!_resolver) return noopResult(originalPrice);
        return _resolver(originalPrice, productId, categoryId);
    };

    return { ready, resolvePrice };
}

/**
 * Synchronous price resolver — safe to call outside React.
 * Returns the original price when flash-sale plugin is inactive.
 */
export function applyFlashSale(
    originalPrice: number,
    campaign:      FlashSaleCampaignFull | null | undefined
): FlashSaleResult {
    if (!campaign) return noopResult(originalPrice);
    // Inline the computation so this file has zero cross-plugin imports.
    const pct = campaign.percentage;
    if (campaign.saleType === "fake") {
        const inflated      = Math.round(originalPrice * (1 + pct / 100) * 100) / 100;
        const discountShown = Math.round(((inflated - originalPrice) / inflated) * 100);
        return { applied: true, regularPrice: inflated, sellingPrice: originalPrice, discountPercent: discountShown, campaign };
    } else {
        const discounted = Math.round(originalPrice * (1 - pct / 100) * 100) / 100;
        return { applied: true, regularPrice: originalPrice, sellingPrice: discounted, discountPercent: pct, campaign };
    }
}
