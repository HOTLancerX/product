'use client';

/**
 * plugin/product/product-category/FilterPanel.tsx
 *
 * Purely controlled — receives filter state and callbacks from
 * ProductGridClient (the single source of truth). No router access here.
 *
 * Supports 4 display styles:
 *   1 — all sections always visible
 *   2 — accordion, multiple open
 *   3 — accordion, single open
 *   4 — horizontal dropdown bar
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '@iconify/react';
import type { AttributeOption } from '@/plugin/product/lib/types';

export type { AttributeOption };

interface FilterPanelProps {
    style?:           1 | 2 | 3 | 4;
    attributeOptions: AttributeOption[];
    /** Optimistic local filter state from parent */
    activeFilters:    Record<string, string[]>;
    minPrice?:        number;
    maxPrice?:        number;
    currentSort:      string;
    showPriceFilter?: boolean;
    onClose?:         () => void;
    /** Callbacks — parent owns all state mutations */
    onToggleFilter:   (attrId: string, value: string) => void;
    onApplyPrice:     (min: string, max: string) => void;
    onClearAll:       () => void;
}

// ── Style-4 single dropdown button + fixed-position panel ────────────────────

function DropdownItem({
    label,
    count,
    children,
}: {
    label: string;
    count: number;
    children: React.ReactNode;
}) {
    const [open, setOpen]   = useState(false);
    const btnRef            = useRef<HTMLButtonElement>(null);
    const panelRef          = useRef<HTMLDivElement>(null);
    const [pos, setPos]     = useState({ top: 0, left: 0, width: 0 });

    const calcPos = useCallback(() => {
        if (!btnRef.current) return;
        const r = btnRef.current.getBoundingClientRect();
        setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: Math.max(r.width, 200) });
    }, []);

    useEffect(() => { if (open) calcPos(); }, [open, calcPos]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (btnRef.current?.contains(e.target as Node) || panelRef.current?.contains(e.target as Node)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);
        window.addEventListener('scroll', close, { passive: true });
        window.addEventListener('resize', close, { passive: true });
        return () => { window.removeEventListener('scroll', close); window.removeEventListener('resize', close); };
    }, [open]);

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={() => setOpen(v => !v)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    open ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                         : 'border-gray-200 hover:border-emerald-400 bg-white text-gray-700'
                }`}
            >
                {label}
                {count > 0 && (
                    <span className="bg-emerald-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                        {count}
                    </span>
                )}
                <Icon icon={open ? 'mdi:chevron-up' : 'mdi:chevron-down'} width="16" />
            </button>
            {open && (
                <div
                    ref={panelRef}
                    style={{ position: 'absolute', top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 9999 }}
                    className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 max-h-72 overflow-y-auto"
                >
                    {children}
                </div>
            )}
        </>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FilterPanel({
    style = 1,
    attributeOptions,
    activeFilters,
    minPrice,
    maxPrice,
    currentSort,
    showPriceFilter = true,
    onClose,
    onToggleFilter,
    onApplyPrice,
    onClearAll,
}: FilterPanelProps) {
    // Price inputs are local — only pushed on "Apply"
    const [localMin, setLocalMin] = useState(minPrice !== undefined ? String(minPrice) : '');
    const [localMax, setLocalMax] = useState(maxPrice !== undefined ? String(maxPrice) : '');

    // Sync price inputs when server state changes (e.g. clear all)
    useEffect(() => { setLocalMin(minPrice !== undefined ? String(minPrice) : ''); }, [minPrice]);
    useEffect(() => { setLocalMax(maxPrice !== undefined ? String(maxPrice) : ''); }, [maxPrice]);

    // Style 2: multiple open
    const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
        const init: Record<string, boolean> = { price: true };
        attributeOptions.forEach((a, i) => { init[a.id] = i === 0; });
        return init;
    });
    // Style 3: single open
    const [openSection, setOpenSection] = useState<string>(
        attributeOptions.length > 0 ? attributeOptions[0].id : 'price'
    );

    const totalActive =
        Object.values(activeFilters).reduce((s, v) => s + v.length, 0) +
        (minPrice !== undefined ? 1 : 0) +
        (maxPrice !== undefined ? 1 : 0);

    const handleClearAll = () => {
        setLocalMin('');
        setLocalMax('');
        onClearAll();
        onClose?.();
    };

    // ── Shared sub-renderers ─────────────────────────────────────────────────

    const renderCheckboxList = (attr: AttributeOption) => {
        const selected = activeFilters[attr.id] || [];
        return (
            <div className="space-y-1.5 pt-1">
                {attr.values.map((val) => {
                    const isActive = selected.includes(val);
                    return (
                        <label key={val} className="flex items-center gap-2 cursor-pointer group select-none">
                            <input
                                type="checkbox"
                                checked={isActive}
                                // onChange fires instantly — parent updates optimistic state immediately
                                onChange={() => onToggleFilter(attr.id, val)}
                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className={`text-sm ${
                                isActive ? 'text-emerald-700 font-medium' : 'text-gray-700 group-hover:text-gray-900'
                            }`}>
                                {val}
                            </span>
                        </label>
                    );
                })}
            </div>
        );
    };

    const renderPriceInputs = () => (
        <div className="pt-1">
            <div className="flex gap-2 items-center">
                <input
                    type="number"
                    placeholder="Min"
                    value={localMin}
                    onChange={(e) => setLocalMin(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-gray-400 text-sm shrink-0">–</span>
                <input
                    type="number"
                    placeholder="Max"
                    value={localMax}
                    onChange={(e) => setLocalMax(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
            </div>
            <button
                type="button"
                onClick={() => onApplyPrice(localMin, localMax)}
                className="mt-2 w-full py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-500 transition-colors"
            >
                Apply
            </button>
        </div>
    );

    const SectionHeader = ({ label, isOpen, onToggle, count }: {
        label: string; isOpen: boolean; onToggle: () => void; count?: number;
    }) => (
        <button type="button" onClick={onToggle} className="w-full flex items-center justify-between py-2 text-left">
            <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                {label}
                {count !== undefined && count > 0 && (
                    <span className="bg-emerald-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                        {count}
                    </span>
                )}
            </span>
            <Icon icon={isOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'} width="18" className="text-gray-500 shrink-0" />
        </button>
    );

    const ClearButton = () => totalActive > 0 ? (
        <button type="button" onClick={handleClearAll}
            className="w-full text-sm text-red-500 hover:text-red-700 flex items-center gap-1 font-medium">
            <Icon icon="mdi:close-circle-outline" width="16" />
            Clear all filters ({totalActive})
        </button>
    ) : null;

    // ── Style 1 ──────────────────────────────────────────────────────────────
    const renderStyle1 = () => (
        <div className="space-y-5">
            <ClearButton />
            {showPriceFilter && (
                <div>
                    <h3 className="text-sm font-semibold mb-2 text-gray-800">Price Range</h3>
                    {renderPriceInputs()}
                </div>
            )}
            {attributeOptions.map((attr) => (
                <div key={attr.id}>
                    <h3 className="text-sm font-semibold mb-1 text-gray-800">{attr.label}</h3>
                    {renderCheckboxList(attr)}
                </div>
            ))}
        </div>
    );

    // ── Style 2 ──────────────────────────────────────────────────────────────
    const renderStyle2 = () => (
        <div className="divide-y divide-gray-100">
            <div className="pb-3"><ClearButton /></div>
            {showPriceFilter && (
                <div className="py-2">
                    <SectionHeader label="Price Range" isOpen={openSections['price']}
                        onToggle={() => setOpenSections(p => ({ ...p, price: !p['price'] }))}
                        count={(minPrice !== undefined ? 1 : 0) + (maxPrice !== undefined ? 1 : 0)} />
                    {openSections['price'] && renderPriceInputs()}
                </div>
            )}
            {attributeOptions.map((attr) => (
                <div key={attr.id} className="py-2">
                    <SectionHeader label={attr.label} isOpen={openSections[attr.id]}
                        onToggle={() => setOpenSections(p => ({ ...p, [attr.id]: !p[attr.id] }))}
                        count={(activeFilters[attr.id] || []).length} />
                    {openSections[attr.id] && renderCheckboxList(attr)}
                </div>
            ))}
        </div>
    );

    // ── Style 3 ──────────────────────────────────────────────────────────────
    const renderStyle3 = () => (
        <div className="divide-y divide-gray-100">
            <div className="pb-3"><ClearButton /></div>
            {showPriceFilter && (
                <div className="py-2">
                    <SectionHeader label="Price Range" isOpen={openSection === 'price'}
                        onToggle={() => setOpenSection(p => p === 'price' ? '' : 'price')}
                        count={(minPrice !== undefined ? 1 : 0) + (maxPrice !== undefined ? 1 : 0)} />
                    {openSection === 'price' && renderPriceInputs()}
                </div>
            )}
            {attributeOptions.map((attr) => (
                <div key={attr.id} className="py-2">
                    <SectionHeader label={attr.label} isOpen={openSection === attr.id}
                        onToggle={() => setOpenSection(p => p === attr.id ? '' : attr.id)}
                        count={(activeFilters[attr.id] || []).length} />
                    {openSection === attr.id && renderCheckboxList(attr)}
                </div>
            ))}
        </div>
    );

    // ── Style 4 ──────────────────────────────────────────────────────────────
    const renderStyle4 = () => (
        <div className="flex flex-wrap items-center gap-2">
            {totalActive > 0 && (
                <button type="button" onClick={handleClearAll}
                    className="flex items-center gap-1 px-3 py-2 border border-red-200 rounded-lg text-sm text-red-500 hover:text-red-700 font-medium">
                    <Icon icon="mdi:close-circle-outline" width="15" />
                    Clear ({totalActive})
                </button>
            )}
            {showPriceFilter && (
                <DropdownItem label="Price"
                    count={(minPrice !== undefined ? 1 : 0) + (maxPrice !== undefined ? 1 : 0)}>
                    <div className="w-52">{renderPriceInputs()}</div>
                </DropdownItem>
            )}
            {attributeOptions.map((attr) => (
                <DropdownItem key={attr.id} label={attr.label}
                    count={(activeFilters[attr.id] || []).length}>
                    {renderCheckboxList(attr)}
                </DropdownItem>
            ))}
        </div>
    );

    if (style === 4) return renderStyle4();
    if (style === 3) return renderStyle3();
    if (style === 2) return renderStyle2();
    return renderStyle1();
}
