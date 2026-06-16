'use client';

/**
 * Variant.tsx — Frontend product variant selector.
 *
 * Renders per-attribute option pickers on the public product page.
 * Each attribute can be displayed as one of six styles, set per-attribute
 * in PostFormMultivariate:
 *
 *   text         — pill buttons with the value label
 *   color        — solid color circles (hex from variant.color)
 *   color-text   — color circle + label side-by-side
 *   images       — variant thumbnail image only
 *   images-text  — variant thumbnail + label
 *   drop-down    — native <select>
 *
 * Falls back to "text" if displayStyle is missing or unrecognised.
 *
 * Props mirror exactly what Products-1.tsx (reference design) passes:
 *   info             — raw post data (variants, selectedAttributes, etc.)
 *   attributes       — computed attribute list (built by parent useMemo)
 *   selectedOptions  — { [attributeLabel]: selectedValue }
 *   selectedVariant  — the currently active variant object or null
 *   displayStyle     — legacy global style (unused if per-attr styles exist)
 *   layoutStyle      — alias for displayStyle
 *   onOptionSelect   — (label, value) => void
 *   currencySymbol   — e.g. "$"
 */

import Image from 'next/image';
import { Icon } from '@iconify/react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Attribute {
    label: string;
    values: string[];
    displayStyle?: string;
    position?: number;
}

interface Variant {
    id?: string;
    handle?: string;
    title?: string;
    emotion?: string;
    options?: Record<string, string>;
    sku?: string;
    price?: string;
    quantity?: string;
    color?: string;
    image?: string;
    gallery?: string[];
    priceTiers?: { rangeStart: string; rangeEnd: string; price: string }[];
}

interface VariantProps {
    info: any;
    attributes: Attribute[];
    selectedOptions: Record<string, string>;
    selectedVariant: Variant | null;
    displayStyle?: string;
    layoutStyle?: string;
    onOptionSelect: (label: string, value: string) => void;
    currencySymbol?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * For a given option value, find the first variant that carries it and
 * return its .color field (set in PostFormMultivariate's color picker).
 */
function getVariantColor(info: any, value: string): string | undefined {
    if (!info?.variants) return undefined;
    const match = (info.variants as Variant[]).find(
        (v) => v.options && Object.values(v.options).includes(value)
    );
    return match?.color || undefined;
}

/**
 * For a given option value return the image of the first variant that has it.
 * Used for "images" and "images-text" display styles.
 */
function getVariantImage(info: any, value: string): string | undefined {
    if (!info?.variants) return undefined;
    const match = (info.variants as Variant[]).find(
        (v) => v.options && Object.values(v.options).includes(value)
    );
    return match?.image || undefined;
}

/**
 * Return true when this option combination is represented by at least one
 * variant (regardless of stock). Used to grey-out unavailable combinations.
 */
function isOptionAvailable(
    info: any,
    label: string,
    value: string,
    selectedOptions: Record<string, string>
): boolean {
    if (!info?.variants) return true;
    const testOptions = { ...selectedOptions, [label]: value };
    return (info.variants as Variant[]).some((v) => {
        if (!v.options) return false;
        return Object.entries(testOptions).every(
            ([k, val]) => v.options![k] === val
        );
    });
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface OptionPickerProps {
    info: any;
    attr: Attribute;
    selectedOptions: Record<string, string>;
    onOptionSelect: (label: string, value: string) => void;
}

/** Pill / text style */
function TextOptions({ info, attr, selectedOptions, onOptionSelect }: OptionPickerProps) {
    return (
        <div className="flex flex-wrap gap-2">
            {attr.values.map((value) => {
                const selected = selectedOptions[attr.label] === value;
                const available = isOptionAvailable(info, attr.label, value, selectedOptions);
                return (
                    <button
                        key={value}
                        type="button"
                        disabled={!available}
                        onClick={() => onOptionSelect(attr.label, value)}
                        className={`
                            px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all
                            ${selected
                                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                : available
                                    ? 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                                    : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                            }
                        `}
                        aria-pressed={selected}
                        aria-label={`Select ${attr.label}: ${value}`}
                    >
                        {value}
                    </button>
                );
            })}
        </div>
    );
}

/** Color swatch style */
function ColorOptions({ info, attr, selectedOptions, onOptionSelect }: OptionPickerProps) {
    return (
        <div className="flex flex-wrap gap-3">
            {attr.values.map((value) => {
                const selected = selectedOptions[attr.label] === value;
                const available = isOptionAvailable(info, attr.label, value, selectedOptions);
                const color = getVariantColor(info, value);
                return (
                    <button
                        key={value}
                        type="button"
                        disabled={!available}
                        onClick={() => onOptionSelect(attr.label, value)}
                        title={value}
                        aria-pressed={selected}
                        aria-label={`Select ${attr.label}: ${value}`}
                        className={`
                            relative w-9 h-9 rounded-full border-2 transition-all
                            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                            ${selected ? 'border-blue-500 ring-2 ring-blue-200 scale-110' : 'border-white shadow ring-1 ring-gray-300 hover:scale-110 hover:ring-blue-300'}
                            ${!available ? 'opacity-40 cursor-not-allowed' : ''}
                        `}
                        style={color ? { backgroundColor: color } : { backgroundColor: '#e5e7eb' }}
                    >
                        {!color && (
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-500 select-none">
                                {value.charAt(0).toUpperCase()}
                            </span>
                        )}
                        {selected && (
                            <span className="absolute inset-0 flex items-center justify-center">
                                <Icon
                                    icon="mdi:check"
                                    width="16"
                                    height="16"
                                    className={color ? 'text-white drop-shadow' : 'text-gray-700'}
                                />
                            </span>
                        )}
                        {/* Strike-through diagonal for unavailable */}
                        {!available && (
                            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <svg viewBox="0 0 36 36" className="w-full h-full" aria-hidden="true">
                                    <line x1="4" y1="4" x2="32" y2="32" stroke="rgba(150,150,150,0.6)" strokeWidth="2.5" strokeLinecap="round" />
                                </svg>
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/** Color swatch + text label */
function ColorTextOptions({ info, attr, selectedOptions, onOptionSelect }: OptionPickerProps) {
    return (
        <div className="flex flex-wrap gap-2">
            {attr.values.map((value) => {
                const selected = selectedOptions[attr.label] === value;
                const available = isOptionAvailable(info, attr.label, value, selectedOptions);
                const color = getVariantColor(info, value);
                return (
                    <button
                        key={value}
                        type="button"
                        disabled={!available}
                        onClick={() => onOptionSelect(attr.label, value)}
                        aria-pressed={selected}
                        aria-label={`Select ${attr.label}: ${value}`}
                        className={`
                            inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all
                            ${selected
                                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                : available
                                    ? 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                                    : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                            }
                        `}
                    >
                        <span
                            className="w-5 h-5 rounded-full border border-gray-200 shrink-0 flex items-center justify-center"
                            style={color ? { backgroundColor: color } : { backgroundColor: '#e5e7eb' }}
                        >
                            {!color && (
                                <span className="text-[8px] font-bold text-gray-500">
                                    {value.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </span>
                        <span className={!available ? 'line-through' : ''}>{value}</span>
                    </button>
                );
            })}
        </div>
    );
}

/** Image thumbnail style */
function ImageOptions({ info, attr, selectedOptions, onOptionSelect, withLabel }: OptionPickerProps & { withLabel?: boolean }) {
    return (
        <div className="flex flex-wrap gap-2">
            {attr.values.map((value) => {
                const selected = selectedOptions[attr.label] === value;
                const available = isOptionAvailable(info, attr.label, value, selectedOptions);
                const img = getVariantImage(info, value);
                return (
                    <button
                        key={value}
                        type="button"
                        disabled={!available}
                        onClick={() => onOptionSelect(attr.label, value)}
                        aria-pressed={selected}
                        aria-label={`Select ${attr.label}: ${value}`}
                        className={`
                            flex flex-col items-center gap-1 rounded-lg border-2 p-1 transition-all
                            ${selected
                                ? 'border-blue-500 bg-blue-50 shadow-sm'
                                : available
                                    ? 'border-gray-200 bg-white hover:border-blue-300'
                                    : 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                            }
                        `}
                    >
                        <div className="relative w-14 h-14 rounded overflow-hidden bg-gray-100">
                            {img ? (
                                <Image
                                    src={img}
                                    alt={value}
                                    fill
                                    className={`object-contain ${!available ? 'opacity-40' : ''}`}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    <Icon icon="mdi:image-off" width="20" height="20" />
                                </div>
                            )}
                            {selected && (
                                <span className="absolute top-0.5 right-0.5 bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center shadow">
                                    <Icon icon="mdi:check" width="11" height="11" className="text-white" />
                                </span>
                            )}
                        </div>
                        {withLabel && (
                            <span className={`text-xs font-medium ${selected ? 'text-blue-700' : 'text-gray-600'} ${!available ? 'line-through' : ''}`}>
                                {value}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/** Drop-down <select> style */
function DropDownOptions({ info, attr, selectedOptions, onOptionSelect }: OptionPickerProps) {
    return (
        <div className="relative">
            <select
                value={selectedOptions[attr.label] ?? ''}
                onChange={(e) => {
                    if (e.target.value) onOptionSelect(attr.label, e.target.value);
                }}
                aria-label={`Select ${attr.label}`}
                className="appearance-none w-full max-w-xs rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white outline-none focus:border-blue-500 transition-colors cursor-pointer pr-9"
            >
                <option value="" disabled>
                    Select {attr.label}
                </option>
                {attr.values.map((value) => {
                    const available = isOptionAvailable(info, attr.label, value, selectedOptions);
                    return (
                        <option key={value} value={value} disabled={!available}>
                            {value}{!available ? ' (unavailable)' : ''}
                        </option>
                    );
                })}
            </select>
            {/* Custom chevron */}
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Icon icon="mdi:chevron-down" width="18" height="18" />
            </span>
        </div>
    );
}

// ── Tiered pricing table ──────────────────────────────────────────────────────

interface TieredPricingProps {
    tiers: { rangeStart: string; rangeEnd: string; price: string }[];
    currencySymbol: string;
    currentQty: number;
}

function TieredPricingTable({ tiers, currencySymbol, currentQty }: TieredPricingProps) {
    if (!tiers || tiers.length === 0) return null;
    return (
        <div className="mt-3 border rounded-lg overflow-hidden text-sm">
            <div className="bg-gray-50 px-3 py-1.5 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b">
                Quantity Pricing
            </div>
            <div className="divide-y">
                {tiers.map((tier, i) => {
                    const start = parseInt(tier.rangeStart) || 0;
                    const end   = parseInt(tier.rangeEnd) || Infinity;
                    const active = currentQty >= start && currentQty <= end;
                    return (
                        <div
                            key={i}
                            className={`grid grid-cols-3 px-3 py-2 transition-colors ${active ? 'bg-green-50 font-semibold text-green-700' : 'text-gray-600'}`}
                        >
                            <span>{tier.rangeStart}–{tier.rangeEnd === '' ? '∞' : tier.rangeEnd}</span>
                            <span className="text-center text-gray-400 text-xs self-center">units</span>
                            <span className="text-right">
                                {currencySymbol}&nbsp;
                                {Number(tier.price || 0).toLocaleString('en-US', {
                                    minimumFractionDigits: parseFloat(tier.price || '0') % 1 === 0 ? 0 : 2,
                                    maximumFractionDigits: 2,
                                })}
                                {active && (
                                    <Icon icon="mdi:check-circle" width="14" height="14" className="inline ml-1.5 text-green-600" />
                                )}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function Variant({
    info,
    attributes,
    selectedOptions,
    selectedVariant,
    onOptionSelect,
    currencySymbol = '$',
}: VariantProps) {
    if (!info?.variants || info.variants.length === 0) return null;
    if (!attributes || attributes.length === 0) return null;

    return (
        <div className="flex flex-col gap-5 mb-6">
            {attributes.map((attr) => {
                // Per-attribute display style (set in PostFormMultivariate)
                // Falls back gracefully to "text".
                const style = attr.displayStyle || 'text';
                const selectedValue = selectedOptions[attr.label];

                return (
                    <div key={attr.label}>
                        {/* Label row */}
                        <div className="flex items-baseline gap-2 mb-2.5">
                            <span className="text-sm font-semibold text-gray-700">{attr.label}</span>
                            {selectedValue && (
                                <span className="text-sm text-gray-500 font-normal">
                                    : <span className="font-medium text-gray-800">{selectedValue}</span>
                                </span>
                            )}
                        </div>

                        {/* Option buttons */}
                        {style === 'color' && (
                            <ColorOptions
                                info={info}
                                attr={attr}
                                selectedOptions={selectedOptions}
                                onOptionSelect={onOptionSelect}
                            />
                        )}
                        {style === 'color-text' && (
                            <ColorTextOptions
                                info={info}
                                attr={attr}
                                selectedOptions={selectedOptions}
                                onOptionSelect={onOptionSelect}
                            />
                        )}
                        {style === 'images' && (
                            <ImageOptions
                                info={info}
                                attr={attr}
                                selectedOptions={selectedOptions}
                                onOptionSelect={onOptionSelect}
                            />
                        )}
                        {style === 'images-text' && (
                            <ImageOptions
                                info={info}
                                attr={attr}
                                selectedOptions={selectedOptions}
                                onOptionSelect={onOptionSelect}
                                withLabel
                            />
                        )}
                        {style === 'drop-down' && (
                            <DropDownOptions
                                info={info}
                                attr={attr}
                                selectedOptions={selectedOptions}
                                onOptionSelect={onOptionSelect}
                            />
                        )}
                        {/* text + any unrecognised style */}
                        {(style === 'text' || !['color', 'color-text', 'images', 'images-text', 'drop-down'].includes(style)) && (
                            <TextOptions
                                info={info}
                                attr={attr}
                                selectedOptions={selectedOptions}
                                onOptionSelect={onOptionSelect}
                            />
                        )}
                    </div>
                );
            })}

            {/* Selected variant detail row */}
            {selectedVariant && (
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    {selectedVariant.sku && (
                        <span>
                            SKU: <span className="font-mono font-semibold text-gray-700">{selectedVariant.sku}</span>
                        </span>
                    )}
                    {selectedVariant.emotion && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
                            {selectedVariant.emotion}
                        </span>
                    )}
                    {selectedVariant.title && (
                        <span className="text-gray-600">{selectedVariant.title}</span>
                    )}
                </div>
            )}

            {/* Tiered pricing for selected variant */}
            {selectedVariant?.priceTiers && selectedVariant.priceTiers.length > 0 && (
                <TieredPricingTable
                    tiers={selectedVariant.priceTiers}
                    currencySymbol={currencySymbol}
                    currentQty={1}
                />
            )}
        </div>
    );
}
