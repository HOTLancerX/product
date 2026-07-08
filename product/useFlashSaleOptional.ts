"use client";

/**
 * plugin/product/product/useFlashSaleOptional.ts
 *
 * Re-exports useFlashSale for ProductClient.
 * When the flash-sale plugin is inactive or not installed, returns a noop resolver.
 * No direct imports from the flash-sale plugin — uses the registry from flashSaleOptional.ts instead.
 */

import { useFlashSale, type UseFlashSaleReturn } from "../box/flashSaleOptional";

export type { FlashSaleResult, UseFlashSaleReturn, FlashSaleCampaignFull } from "../box/flashSaleOptional";

/**
 * Drop-in replacement for useFlashSale.
 * Safe to call whether or not the flash-sale plugin is active.
 */
export function useFlashSaleOptional(): UseFlashSaleReturn {
    return useFlashSale();
}
