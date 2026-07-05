"use client";

/**
 * plugin/product/product/useFlashSaleOptional.ts
 *
 * Re-exports useFlashSale for ProductClient.
 * When the flash-sale plugin is absent, next.config.ts aliases the module to
 * lib/optional-plugin-stub.ts (exports undefined). The null-check here handles
 * that so ProductClient always gets a valid resolvePrice function.
 */

import _useFlashSale from "@/plugin/flash-sale/lib/useFlashSale";
import { useState } from "react";

export interface FlashSaleResult {
    applied:          boolean;
    regularPrice:     number;
    sellingPrice:     number;
    discountPercent:  number;
    campaign:         any | null;
}

export interface UseFlashSaleReturn {
    ready:        boolean;
    resolvePrice: (
        originalPrice: number,
        productId:     string,
        categoryId?:   string | null
    ) => FlashSaleResult;
}

function noopResolve(originalPrice: number): FlashSaleResult {
    return {
        applied: false, regularPrice: originalPrice,
        sellingPrice: originalPrice, discountPercent: 0, campaign: null,
    };
}

function useNoopFlashSale(): UseFlashSaleReturn {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useState(false); // keep hook call count stable
    return { ready: true, resolvePrice: noopResolve };
}

export function useFlashSaleOptional(): UseFlashSaleReturn {
    if (typeof _useFlashSale === "function") {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return (_useFlashSale as () => UseFlashSaleReturn)();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useNoopFlashSale();
}
