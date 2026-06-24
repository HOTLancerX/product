'use client';

/**
 * ProductGridClient.tsx
 *
 * Single source of truth for all filter/sort state on the category page.
 *
 * Strategy for instant checkbox response:
 *   1. Optimistic local state  — `localFilters` mirrors URL state but updates
 *      synchronously on every toggle (checkbox feels instant).
 *   2. Debounced URL push      — 300 ms after the last interaction the new
 *      URL is pushed, triggering the server re-render.
 *   3. Pending indicator       — while waiting for the server response the
 *      product grid fades slightly so the user knows a refresh is coming.
 *   4. Sync on navigation      — when the server response arrives (searchParams
 *      change) localFilters re-syncs with the confirmed URL state.
 */

import {
    useState,
    useEffect,
    useRef,
    useCallback,
    useTransition,
} from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Icon } from '@iconify/react';
import FilterPanel from './FilterPanel';
import type { AttributeOption } from '@/plugin/product/lib/types';

const SORT_OPTIONS = [
    { value: 'newest',     label: 'Newest' },
    { value: 'oldest',     label: 'Oldest' },
    { value: 'price_asc',  label: 'Price: Low → High' },
    { value: 'price_desc', label: 'Price: High → Low' },
    { value: 'title_asc',  label: 'Name: A–Z' },
    { value: 'title_desc', label: 'Name: Z–A' },
];

/** Parse attr filters out of URLSearchParams */
function parseFilters(sp: URLSearchParams): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    sp.forEach((val, key) => {
        if (key.startsWith('attr_')) {
            out[key.slice(5)] = val.split(',').filter(Boolean);
        }
    });
    return out;
}

interface ProductGridClientProps {
    children:          React.ReactNode;
    totalProducts:     number;
    filteredCount:     number;
    hasFilters?:       boolean;
    filterStyle?:      1 | 2 | 3 | 4;
    attributeOptions?: AttributeOption[];
    showPriceFilter?:  boolean;
    showSort?:         boolean;
    theme?:            'light' | 'dark';
    /** Server-confirmed state (from URL / server render) */
    activeFilters:     Record<string, string[]>;
    minPrice?:         number;
    maxPrice?:         number;
    currentSort:       string;
}

export default function ProductGridClient({
    children,
    totalProducts,
    filteredCount,
    hasFilters       = false,
    filterStyle      = 1,
    attributeOptions = [],
    showPriceFilter  = true,
    showSort         = true,
    theme            = 'light',
    activeFilters:   serverFilters,
    minPrice:        serverMinPrice,
    maxPrice:        serverMaxPrice,
    currentSort:     serverSort,
}: ProductGridClientProps) {
    const router       = useRouter();
    const pathname     = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    // ── Optimistic local state ───────────────────────────────────────────────
    // Starts equal to server state; updated immediately on user interaction.
    const [localFilters, setLocalFilters] = useState<Record<string, string[]>>(serverFilters);
    const [sidebarOpen, setSidebarOpen]   = useState(false);

    // Re-sync when the server confirms a new URL (navigation settled)
    const prevSearch = useRef(searchParams.toString());
    useEffect(() => {
        const current = searchParams.toString();
        if (current !== prevSearch.current) {
            prevSearch.current = current;
            setLocalFilters(parseFilters(searchParams));
        }
    }, [searchParams]);

    // ── Debounced URL push ───────────────────────────────────────────────────
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const pushUrl = useCallback(
        (filters: Record<string, string[]>, min?: string, max?: string, sort?: string) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                const params = new URLSearchParams(searchParams.toString());
                // Remove all filter/sort params then re-apply
                Array.from(params.keys()).forEach(k => {
                    if (k.startsWith('attr_') || k === 'min_price' || k === 'max_price' || k === 'sort') {
                        params.delete(k);
                    }
                });
                for (const [id, vals] of Object.entries(filters)) {
                    if (vals.length > 0) params.set(`attr_${id}`, vals.join(','));
                }
                if (min) params.set('min_price', min);
                if (max) params.set('max_price', max);
                if (sort && sort !== 'newest') params.set('sort', sort);
                const qs = params.toString();
                startTransition(() => {
                    router.push(`${pathname}${qs ? `?${qs}` : ''}`);
                });
            }, 300);
        },
        [router, pathname, searchParams]
    );

    // ── Handlers ─────────────────────────────────────────────────────────────

    // Instant optimistic toggle + debounced URL push
    const handleToggleFilter = useCallback(
        (attrId: string, value: string) => {
            setLocalFilters(prev => {
                const current = prev[attrId] || [];
                const updated = current.includes(value)
                    ? current.filter(v => v !== value)
                    : [...current, value];
                const next = { ...prev };
                if (updated.length > 0) {
                    next[attrId] = updated;
                } else {
                    delete next[attrId];
                }
                pushUrl(
                    next,
                    serverMinPrice !== undefined ? String(serverMinPrice) : undefined,
                    serverMaxPrice !== undefined ? String(serverMaxPrice) : undefined,
                    serverSort
                );
                return next;
            });
        },
        [pushUrl, serverMinPrice, serverMaxPrice, serverSort]
    );

    const handleApplyPrice = useCallback(
        (min: string, max: string) => {
            pushUrl(localFilters, min || undefined, max || undefined, serverSort);
        },
        [pushUrl, localFilters, serverSort]
    );

    const handleSort = useCallback(
        (sort: string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (sort !== 'newest') {
                params.set('sort', sort);
            } else {
                params.delete('sort');
            }
            startTransition(() => {
                router.push(`${pathname}?${params.toString()}`);
            });
        },
        [router, pathname, searchParams]
    );

    const handleClearAll = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setLocalFilters({});
        startTransition(() => {
            router.push(pathname);
        });
    }, [router, pathname]);

    const handleRemoveChip = useCallback(
        (attrId: string, value: string) => handleToggleFilter(attrId, value),
        [handleToggleFilter]
    );

    // ── Derived counts ────────────────────────────────────────────────────────
    const isHorizontal = filterStyle === 4;

    const totalActiveFilters =
        Object.values(localFilters).reduce((s, v) => s + v.length, 0) +
        (serverMinPrice !== undefined ? 1 : 0) +
        (serverMaxPrice !== undefined ? 1 : 0);

    const filterPanelProps = {
        style:            filterStyle,
        attributeOptions,
        activeFilters:    localFilters,   // optimistic — instant checkbox feedback
        minPrice:         serverMinPrice,
        maxPrice:         serverMaxPrice,
        currentSort:      serverSort,
        showPriceFilter,
        onToggleFilter:   handleToggleFilter,
        onApplyPrice:     handleApplyPrice,
        onClearAll:       handleClearAll,
    };

    return (
        <div className="space-y-4">

            {/* ── Toolbar ── */}
            {(showSort || (hasFilters && !isHorizontal)) && (
                <div className={`flex items-center justify-between gap-3 flex-wrap ${
                    theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                }`}>
                    <div className="flex items-center gap-2">
                        {hasFilters && !isHorizontal && (
                            <button
                                type="button"
                                className={`md:hidden flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                                    theme === 'dark'
                                        ? 'border-white/20 hover:border-emerald-500/40 text-white/80'
                                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                                }`}
                                onClick={() => setSidebarOpen(true)}
                                aria-label="Open filters"
                            >
                                <Icon icon="mdi:filter-outline" width="18" />
                                Filters
                                {totalActiveFilters > 0 && (
                                    <span className="bg-emerald-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                        {totalActiveFilters}
                                    </span>
                                )}
                            </button>
                        )}
                        <span className="text-sm">
                            {filteredCount} product{filteredCount !== 1 ? 's' : ''}
                            {totalActiveFilters > 0 && totalProducts !== filteredCount && (
                                <span className="opacity-60"> of {totalProducts}</span>
                            )}
                        </span>
                        {/* Subtle pending spinner — shows while server re-renders */}
                        {isPending && (
                            <Icon icon="svg-spinners:ring-resize" width="16"
                                className={theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'} />
                        )}
                    </div>

                    {showSort && (
                        <div className="flex items-center gap-2">
                            <label className={`text-sm hidden sm:block ${
                                theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                            }`}>Sort:</label>
                            <select
                                value={serverSort}
                                onChange={(e) => handleSort(e.target.value)}
                                className={`px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                                    theme === 'dark'
                                        ? 'bg-white/5 border-white/20 text-white'
                                        : 'bg-white border-gray-200 text-gray-700'
                                }`}
                            >
                                {SORT_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {/* ── Active filter chips ── */}
            {totalActiveFilters > 0 && (
                <div className="flex flex-wrap gap-2">
                    {Object.entries(localFilters).flatMap(([attrId, vals]) =>
                        vals.map((val) => {
                            const attr = attributeOptions.find(a => a.id === attrId);
                            return (
                                <button
                                    key={`${attrId}-${val}`}
                                    type="button"
                                    onClick={() => handleRemoveChip(attrId, val)}
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm hover:bg-emerald-200 transition-colors"
                                >
                                    {attr?.label ?? attrId}: {val}
                                    <Icon icon="mdi:close" width="14" />
                                </button>
                            );
                        })
                    )}
                    {(serverMinPrice !== undefined || serverMaxPrice !== undefined) && (
                        <span className="inline-flex items-center px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm">
                            Price: {serverMinPrice ?? 0} – {serverMaxPrice ?? '∞'}
                        </span>
                    )}
                </div>
            )}

            {/* ── Style 4: horizontal filter bar ── */}
            {hasFilters && isHorizontal && (
                <FilterPanel {...filterPanelProps} />
            )}

            <div className="flex gap-6">
                {/* Desktop sidebar — styles 1, 2, 3 */}
                {hasFilters && !isHorizontal && (
                    <aside className="hidden md:block w-60 shrink-0">
                        <div className={`sticky top-20 border rounded-xl p-4 ${
                            theme === 'dark'
                                ? 'bg-white/5 border-white/10'
                                : 'bg-white border-gray-200 shadow-sm'
                        }`}>
                            <h2 className={`text-base font-bold mb-4 ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>Filters</h2>
                            <FilterPanel {...filterPanelProps} />
                        </div>
                    </aside>
                )}

                {/* Server-rendered product cards — subtle fade while pending */}
                <div className={`flex-1 min-w-0 transition-opacity duration-200 ${isPending ? 'opacity-60' : 'opacity-100'}`}>
                    {children}
                </div>
            </div>

            {/* Mobile filter drawer */}
            {hasFilters && !isHorizontal && sidebarOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
                    <div className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-xl overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h2 className="text-base font-bold text-gray-900">Filters</h2>
                            <button type="button" onClick={() => setSidebarOpen(false)}
                                aria-label="Close filters" className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                                <Icon icon="mdi:close" width="22" className="text-gray-500" />
                            </button>
                        </div>
                        <div className="p-4">
                            <FilterPanel
                                {...filterPanelProps}
                                onClose={() => setSidebarOpen(false)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
