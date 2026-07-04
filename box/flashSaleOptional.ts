"use client";

/**
 * plugin/product/box/flashSaleOptional.ts
 *
 * Safe re-exports of flash-sale utilities for the product box components.
 * When the flash-sale plugin is not installed these fall back to no-ops so
 * the build never errors and product cards work normally without the plugin.
 */

// ── Shared types (duplicated so this file has zero hard dependencies) ─────────

export interface FlashSaleCampaignFull {
    _id:        string;
    name:       string;
    percentage: number;
    saleType:   "real" | "fake";
    scope:      "all" | "categories" | "products";
    productIds: string[];
    categoryIds: string[];
    image?:     string;
    icon?:      string;
    [key: string]: any;
}

export interface FlashSaleResult {
    applied:          boolean;
    regularPrice:     number;
    sellingPrice:     number;
    discountPercent:  number;
    campaign:         FlashSaleCampaignFull | null;
}

export interface UseFlashSaleReturn {
    ready:        boolean;
    resolvePrice: (
        originalPrice: number,
        productId:     string,
        categoryId?:   string | null
    ) => FlashSaleResult;
}

// ── No-op fallback ────────────────────────────────────────────────────────────

function noopResolve(originalPrice: number): FlashSaleResult {
    return {
        applied: false, regularPrice: originalPrice,
        sellingPrice: originalPrice, discountPercent: 0, campaign: null,
    };
}

function useNoopFlashSale(): UseFlashSaleReturn {
    return { ready: true, resolvePrice: noopResolve };
}

function noopApply(originalPrice: number, _campaign: any): FlashSaleResult {
    return {
        applied: false, regularPrice: originalPrice,
        sellingPrice: originalPrice, discountPercent: 0, campaign: null,
    };
}

// ── Load real implementations once at module evaluation time ──────────────────

let realHook:  (() => UseFlashSaleReturn) | null = null;
let realApply: ((originalPrice: number, campaign: FlashSaleCampaignFull) => FlashSaleResult) | null = null;

try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const hookMod = require("@/plugin/flash-sale/lib/useFlashSale");
    if (typeof hookMod?.default === "function") {
        realHook = hookMod.default as () => UseFlashSaleReturn;
    }
} catch { /* plugin not installed */ }

try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const applyMod = require("@/plugin/flash-sale/lib/applyFlashSale");
    if (typeof applyMod?.applyFlashSale === "function") {
        realApply = applyMod.applyFlashSale as (
            originalPrice: number,
            campaign: FlashSaleCampaignFull
        ) => FlashSaleResult;
    }
} catch { /* plugin not installed */ }

// ── Public exports ────────────────────────────────────────────────────────────

/** Drop-in replacement for `useFlashSale` — safe when plugin is absent. */
export function useFlashSale(): UseFlashSaleReturn {
    if (realHook) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return realHook();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useNoopFlashSale();
}

/** Drop-in replacement for `applyFlashSale` — safe when plugin is absent. */
export function applyFlashSale(
    originalPrice: number,
    campaign: FlashSaleCampaignFull | null | undefined
): FlashSaleResult {
    if (realApply && campaign) return realApply(originalPrice, campaign);
    return noopApply(originalPrice, campaign);
}
