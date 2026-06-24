"use client";

/**
 * plugin/product/settings/CategoryPageSettings.tsx
 *
 * Settings panel for the product category listing page.
 * Controls:
 *   — Enable / disable the filter panel
 *   — Filter panel style (1–4)
 *   — Enable / disable the price range filter
 *   — Enable / disable the sort dropdown
 *
 * Saved as individual settings keys via the /settings API.
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

    const [saving, setSaving]   = useState(false);
    const [message, setMessage] = useState("");

    // Sync when initialValues arrive async
    useEffect(() => {
        setFilterEnabled(initialValues.product_cat_filter_enabled !== "0");
        setFilterStyle(String(initialValues.product_cat_filter_style ?? "1"));
        setPriceFilter(initialValues.product_cat_price_filter !== "0");
        setSortEnabled(initialValues.product_cat_sort_enabled !== "0");
    }, [
        initialValues.product_cat_filter_enabled,
        initialValues.product_cat_filter_style,
        initialValues.product_cat_price_filter,
        initialValues.product_cat_sort_enabled,
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

            {/* ── Filter panel enable/disable ── */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-1 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-gray-800">Enable Filter Panel</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Show attribute filters on product category pages. If no attributes are
                            linked to a category the panel is hidden automatically.
                        </p>
                    </div>
                    <Toggle value={filterEnabled} onChange={setFilterEnabled} />
                </div>
            </div>

            {/* ── Options (visible only when filters are on) ── */}
            {filterEnabled && (
                <>
                    {/* Filter style */}
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
                                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{s.label}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Price filter toggle */}
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

            {/* ── Sort dropdown ── */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-gray-800">Sort Dropdown</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Show a sort-by selector above the product grid (newest, price, name).
                        </p>
                    </div>
                    <Toggle value={sortEnabled} onChange={setSortEnabled} />
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

// ── Small reusable toggle ──────────────────────────────────────────────────────

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
                value ? "bg-emerald-500" : "bg-gray-200"
            }`}
        >
            <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    value ? "translate-x-6" : "translate-x-1"
                }`}
            />
        </button>
    );
}
