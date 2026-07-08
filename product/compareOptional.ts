"use client";

/**
 * plugin/product/product/compareOptional.ts
 *
 * Self-contained client-side registry for the Compare UI component.
 * Mirrors the pattern in flashSaleOptional.ts — zero direct imports
 * from @/plugin/compare/*.
 *
 * The compare plugin calls registerCompareComponent() in its index.ts
 * register() function. ProductClient reads it via getCompareComponent().
 *
 * When the compare plugin is inactive / absent:
 *   - registerCompareComponent() is never called.
 *   - getCompareComponent() returns null.
 *   - CompareSection renders nothing.
 */

import type { ComponentType } from "react";

type CompareProps = {
    current:         any;
    compareProducts: any[];
    categoryProducts: any[];
    currencySymbol:  string;
    style:           number;
};

let _compareComponent: ComponentType<CompareProps> | null = null;

/**
 * Called by the compare plugin's register() to inject its Compare component.
 */
export function registerCompareComponent(
    component: ComponentType<CompareProps>
): void {
    _compareComponent = component;
}

/**
 * Returns the registered Compare component, or null if plugin is inactive.
 */
export function getCompareComponent(): ComponentType<CompareProps> | null {
    return _compareComponent;
}
