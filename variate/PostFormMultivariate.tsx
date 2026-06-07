'use client';

import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import Gallery from '@/components/Gallery';

interface Attribute {
    id: string;
    dbId?: string;
    label: string;
    values: string[];
    hasChildren?: boolean;
    position?: number;
    displayStyle?: 'text' | 'images' | 'images-text' | 'drop-down' | 'color' | 'color-text';
}

interface Variant {
    id: string;
    handle: string;
    title: string;
    options: Record<string, string>;
    sku: string;
    price: string;
    quantity: string;
    emotion: string;
    color: string;
    image: string;
    gallery: string[];
    priceTiers: { rangeStart: string; rangeEnd: string; price: string }[];
    showTiers: boolean;
}

interface DbAttribute {
    id: string;
    title: string;
    parentId?: string;
    metaKeyword?: string;
}

interface PostFormMultivariateProps {
    attributes: DbAttribute[];
    attrLoading?: boolean;
    onRefreshAttributes?: () => void;
    selectedAttributes: Attribute[];
    setSelectedAttributes: (attrs: Attribute[]) => void;
    attributeInputs: Record<string, string>;
    setAttributeInputs: (inputs: Record<string, string>) => void;
    variants: Variant[];
    setVariants: (variants: Variant[]) => void;
    showPreview: boolean;
    setShowPreview: (v: boolean) => void;
    variantDisplayStyle: 'text' | 'images' | 'images-text' | 'drop-down' | 'color' | 'color-text' | string;
    setVariantDisplayStyle: (v: any) => void;
    onGenerateVariants: () => void;
    onUpdateVariant: (id: string, field: string, value: any) => void;
    onTogglePriceTiers: (id: string) => void;
    onAddPriceTier: (variantId: string) => void;
    onRemovePriceTier: (variantId: string, tierIndex: number) => void;
    onUpdatePriceTier: (variantId: string, tierIndex: number, field: string, value: string) => void;
    onBulkUpdateField: (field: string, value: string) => void;
    title?: string;
}

export default function PostFormMultivariate({
    attributes,
    attrLoading = false,
    onRefreshAttributes,
    selectedAttributes,
    setSelectedAttributes,
    attributeInputs,
    setAttributeInputs,
    variants,
    setVariants,
    showPreview,
    setShowPreview,
    variantDisplayStyle,
    setVariantDisplayStyle,
    onGenerateVariants,
    onUpdateVariant,
    onTogglePriceTiers,
    onAddPriceTier,
    onRemovePriceTier,
    onUpdatePriceTier,
    onBulkUpdateField,
    title = '',
}: PostFormMultivariateProps) {

    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [enrichLoading, setEnrichLoading] = useState(false);
    const [imageCopied, setImageCopied] = useState<{ image: string; gallery: string[] } | null>(null);

    // ── AI Auto-Fill ──────────────────────────────────────────────────────────
    const handleAiAutoFill = async () => {
        if (!title.trim()) {
            setAiError('Please enter a product title first.');
            return;
        }
        setAiLoading(true);
        setAiError(null);
        try {
            const res = await fetch('/api/variate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'AI request failed');

            const incoming: typeof selectedAttributes = data.attributes;
            if (!incoming?.length) {
                setAiError('AI returned no attributes. Try a more descriptive title.');
                return;
            }

            // Merge: keep existing attrs not already covered by AI result,
            // then append AI attrs (deduped by dbId / label).
            const merged = [...selectedAttributes];
            for (const aiAttr of incoming) {
                const alreadyById = aiAttr.dbId
                    ? merged.some(a => a.dbId === aiAttr.dbId)
                    : false;
                const alreadyByLabel = merged.some(
                    a => a.label.toLowerCase() === aiAttr.label.toLowerCase()
                );
                if (!alreadyById && !alreadyByLabel) {
                    merged.push(aiAttr);
                }
            }
            // Re-assign positions sequentially
            setSelectedAttributes(
                merged.map((a, idx) => ({ ...a, position: idx + 1 }))
            );
        } catch (err: any) {
            setAiError(err.message || 'Something went wrong');
        } finally {
            setAiLoading(false);
        }
    };

    // ── AI Enrich Variants (Step 2) ───────────────────────────────────────────
    // After variants are generated, call AI to fill color codes + KES prices
    const handleAiEnrich = async () => {
        if (!title.trim()) {
            setAiError('Please enter a product title first.');
            return;
        }
        if (variants.length === 0) {
            setAiError('Generate variants first before enriching.');
            return;
        }
        setEnrichLoading(true);
        setAiError(null);
        try {
            const res = await fetch('/api/variate/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    variants: variants.map(v => ({
                        id: v.id,
                        handle: v.handle,
                        options: v.options,
                    })),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'AI enrich request failed');

            const enriched: { id: string; color: string; price: string }[] = data.enriched;
            if (!enriched?.length) {
                setAiError('AI returned no enrichment data.');
                return;
            }

            // Apply enrichment — only overwrite color/price if AI returned a value
            // and the field is currently empty (don't clobber user edits)
            const enrichMap = new Map(enriched.map(e => [e.id, e]));
            setVariants(
                variants.map(v => {
                    const e = enrichMap.get(v.id);
                    if (!e) return v;
                    return {
                        ...v,
                        color: e.color || v.color,
                        price: v.price ? v.price : e.price,
                    };
                })
            );
        } catch (err: any) {
            setAiError(err.message || 'Something went wrong during enrichment');
        } finally {
            setEnrichLoading(false);
        }
    };

    const addAttribute = () => {
        const maxPos = selectedAttributes.reduce((m, a) => Math.max(m, a.position ?? 0), 0);
        setSelectedAttributes([...selectedAttributes, {
            id: Date.now().toString(),
            label: '',
            values: [],
            position: maxPos + 1,
            displayStyle: 'text',
        }]);
    };

    const removeAttribute = (id: string) => {
        setSelectedAttributes(selectedAttributes.filter(a => a.id !== id));
    };

    const updateAttribute = (id: string, patch: Partial<Attribute>) => {
        setSelectedAttributes(selectedAttributes.map(a => a.id === id ? { ...a, ...patch } : a));
    };

    const moveAttribute = (id: string, direction: 'up' | 'down') => {
        const sorted = [...selectedAttributes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        const idx = sorted.findIndex(a => a.id === id);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;
        const posA = sorted[idx].position ?? idx;
        const posB = sorted[swapIdx].position ?? swapIdx;
        setSelectedAttributes(selectedAttributes.map(a => {
            if (a.id === sorted[idx].id) return { ...a, position: posB };
            if (a.id === sorted[swapIdx].id) return { ...a, position: posA };
            return a;
        }));
    };

    const handleAttributeValueInput = (attrId: string, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const inputValue = attributeInputs[attrId] || '';
            if (!inputValue.trim()) return;
            const newValues = inputValue.split(',').map(v => v.trim()).filter(Boolean);
            setSelectedAttributes(selectedAttributes.map(a => {
                if (a.id !== attrId) return a;
                const existing = a.values || [];
                const unique = newValues.filter(v => !existing.includes(v));
                // prepend to front
                return { ...a, values: [...unique, ...existing] };
            }));
            setAttributeInputs({ ...attributeInputs, [attrId]: '' });
        }
    };

    const removeAttributeValue = (attrId: string, valueIndex: number) => {
        setSelectedAttributes(selectedAttributes.map(a =>
            a.id === attrId ? { ...a, values: a.values.filter((_, i) => i !== valueIndex) } : a
        ));
    };

    const moveAttributeValue = (attrId: string, valueIndex: number, direction: 'left' | 'right') => {
        setSelectedAttributes(selectedAttributes.map(a => {
            if (a.id !== attrId) return a;
            const values = [...a.values];
            const swapIdx = direction === 'left' ? valueIndex - 1 : valueIndex + 1;
            if (swapIdx < 0 || swapIdx >= values.length) return a;
            [values[valueIndex], values[swapIdx]] = [values[swapIdx], values[valueIndex]];
            return { ...a, values };
        }));
    };

    const toggleDbAttribute = (parentAttr: DbAttribute, children: DbAttribute[], checked: boolean) => {
        if (checked) {
            const maxPos = selectedAttributes.reduce((m, a) => Math.max(m, a.position ?? 0), 0);
            setSelectedAttributes([...selectedAttributes, {
                id: Date.now().toString(),
                dbId: parentAttr.id,
                label: parentAttr.title,
                // Start empty — children appear as suggestions below, user picks manually
                values: [],
                hasChildren: children.length > 0,
                position: maxPos + 1,
                displayStyle: 'text',
            }]);
        } else {
            setSelectedAttributes(selectedAttributes.filter(a => a.dbId !== parentAttr.id));
        }
    };

    const sortedAttrs = [...selectedAttributes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    // Top-level attributes (no parentId) appear in the picker.
    // Attributes that have children show child count + child titles as a preview.
    // Attributes with no children (leaf-only, e.g. flat attribute names) still
    // appear so the user can pick them and type values manually.
    const childParentIdSet = new Set(attributes.filter(a => a.parentId).map(a => a.parentId!));
    const parentDbAttrs = attributes.filter(a => !a.parentId);

    const displayStyleOptions = [
        { value: 'text', label: 'Text Labels' },
        { value: 'color', label: 'Color Labels' },
        { value: 'color-text', label: 'Color + Text' },
        { value: 'images', label: 'Thumbnails' },
        { value: 'images-text', label: 'Images + Text' },
        { value: 'drop-down', label: 'Drop Down' },
    ];

    const globalDisplayStyle = [
        { value: 'list', label: 'List' },
        { value: 'grid', label: 'Grid' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 pb-2 border-b flex-wrap">
                <div className="flex items-center gap-3">
                    <Icon icon="mdi:tune-variant" width="22" height="22" className="text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-800">Multivariate Attributes</h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* AI Auto-Fill button */}
                    <button
                        type="button"
                        onClick={handleAiAutoFill}
                        disabled={aiLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-linear-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all font-medium shadow-sm"
                        title={title ? `Auto-fill attributes for "${title}"` : 'Enter a product title first'}
                    >
                        {aiLoading ? (
                            <>
                                <Icon icon="mdi:loading" width="15" height="15" className="animate-spin" />
                                Fetching…
                            </>
                        ) : (
                            <>
                                <Icon icon="mdi:creation" width="15" height="15" />
                                AI Auto-Fill
                            </>
                        )}
                    </button>
                    {/* Global display style */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-500 font-medium">Default Display:</span>
                        <select
                            value={variantDisplayStyle}
                            onChange={e => setVariantDisplayStyle(e.target.value as any)}
                            className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            {globalDisplayStyle.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* AI error banner */}
            {aiError && (
                <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <Icon icon="mdi:alert-circle-outline" width="16" height="16" className="shrink-0 mt-0.5" />
                    <span className="flex-1">{aiError}</span>
                    <button
                        type="button"
                        onClick={() => setAiError(null)}
                        className="shrink-0 hover:text-red-900"
                    >
                        <Icon icon="mdi:close" width="14" height="14" />
                    </button>
                </div>
            )}

            {/* DB Attribute Picker */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Pick from database
                    </p>
                    <button
                        type="button"
                        onClick={onRefreshAttributes}
                        disabled={attrLoading}
                        className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-40 transition"
                        title="Refresh attributes from database"
                    >
                        <Icon icon={attrLoading ? "mdi:loading" : "mdi:refresh"} width="13" height="13" className={attrLoading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                </div>

                {attrLoading ? (
                    <div className="flex items-center gap-2 py-4 text-gray-400 text-sm">
                        <Icon icon="mdi:loading" width="16" height="16" className="animate-spin" />
                        Loading attributes…
                    </div>
                ) : parentDbAttrs.length === 0 ? (
                    <div className="py-4 text-sm text-gray-400">
                        No attributes found.{" "}
                        <a
                            href="/admin/category/attributes/new"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-500 hover:underline"
                        >
                            Create attributes
                        </a>
                        {" "}first, then refresh.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {parentDbAttrs.map(parentAttr => {
                            const children = attributes.filter(a => a.parentId === parentAttr.id);
                            const isSelected = selectedAttributes.some(a => a.dbId === parentAttr.id);
                            return (
                                <label
                                    key={parentAttr.id}
                                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all select-none ${isSelected
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 bg-white hover:border-blue-300'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={e => toggleDbAttribute(parentAttr, children, e.target.checked)}
                                        className="mt-0.5 accent-blue-600"
                                    />
                                    <div className="min-w-0">
                                        <div className="font-medium text-sm text-gray-800 flex items-center gap-1.5">
                                            {parentAttr.title}
                                            {children.length > 0 && (
                                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-normal">
                                                    {children.length}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-0.5 truncate">
                                            {children.length > 0
                                                ? children.slice(0, 4).map(c => c.title).join(', ') + (children.length > 4 ? ` +${children.length - 4}` : '')
                                                : parentAttr.metaKeyword?.split(',').slice(0, 4).map(v => v.trim()).join(', ')
                                            }
                                        </div>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Selected Attributes */}
            {sortedAttrs.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Configured attributes — drag to reorder
                    </p>
                    {sortedAttrs.map((attr, idx) => (
                        <div
                            key={attr.id}
                            className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden"
                        >
                            {/* Attribute Header Row */}
                            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
                                {/* Position controls */}
                                <div className="flex flex-col gap-0.5">
                                    <button
                                        type="button"
                                        onClick={() => moveAttribute(attr.id, 'up')}
                                        disabled={idx === 0}
                                        className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Move up"
                                    >
                                        <Icon icon="mdi:chevron-up" width="16" height="16" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => moveAttribute(attr.id, 'down')}
                                        disabled={idx === sortedAttrs.length - 1}
                                        className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Move down"
                                    >
                                        <Icon icon="mdi:chevron-down" width="16" height="16" />
                                    </button>
                                </div>

                                {/* Position badge */}
                                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
                                    {idx + 1}
                                </span>

                                {/* Label input */}
                                <input
                                    type="text"
                                    value={attr.label}
                                    onChange={e => updateAttribute(attr.id, { label: e.target.value })}
                                    placeholder="Attribute name (e.g. Color)"
                                    className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                />

                                {/* Display style */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-xs text-gray-500 hidden sm:inline">Style:</span>
                                    <select
                                        value={attr.displayStyle || 'text'}
                                        onChange={e => updateAttribute(attr.id, { displayStyle: e.target.value as any })}
                                        className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        {displayStyleOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Remove */}
                                <button
                                    type="button"
                                    onClick={() => removeAttribute(attr.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                                    title="Remove attribute"
                                >
                                    <Icon icon="mdi:close" width="16" height="16" />
                                </button>
                            </div>

                            {/* Values area */}
                            <div className="p-3 space-y-2">
                                {/* Selected value chips */}
                                {attr.values.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {attr.values.map((value, i) => (
                                            <span
                                                key={i}
                                                className="inline-flex items-center gap-0.5 px-1.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full text-xs font-medium"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => moveAttributeValue(attr.id, i, 'left')}
                                                    disabled={i === 0}
                                                    className="p-0.5 rounded-full hover:bg-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                    title="Move left"
                                                >
                                                    <Icon icon="mdi:chevron-left" width="11" height="11" />
                                                </button>
                                                <span className="px-1">{value}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => moveAttributeValue(attr.id, i, 'right')}
                                                    disabled={i === attr.values.length - 1}
                                                    className="p-0.5 rounded-full hover:bg-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                    title="Move right"
                                                >
                                                    <Icon icon="mdi:chevron-right" width="11" height="11" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeAttributeValue(attr.id, i)}
                                                    className="hover:text-red-600 ml-0.5 p-0.5 rounded-full hover:bg-red-100 transition-colors"
                                                    title="Remove value"
                                                >
                                                    <Icon icon="mdi:close" width="11" height="11" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Type to add new values */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={attributeInputs[attr.id] || ''}
                                        onChange={e => setAttributeInputs({ ...attributeInputs, [attr.id]: e.target.value })}
                                        onKeyDown={e => {
                                            if (e.key !== 'Enter') return;
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const raw = (e.target as HTMLInputElement).value.trim();
                                            if (!raw) return;
                                            const newVals = raw.split(',').map(v => v.trim()).filter(Boolean);
                                            const existing: string[] = attr.values || [];
                                            const toAdd = newVals.filter(v => !existing.includes(v));
                                            if (!toAdd.length) return;
                                            updateAttribute(attr.id, { values: [...toAdd, ...existing] });
                                            setAttributeInputs({ ...attributeInputs, [attr.id]: '' });
                                        }}
                                        placeholder="Type value, press Enter (comma-separated ok)"
                                        className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={e => {
                                            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                            const raw = (input?.value || '').trim();
                                            if (!raw) return;
                                            const newVals = raw.split(',').map(v => v.trim()).filter(Boolean);
                                            const existing: string[] = attr.values || [];
                                            const toAdd = newVals.filter(v => !existing.includes(v));
                                            if (!toAdd.length) return;
                                            updateAttribute(attr.id, { values: [...toAdd, ...existing] });
                                            setAttributeInputs({ ...attributeInputs, [attr.id]: '' });
                                        }}
                                        className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 shrink-0 whitespace-nowrap"
                                    >
                                        Add
                                    </button>
                                </div>

                                {/* DB suggestions — unselected children shown as quick-add chips.
                                    When all children are selected, hides automatically. */}
                                {(() => {
                                    if (!attr.dbId) return null;
                                    const dbChildren = attributes.filter(a => a.parentId === attr.dbId);
                                    const dbAttr = attributes.find(a => a.id === attr.dbId);
                                    const allDbValues: string[] = dbChildren.length > 0
                                        ? dbChildren.map(c => c.title)
                                        : (dbAttr?.metaKeyword
                                            ? dbAttr.metaKeyword.split(',').map((v: string) => v.trim()).filter(Boolean)
                                            : []);
                                    // Only show values not yet selected
                                    const suggestions = allDbValues.filter(v => !attr.values.includes(v));
                                    if (suggestions.length === 0) return null;
                                    return (
                                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-dashed border-gray-200">
                                            <span className="w-full text-xs text-gray-400 mb-0.5">Suggestions</span>
                                            {suggestions.map((suggestion, si) => (
                                                <button
                                                    key={si}
                                                    type="button"
                                                    onClick={() => updateAttribute(attr.id, { values: [suggestion, ...(attr.values || [])] })}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-full text-xs hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors"
                                                    title={`Add "${suggestion}"`}
                                                >
                                                    <Icon icon="mdi:plus" width="10" height="10" />
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={addAttribute}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-white border-2 border-dashed border-blue-400 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors font-medium"
                >
                    <Icon icon="mdi:plus" width="16" height="16" />
                    Add Custom Attribute
                </button>

                {selectedAttributes.length > 0 && selectedAttributes.every(a => a.label && a.values.length > 0) && (
                    <button
                        type="button"
                        onClick={onGenerateVariants}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium"
                    >
                        <Icon icon="mdi:auto-fix" width="16" height="16" />
                        Generate Variants
                    </button>
                )}
            </div>

            {/* Preview count */}
            {selectedAttributes.length > 0 && selectedAttributes.every(a => a.values.length > 0) && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                    <Icon icon="mdi:information-outline" width="16" height="16" className="shrink-0" />
                    Will generate{' '}
                    <strong>{selectedAttributes.reduce((acc, a) => acc * a.values.length, 1)}</strong>{' '}
                    variants
                </div>
            )}

            {/* Generated Variants */}
            {variants.length > 0 && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b">
                        <div className="flex items-center gap-2">
                            <Icon icon="mdi:view-list" width="18" height="18" className="text-gray-600" />
                            <h3 className="font-semibold text-gray-800">
                                Generated Variants
                                <span className="ml-2 text-sm font-normal text-gray-500">({variants.length})</span>
                            </h3>
                        </div>

                        {/* Bulk actions */}
                        <div className="flex flex-wrap gap-2">
                            {/* Remove All variants */}
                            <button
                                type="button"
                                onClick={() => setVariants([])}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-all font-medium"
                                title="Remove all generated variants"
                            >
                                <Icon icon="mdi:trash-can-outline" width="13" height="13" />
                                Remove All
                            </button>
                            {/* Step 2: AI Enrich button */}
                            <button
                                type="button"
                                onClick={handleAiEnrich}
                                disabled={enrichLoading}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-linear-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all font-medium shadow-sm"
                                title="Auto-fill color codes and KES prices for all variants"
                            >
                                {enrichLoading ? (
                                    <>
                                        <Icon icon="mdi:loading" width="13" height="13" className="animate-spin" />
                                        Enriching…
                                    </>
                                ) : (
                                    <>
                                        <Icon icon="mdi:creation" width="13" height="13" />
                                        AI Fill Colors &amp; Prices
                                    </>
                                )}
                            </button>
                            {[
                                { id: 'bulk-price', placeholder: 'Bulk price', field: 'price', label: 'Set Price' },
                                { id: 'bulk-qty', placeholder: 'Bulk qty', field: 'quantity', label: 'Set Qty' },
                                { id: 'bulk-tag', placeholder: 'Bulk tag', field: 'emotion', label: 'Set Tag' },
                            ].map(item => (
                                <div key={item.id} className="flex gap-1">
                                    <input
                                        type="text"
                                        id={item.id}
                                        placeholder={item.placeholder}
                                        className="w-24 px-2 py-1.5 text-xs border border-gray-300 rounded-lg"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const el = document.getElementById(item.id) as HTMLInputElement;
                                            if (el?.value) onBulkUpdateField(item.field, el.value);
                                        }}
                                        className="px-2 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 whitespace-nowrap"
                                    >
                                        {item.label}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Variant cards — mobile-friendly card layout */}
                    <div className="space-y-3">
                        {variants.map(variant => (
                            <div key={variant.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                {/* Variant header */}
                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 flex-wrap">
                                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                        {variant.handle}
                                    </span>
                                    {Object.entries(variant.options).map(([key, val]) => (
                                        <span key={key} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                            {key}: <strong>{val}</strong>
                                        </span>
                                    ))}
                                    <div className="ml-auto flex items-center gap-1 shrink-0">
                                        {/* Copy images */}
                                        <button
                                            type="button"
                                            onClick={() => setImageCopied({ image: variant.image, gallery: variant.gallery || [] })}
                                            className={`p-1 rounded-lg transition-colors ${imageCopied?.image === variant.image
                                                ? 'text-green-600 bg-green-50'
                                                : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                                }`}
                                            title="Copy image & gallery"
                                        >
                                            <Icon icon="mdi:content-copy" width="15" height="15" />
                                        </button>
                                        {/* Paste images */}
                                        <button
                                            type="button"
                                            disabled={!imageCopied}
                                            onClick={() => {
                                                if (!imageCopied) return;
                                                setVariants(variants.map(v =>
                                                    v.id === variant.id
                                                        ? { ...v, image: imageCopied.image, gallery: imageCopied.gallery }
                                                        : v
                                                ));
                                            }}
                                            className="p-1 rounded-lg transition-colors text-gray-400 hover:text-purple-600 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed"
                                            title={imageCopied ? 'Paste image & gallery' : 'Nothing copied yet'}
                                        >
                                            <Icon icon="mdi:content-paste" width="15" height="15" />
                                        </button>
                                        {/* Remove variant */}
                                        <button
                                            type="button"
                                            onClick={() => setVariants(variants.filter(v => v.id !== variant.id))}
                                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Remove variant"
                                        >
                                            <Icon icon="mdi:close" width="15" height="15" />
                                        </button>
                                    </div>
                                </div>

                                {/* Variant fields grid */}
                                <div className="p-2 grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-5 gap-2">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Title</label>
                                        <input
                                            type="text"
                                            value={variant.title}
                                            onChange={e => onUpdateVariant(variant.id, 'title', e.target.value)}
                                            placeholder="(optional)"
                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">SubTitle</label>
                                        <input
                                            type="text"
                                            value={variant.emotion}
                                            onChange={e => onUpdateVariant(variant.id, 'emotion', e.target.value)}
                                            placeholder="SubTitle"
                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">SKU</label>
                                        <input
                                            type="text"
                                            value={variant.sku}
                                            onChange={e => onUpdateVariant(variant.id, 'sku', e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Price
                                            <button
                                                type="button"
                                                onClick={() => onTogglePriceTiers(variant.id)}
                                                className="ml-1.5 text-blue-600 hover:underline text-xs"
                                            >
                                                {variant.showTiers ? '− tiers' : '+ tiers'}
                                            </button>
                                        </label>
                                        <input
                                            type="text"
                                            value={variant.price}
                                            onChange={e => onUpdateVariant(variant.id, 'price', e.target.value)}
                                            placeholder="19.99"
                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                                        <input
                                            type="text"
                                            value={variant.quantity}
                                            onChange={e => onUpdateVariant(variant.id, 'quantity', e.target.value)}
                                            placeholder="100"
                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Color</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={variant.color || '#000000'}
                                                onChange={e => onUpdateVariant(variant.id, 'color', e.target.value)}
                                                className="w-9 h-9 p-0.5 border border-gray-300 rounded-lg cursor-pointer bg-white shrink-0"
                                                title="Pick color"
                                            />
                                            <input
                                                type="text"
                                                value={variant.color || ''}
                                                onChange={e => onUpdateVariant(variant.id, 'color', e.target.value)}
                                                placeholder="#000000"
                                                maxLength={9}
                                                className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Image</label>
                                        <Gallery
                                            value={variant.image}
                                            onChange={img => onUpdateVariant(variant.id, 'image', typeof img === 'string' ? img : img[0] || '')}
                                            placeholder="Select image"
                                        />
                                    </div>
                                    <div className="md:col-span-3 sm:col-span-1">
                                        <label className="block text-xs text-gray-500 mb-1">Gallery</label>
                                        <Gallery
                                            multiple
                                            value={variant.gallery || []}
                                            onChange={imgs => onUpdateVariant(variant.id, 'gallery', Array.isArray(imgs) ? imgs : [imgs])}
                                            placeholder="Select gallery"
                                        />
                                    </div>
                                </div>

                                {/* Price tiers */}
                                {variant.showTiers && (
                                    <div className="px-3 pb-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-gray-700">Tiered Pricing</span>
                                            <button
                                                type="button"
                                                onClick={() => onAddPriceTier(variant.id)}
                                                className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                            >
                                                + Add Tier
                                            </button>
                                        </div>
                                        {variant.priceTiers.length === 0 ? (
                                            <p className="text-xs text-gray-400 italic">No tiers yet. Click "+ Add Tier".</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {variant.priceTiers.map((tier, tierIndex) => (
                                                    <div key={tierIndex} className="grid grid-cols-4 gap-2 items-end bg-blue-50 p-2 rounded-lg border border-blue-200">
                                                        <div>
                                                            <label className="block text-xs text-gray-600 mb-1">From</label>
                                                            <input
                                                                type="text"
                                                                value={tier.rangeStart}
                                                                onChange={e => onUpdatePriceTier(variant.id, tierIndex, 'rangeStart', e.target.value)}
                                                                placeholder="1"
                                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-gray-600 mb-1">To</label>
                                                            <input
                                                                type="text"
                                                                value={tier.rangeEnd}
                                                                onChange={e => onUpdatePriceTier(variant.id, tierIndex, 'rangeEnd', e.target.value)}
                                                                placeholder="100"
                                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-gray-600 mb-1">Price</label>
                                                            <input
                                                                type="text"
                                                                value={tier.price}
                                                                onChange={e => onUpdatePriceTier(variant.id, tierIndex, 'price', e.target.value)}
                                                                placeholder="19.99"
                                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => onRemovePriceTier(variant.id, tierIndex)}
                                                            className="px-2 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setShowPreview(!showPreview)}
                            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
                        >
                            {showPreview ? 'Hide Preview' : 'Show Preview'}
                        </button>
                        <button
                            type="button"
                            onClick={() => alert('Check browser console for variant data')}
                            className="px-4 py-2 text-sm bg-gray-600 text-white rounded-xl hover:bg-gray-700"
                        >
                            Export JSON
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
