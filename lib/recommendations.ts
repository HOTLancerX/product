/**
 * plugin/product/lib/recommendations.ts
 *
 * Re-exports smart recommendations from the gadgets plugin.
 */

export * from "@/plugin/gadgets/lib/recommendations";
export { getSmartFrequentlyTogether as default } from "@/plugin/gadgets/lib/recommendations";
