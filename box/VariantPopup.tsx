'use client';

/**
 * plugin/product/box/VariantPopup.tsx
 *
 * Portal modal for selecting a product variant before adding to cart.
 *
 * Features:
 *  - Renders into document.body via createPortal (never clipped by overflow:hidden)
 *  - Adapts to the site's `--color-main` CSS variable for accent colour
 *  - Color swatches or text chips depending on attribute displayStyle
 *  - Unavailable option combinations are greyed + crossed out
 *  - Preview image swaps when a color/image attribute is picked
 *  - Qty stepper with max enforcement
 *  - Flash-sale price awareness (reads matched.price directly)
 *  - Escape key + backdrop click to close
 *  - Body scroll lock while open
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Icon } from '@iconify/react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VariantData {
    id:        string;
    handle:    string;
    options:   Record<string, string>;
    color?:    string;
    image?:    string;
    price?:    string;
    quantity?: string;
    sku?:      string;
    emotion?:  string;
    shippingInside?:  string;
    shippingOutside?: string;
}

export interface VariantPopupProps {
    productId:          string;
    productSlug:        string;
    productTitle:       string;
    productImage:       string;
    variants:           VariantData[];
    selectedAttributes: { label: string; values: string[]; displayStyle?: string }[];
    currencySymbol:     string;
    onClose:            () => void;
    onAddToCart:        (variant: VariantData, qty: number) => void;
    shippingInside?:    number;
    shippingOutside?:   number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(n: number, sym: string): string {
    return `${sym}${Number(n).toLocaleString('en-US', {
        minimumFractionDigits: n % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
    })}`;
}

function findVariant(
    variants: VariantData[],
    selection: Record<string, string>
): VariantData | null {
    return variants.find((v) =>
        Object.entries(selection).every(([k, val]) => v.options[k] === val)
    ) ?? null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VariantPopup({
    productTitle,
    productImage,
    variants,
    selectedAttributes,
    currencySymbol,
    onClose,
    onAddToCart,
}: VariantPopupProps) {
    // Initialise each attribute to its first value
    const buildInitial = useCallback(() => {
        const sel: Record<string, string> = {};
        for (const attr of selectedAttributes) {
            if (attr.values.length > 0) sel[attr.label] = attr.values[0];
        }
        return sel;
    }, [selectedAttributes]);

    const [selection, setSelection]   = useState<Record<string, string>>(buildInitial);
    const [qty, setQty]               = useState(1);
    const [previewImg, setPreviewImg] = useState(productImage);

    const matched  = findVariant(variants, selection);
    const inStock  = matched ? parseInt(matched.quantity ?? '0', 10) > 0 : false;
    const price    = matched ? parseFloat(matched.price ?? '0') || 0 : 0;
    const maxQty   = matched ? parseInt(matched.quantity ?? '0', 10) || 9999 : 9999;

    // Sync preview image when matched variant changes
    useEffect(() => {
        setPreviewImg(matched?.image ? matched.image : productImage);
    }, [matched, productImage]);

    // Escape key + scroll lock
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handler);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    const pick = (label: string, value: string) => {
        setSelection((prev) => ({ ...prev, [label]: value }));
        const candidate = variants.find((v) => v.options[label] === value && v.image);
        if (candidate?.image) setPreviewImg(candidate.image);
    };

    const handleAdd = () => {
        if (!matched || !inStock) return;
        onAddToCart(matched, qty);
        onClose();
    };

    const isComplete = selectedAttributes.every((a) => selection[a.label] !== undefined);

    // ── Render ────────────────────────────────────────────────────────────────

    const modal = (
        <div
            className="fixed inset-0 z-999 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            role="dialog"
            aria-modal="true"
            aria-label="Select product variant"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Sheet / Dialog */}
            <div className="relative z-10 bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">

                {/* ── Drag handle (mobile) ── */}
                <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1 rounded-full bg-gray-300" />
                </div>

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
                    <h2 className="text-sm font-bold text-gray-900 line-clamp-1 flex-1 pr-3">
                        {productTitle}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                        aria-label="Close"
                    >
                        <Icon icon="mdi:close" width={15} />
                    </button>
                </div>

                {/* ── Scrollable body ── */}
                <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

                    {/* Product summary row */}
                    <div className="flex gap-4 items-start">
                        {/* Image */}
                        <div className="shrink-0 w-28 h-28 rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden shadow-sm">
                            {previewImg ? (
                                <Image
                                    src={previewImg}
                                    alt={productTitle}
                                    width={112}
                                    height={112}
                                    className="w-full h-full object-contain transition-all duration-300"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-200">
                                    <Icon icon="mdi:image-off" width={32} />
                                </div>
                            )}
                        </div>

                        {/* Price + stock */}
                        <div className="flex-1 min-w-0 pt-1 space-y-1.5">
                            <p className="text-xs text-gray-500 line-clamp-2 leading-snug">
                                {productTitle}
                            </p>
                            {price > 0 ? (
                                <p className="text-xl font-extrabold text-main">
                                    {fmtPrice(price, currencySymbol)}
                                </p>
                            ) : (
                                <p className="text-sm text-gray-400 italic">Select options to see price</p>
                            )}
                            {matched && (
                                <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    inStock
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-red-50 text-red-600'
                                }`}>
                                    <Icon
                                        icon={inStock ? 'mdi:check-circle' : 'mdi:close-circle'}
                                        width={12}
                                    />
                                    {inStock ? `${matched.quantity} in stock` : 'Out of stock'}
                                </div>
                            )}
                            {matched?.sku && (
                                <p className="text-[10px] text-gray-400">SKU: {matched.sku}</p>
                            )}
                        </div>
                    </div>

                    {/* Attribute selectors */}
                    {selectedAttributes.map((attr) => {
                        const isColor = (attr.displayStyle ?? '').includes('color');
                        return (
                            <div key={attr.label} className="space-y-2.5">
                                {/* Label row */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                                        {attr.label}
                                    </span>
                                    {selection[attr.label] && (
                                        <span className="text-xs text-gray-500 font-medium">
                                            — {selection[attr.label]}
                                        </span>
                                    )}
                                </div>

                                {/* Options */}
                                <div className="flex flex-wrap gap-2">
                                    {attr.values.map((val) => {
                                        const isSelected = selection[attr.label] === val;
                                        const colorVariant = variants.find(
                                            (v) => v.options[attr.label] === val && v.color
                                        );
                                        const hex = colorVariant?.color ?? '';

                                        const available = variants.some((v) => {
                                            if (v.options[attr.label] !== val) return false;
                                            return Object.entries(selection).every(
                                                ([k, sv]) => k === attr.label || v.options[k] === sv
                                            );
                                        });

                                        if (isColor && hex) {
                                            return (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => pick(attr.label, val)}
                                                    title={val}
                                                    disabled={!available}
                                                    className={`relative w-9 h-9 rounded-full transition-all focus:outline-none ${
                                                        isSelected
                                                            ? 'ring-2 ring-offset-2 ring-main scale-110 shadow-md'
                                                            : available
                                                                ? 'ring-1 ring-gray-200 hover:ring-main hover:scale-105 shadow-sm'
                                                                : 'opacity-30 cursor-not-allowed'
                                                    }`}
                                                    style={{ backgroundColor: hex }}
                                                >
                                                    {isSelected && (
                                                        <span className="absolute inset-0 flex items-center justify-center">
                                                            <Icon icon="mdi:check" width={14} className="text-white drop-shadow" />
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        }

                                        return (
                                            <button
                                                key={val}
                                                type="button"
                                                onClick={() => pick(attr.label, val)}
                                                disabled={!available}
                                                className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all focus:outline-none ${
                                                    isSelected
                                                        ? 'bg-main text-white border-main shadow-sm shadow-main/30'
                                                        : available
                                                            ? 'bg-white text-gray-700 border-gray-200 hover:border-main hover:text-main'
                                                            : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed line-through'
                                                }`}
                                            >
                                                {val}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* Qty stepper */}
                    <div className="space-y-2.5">
                        <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                            Quantity
                        </span>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                                    className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                    <Icon icon="mdi:minus" width={15} />
                                </button>
                                <span className="w-12 text-center text-base font-bold text-gray-900 select-none">
                                    {qty}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                                    disabled={qty >= maxQty}
                                    className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Icon icon="mdi:plus" width={15} />
                                </button>
                            </div>
                            {matched && inStock && (
                                <span className="text-xs text-gray-400">
                                    {maxQty} available
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="shrink-0 px-5 pb-5 pt-4 border-t border-gray-100 space-y-3 bg-white">
                    {/* Selection hint */}
                    {!isComplete && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                            <Icon icon="mdi:alert-circle-outline" width={14} className="text-amber-500 shrink-0" />
                            <p className="text-xs text-amber-700 font-medium">
                                Please select all options above
                            </p>
                        </div>
                    )}

                    {/* Price summary */}
                    {isComplete && price > 0 && (
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs text-gray-500">
                                {qty} × {fmtPrice(price, currencySymbol)}
                            </span>
                            <span className="text-base font-extrabold text-main">
                                {fmtPrice(price * qty, currencySymbol)}
                            </span>
                        </div>
                    )}

                    {/* CTA */}
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={!isComplete || !inStock}
                        className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-main text-white hover:opacity-90 shadow-md shadow-main/20 active:scale-[0.98]"
                    >
                        <Icon icon="mdi:cart-plus" width={18} />
                        {!isComplete
                            ? 'Select Options'
                            : !inStock
                                ? 'Out of Stock'
                                : `Add ${qty > 1 ? qty + ' items' : ''} to Cart`
                        }
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
