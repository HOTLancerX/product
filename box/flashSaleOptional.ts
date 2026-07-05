"use client";

/**
 * plugin/product/box/flashSaleOptional.ts
 *
 * Re-exports flash-sale utilities for the product box components.
 * When the flash-sale plugin is absent, next.config.ts aliases both modules
 * to lib/optional-plugin-stub.ts which exports `undefined` for everything.
 * The null-guards in useFlashSale() and applyFlashSale() handle that gracefully.
 */

import _useFlashSale from "@/plugin/flash-sale/lib/useFlashSale";
import { applyFlashSale as _applyFlashSale } from "@/plugin/flash-sale/lib/applyFlashSale";

// ── Types (re-exported for consumers) ────────────────────────────────────────

export type { FlashSaleCampaignFull, FlashSaleResult } from "@/plugin/flash-sale/lib/applyFlashSale";

export interface UseFlashSaleReturn {
    ready:        boolean;
    resolvePrice: (
        originalPrice: number,
        productId:     string,
        categoryId?:   string | null
    ) => FlashSaleResult;
}

import type { FlashSaleResult, FlashSaleCampaignFull } from "@/plugin/flash-sale/lib/applyFlashSale";

// ── No-op fallbacks used when stub is resolved ────────────────────────────────

function noopResolve(originalPrice: number): FlashSaleResult {
    return {
        applied: false, regularPrice: originalPrice,
        sellingPrice: originalPrice, discountPercent: 0, campaign: null,
    };
}

import { useState } from "react";

function useNoopFlashSale(): UseFlashSaleReturn {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useState(false); // keep hook call count stable
    return { ready: true, resolvePrice: noopResolve };
}

// ── Public exports ────────────────────────────────────────────────────────────

/** Drop-in replacement for `useFlashSale`. Safe when plugin absent (alias → stub). */
export function useFlashSale(): UseFlashSaleReturn {
    // When the plugin is absent, _useFlashSale is `undefined` (from stub).
    if (typeof _useFlashSale === "function") {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return (_useFlashSale as () => UseFlashSaleReturn)();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useNoopFlashSale();
}

/** Drop-in replacement for `applyFlashSale`. Safe when plugin absent. */
export function applyFlashSale(
    originalPrice: number,
    campaign: FlashSaleCampaignFull | null | undefined
): FlashSaleResult {
    if (typeof _applyFlashSale === "function" && campaign) {
        return _applyFlashSale(originalPrice, campaign);
    }
    return noopResolve(originalPrice);
}
