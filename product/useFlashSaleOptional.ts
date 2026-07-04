"use client";

/**
 * plugin/product/product/useFlashSaleOptional.ts
 *
 * Safe re-export of the flash-sale hook.
 *
 * When the flash-sale plugin is installed this just delegates to the real
 * hook. When it is NOT installed (file not found at build time) the try/catch
 * in the require() call is not enough — webpack resolves imports statically.
 *
 * The solution: this file uses a conditional require() that is wrapped so
 * webpack can tree-shake the missing module. If the module cannot be found
 * at runtime a no-op fallback is returned — zero behaviour change for the
 * product plugin, zero build error when flash-sale is absent.
 */

import { useState, useEffect } from "react";

// ── Shared result type (duplicated here so this file has zero hard dependencies)

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

// ── No-op fallback — used when flash-sale plugin is not installed ─────────────

function noopResolve(originalPrice: number): FlashSaleResult {
    return {
        applied:         false,
        regularPrice:    originalPrice,
        sellingPrice:    originalPrice,
        discountPercent: 0,
        campaign:        null,
    };
}

function useNoopFlashSale(): UseFlashSaleReturn {
    return { ready: true, resolvePrice: noopResolve };
}

// ── Try to load the real hook — resolved at module evaluation time ────────────
// `require` inside a try/catch is evaluated at runtime in Node (SSR) and is
// bundled by webpack. For webpack to not hard-error on a missing module we use
// require.resolve wrapped in try/catch so the *import* is optional.
//
// In Next.js App Router (webpack 5) an unresolvable `require()` causes a build
// error too. The only reliable way to make an import optional without changing
// the missing plugin is to keep a single canonical file that either re-exports
// the real hook or exports the fallback — which is exactly what this file does.
//
// If the flash-sale plugin is present, its hook is used directly.
// If it is absent the fallback is used — no build error, no runtime error.

let realHook: (() => UseFlashSaleReturn) | null = null;

try {
    // This require() is evaluated once. If the file exists it returns the module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@/plugin/flash-sale/lib/useFlashSale");
    if (typeof mod?.default === "function") {
        realHook = mod.default as () => UseFlashSaleReturn;
    }
} catch {
    // Flash-sale plugin not installed — realHook stays null
}

/**
 * Drop-in replacement for `useFlashSale` that is safe to import from any
 * component in the product plugin regardless of whether the flash-sale plugin
 * is installed.
 */
export function useFlashSaleOptional(): UseFlashSaleReturn {
    // Hook rules: always call hooks unconditionally.
    // We call the real hook when available, otherwise the no-op.
    if (realHook) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return realHook();
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useNoopFlashSale();
}
