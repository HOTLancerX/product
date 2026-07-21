"use client";

/**
 * plugin/product/settings/CategoryPageSettings.tsx
 *
 * Settings panel for the product category listing page and related product displays.
 */

import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { xFetch } from "@/lib/express";

interface Props {
    initialValues?: Record<string, any>;
}

const FILTER_STYLES = [
    {
        value:       "1",
        label:       "Style 1 — Always visible",
        description: "All filter sections are expanded at all times.",
    },
    {
        value:       "2",
        label:       "Style 2 — Accordion (multiple open)",
        description: "Collapsible sections; multiple can be open simultaneously.",
    },
    {
        value:       "3",
        label:       "Style 3 — Accordion (one open)",
        description: "Collapsible sections; only one section open at a time.",
    },
    {
        value:       "4",
        label:       "Style 4 — Horizontal dropdown bar",
        description: "Each attribute is a button in a horizontal bar above the product grid.",
    },
];

export default function CategoryPageSettings({ initialValues = {} }: Props) {
    const [filterEnabled, setFilterEnabled] = useState<boolean>(
        initialValues.product_cat_filter_enabled !== "0"
    );
    const [filterStyle, setFilterStyle] = useState<string>(
        String(initialValues.product_cat_filter_style ?? "1")
    );
    const [priceFilter, setPriceFilter] = useState<boolean>(
        initialValues.product_cat_price_filter !== "0"
    );
    const [sortEnabled, setSortEnabled] = useState<boolean>(
        initialValues.product_cat_sort_enabled !== "0"
    );
    const [relatedCols, setRelatedCols] = useState<string>(
        String(initialValues.related_products_cols ?? "6")
    );
    const [relatedTotal, setRelatedTotal] = useState<string>(
        String(initialValues.related_products_total ?? "12")
    );

    const [saving, setSaving]   = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        setFilterEnabled(initialValues.product_cat_filter_enabled !== "0");
        setFilterStyle(String(initialValues.product_cat_filter_style ?? "1"));
        setPriceFilter(initialValues.product_cat_price_filter !== "0");
        setSortEnabled(initialValues.product_cat_sort_enabled !== "0");
        setRelatedCols(String(initialValues.related_products_cols ?? "6"));
        setRelatedTotal(String(initialValues.related_products_total ?? "12"));
    }, [
        initialValues.product_cat_filter_enabled,
        initialValues.product_cat_filter_style,
        initialValues.product_cat_price_filter,
        initialValues.product_cat_sort_enabled,
        initialValues.related_products_cols,
        initialValues.related_products_total,
    ]);

    const handleSave = async () => {
        setSaving(true);
        setMessage("");
        try {
            const res  = await xFetch("/settings", {
                method: "PUT",
                body:   JSON.stringify({
                    product_cat_filter_enabled: filterEnabled ? "1" : "0",
                    product_cat_filter_style:   filterStyle,
                    product_cat_price_filter:   priceFilter  ? "1" : "0",
                    product_cat_sort_enabled:   sortEnabled  ? "1" : "0",
                    related_products_cols:      relatedCols,
                    related_products_total:     relatedTotal,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setMessage(`Error: ${data.error ?? "Failed to save"}`);
            } else {
                setMessage("Settings saved!");
                setTimeout(() => setMessage(""), 3000);
            }
        } catch {
            setMessage("Network error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            {message && (
                <div className={`rounded-lg px-4 py-3 text-sm font-medium border ${
                    message.startsWith("Error")
                        ? "bg-red-400/10 text-red-400 border-red-400/25"
                        : "bg-emerald-400/10 text-emerald-400 border-emerald-400/25"
                }`}>
                    {message}
                </div>
            )}

            {/* Filter panel enable/disable */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-1 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-gray-800">Enable Filter Panel</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Show attribute filters on product category pages.
                        </p>
                    </div>
                    <Toggle value={filterEnabled} onChange={setFilterEnabled} />
                </div>
            </div>

            {filterEnabled && (
                <>
                    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 shadow-sm">
                        <p className="text-sm font-semibold text-gray-800">Filter Panel Style</p>
                        <div className="space-y-2">
                            {FILTER_STYLES.map((s) => (
                                <label
                                    key={s.value}
                                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                        filterStyle === s.value
                                            ? "border-emerald-400 bg-emerald-50"
                                            : "border-gray-200 hover:border-emerald-300"
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="filter_style"
                                        value={s.value}
                                        checked={filterStyle === s.value}
                                        onChange={() => setFilterStyle(s.value)}
                                        className="mt-0.5"
                                    />
                                    <div>
                                        <p className="text-xs font-semibold text-gray-800">{s.label}</p>
                                        <p className="text-xs text-gray-500">{s.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-gray-800">Price Range Filter</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Show min / max price inputs in the filter panel.
                                </p>
                            </div>
                            <Toggle value={priceFilter} onChange={setPriceFilter} />
                        </div>
                    </div>
                </>
            )}

            {/* Sort dropdown */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-gray-800">Sort Dropdown</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Show a sort-by selector above the product grid.
                        </p>
                    </div>
                    <Toggle value={sortEnabled} onChange={setSortEnabled} />
                </div>
            </div>

            {/* Related Products Settings */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
                <div>
                    <p className="text-sm font-semibold text-gray-800">Related Products Layout Settings</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Configure how many related category products to show on product details pages.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Products Per Line (Desktop Columns)
                        </label>
                        <select
                            value={relatedCols}
                            onChange={(e) => setRelatedCols(e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="2">2 Columns</option>
                            <option value="3">3 Columns</option>
                            <option value="4">4 Columns</option>
                            <option value="5">5 Columns</option>
                            <option value="6">6 Columns (Default)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Total Related Products Limit
                        </label>
                        <input
                            type="number"
                            min={2}
                            max={48}
                            value={relatedTotal}
                            onChange={(e) => setRelatedTotal(e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                </div>
            </div>

            {/* Save */}
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold rounded-lg transition disabled:opacity-55 disabled:cursor-not-allowed"
                >
                    {saving
                        ? <><Icon icon="svg-spinners:ring-resize" width={16} /> Saving…</>
                        : <><Icon icon="solar:check-circle-bold" width={16} /> Save Settings</>
                    }
                </button>
            </div>
        </div>
    );
}

function Toggle({
    value,
    onChange,
}: {
    value: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={value}
            onClick={() => onChange(!value)}
            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                value ? "bg-emerald-500" : "bg-gray-300"
            }`}
        >
            <span
                className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                    value ? "translate-x-5.5" : "translate-x-0.5"
                }`}
            />
        </button>
    );
}
