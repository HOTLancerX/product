"use client";

/**
 * Variate.tsx — Dynamic price-type switcher for the product post form.
 *
 * Single mode:  Regular Price / Selling Price / Quantity + Product Attributes
 *               (attribute cards for filtering, each with value chips + custom input)
 * Variant mode: Full PostFormMultivariate UI
 *
 * All state is kept LOCAL to avoid the stale-closure loop that occurs when
 * every keystroke round-trips through PostForm → info["_variate"] → JSON.parse.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import type { FieldProps } from "@/hook";
import { xFetch } from "@/lib/express";
import PostFormMultivariate from "./PostFormMultivariate";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DbAttribute {
    id: string;
    title: string;
    parentId?: string;
}

/** One attribute card in single mode — stores selected values for filtering */
interface SingleAttribute {
    dbId: string;       // id of the parent DB attribute (e.g. Color's _id)
    label: string;      // e.g. "Color"
    values: string[];   // selected values, e.g. ["Red", "Blue"]
}

interface VariateState {
    priceType: "single" | "variant";
    // single fields
    regularprice: string;
    sellingprice: string;
    stock: string;
    singleAttributes: SingleAttribute[];   // attribute selections for single mode
    // variant fields
    selectedAttributes: any[];
    attributeInputs: Record<string, string>;
    variants: any[];
    showPreview: boolean;
    variantDisplayStyle: string;
}

const DEFAULT_STATE: VariateState = {
    priceType: "single",
    regularprice: "",
    sellingprice: "",
    stock: "",
    singleAttributes: [],
    selectedAttributes: [],
    attributeInputs: {},
    variants: [],
    showPreview: false,
    variantDisplayStyle: "list",
};

function parseBlob(raw: string): VariateState {
    if (!raw) return { ...DEFAULT_STATE };
    try { return { ...DEFAULT_STATE, ...JSON.parse(raw) }; }
    catch { return { ...DEFAULT_STATE }; }
}

// ── Single mode attribute card ─────────────────────────────────────────────────

interface AttrCardProps {
    dbAttr: DbAttribute;
    children: DbAttribute[];
    saved: SingleAttribute | undefined;
    onChange: (updated: SingleAttribute) => void;
}

function AttrCard({ dbAttr, children, saved, onChange }: AttrCardProps) {
    const values: string[] = saved?.values ?? [];

    // DB suggestions = children not yet in values
    const suggestions = children.map(c => c.title).filter(v => !values.includes(v));

    const addValue = (v: string) => {
        if (!v.trim() || values.includes(v.trim())) return;
        onChange({ dbId: dbAttr.id, label: dbAttr.title, values: [v.trim(), ...values] });
    };

    const removeValue = (v: string) => {
        onChange({ dbId: dbAttr.id, label: dbAttr.title, values: values.filter(x => x !== v) });
    };

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-3 flex flex-col gap-2">
            {/* Header */}
            <div className="flex items-center gap-1.5">
                <Icon icon="solar:list-bold" width="14" height="14" className="text-indigo-500 shrink-0" />
                <span className="text-sm font-semibold text-gray-700">{dbAttr.title}</span>
            </div>

            {/* Selected value chips */}
            {values.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {values.map(v => (
                        <span
                            key={v}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-medium"
                        >
                            {v}
                            <button
                                type="button"
                                onClick={() => removeValue(v)}
                                className="hover:text-red-600 transition-colors"
                                title={`Remove ${v}`}
                            >
                                <Icon icon="mdi:close" width="10" height="10" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Input to add custom value */}
            <div className="flex gap-1.5">
                <input
                    type="text"
                    placeholder="Custom value, Enter to add"
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
                    onKeyDown={e => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        e.stopPropagation();
                        const v = (e.target as HTMLInputElement).value.trim();
                        if (!v) return;
                        addValue(v);
                        (e.target as HTMLInputElement).value = '';
                    }}
                />
                <button
                    type="button"
                    className="px-2.5 py-1.5 text-xs font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 shrink-0"
                    onClick={e => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        const v = input?.value?.trim();
                        if (!v) return;
                        addValue(v);
                        input.value = '';
                    }}
                >
                    Add
                </button>
            </div>

            {/* DB suggestions */}
            {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-dashed border-gray-200">
                    {suggestions.map(s => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => addValue(s)}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded-full text-xs hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
                        >
                            <Icon icon="mdi:plus" width="10" height="10" />
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Variate({ name, label, value, onChange, ctx }: FieldProps) {
    const title = (ctx?.title as string) ?? "";

    // ── Local state ───────────────────────────────────────────────────────────
    const [priceType, setPriceType]                       = useState<"single" | "variant">(() => parseBlob(value).priceType);
    const [regularprice, setRegularprice]                  = useState(() => parseBlob(value).regularprice);
    const [sellingprice, setSellingprice]                  = useState(() => parseBlob(value).sellingprice);
    const [stock, setStock]                                = useState(() => parseBlob(value).stock);
    const [singleAttributes, setSingleAttributes]          = useState<SingleAttribute[]>(() => parseBlob(value).singleAttributes);
    const [selectedAttributes, setSelectedAttributes]      = useState<any[]>(() => parseBlob(value).selectedAttributes);
    const [attributeInputs, setAttributeInputs]            = useState<Record<string, string>>(() => parseBlob(value).attributeInputs);
    const [variants, setVariants]                         = useState<any[]>(() => parseBlob(value).variants);
    const [showPreview, setShowPreview]                   = useState(() => parseBlob(value).showPreview);
    const [variantDisplayStyle, setVariantDisplayStyle]   = useState(() => parseBlob(value).variantDisplayStyle);

    // Initialise from parent only once on mount
    const initialised = useRef(false);
    useEffect(() => {
        if (initialised.current) return;
        initialised.current = true;
        const s = parseBlob(value);
        setPriceType(s.priceType);
        setRegularprice(s.regularprice);
        setSellingprice(s.sellingprice);
        setStock(s.stock);
        setSingleAttributes(s.singleAttributes);
        setSelectedAttributes(s.selectedAttributes);
        setAttributeInputs(s.attributeInputs);
        setVariants(s.variants);
        setShowPreview(s.showPreview);
        setVariantDisplayStyle(s.variantDisplayStyle);
    }, [value]);

    // ── Flush to parent ───────────────────────────────────────────────────────
    const flush = useCallback((patch: Partial<VariateState>) => {
        onChange(JSON.stringify({
            priceType, regularprice, sellingprice, stock,
            singleAttributes, selectedAttributes, attributeInputs,
            variants, showPreview, variantDisplayStyle,
            ...patch,
        }));
    }, [priceType, regularprice, sellingprice, stock, singleAttributes,
        selectedAttributes, attributeInputs, variants, showPreview, variantDisplayStyle, onChange]);

    // ── Fetch DB attributes ───────────────────────────────────────────────────
    const [dbAttributes, setDbAttributes] = useState<DbAttribute[]>([]);
    const [attrLoading, setAttrLoading]   = useState(false);

    const fetchAttributes = useCallback(() => {
        setAttrLoading(true);
        xFetch("/cat?type=attributes", { cache: "no-store" })
            .then(r => r.json())
            .then(data => {
                const cats: any[] = data.cats ?? [];
                setDbAttributes(cats.map(c => ({
                    id: c._id,
                    title: c.title,
                    parentId: c.parentId != null ? String(c.parentId) : undefined,
                })));
            })
            .catch(() => setDbAttributes([]))
            .finally(() => setAttrLoading(false));
    }, []);

    useEffect(() => { fetchAttributes(); }, [fetchAttributes]);

    // Top-level attributes (parents or flat — those without a parentId)
    const parentAttrs = dbAttributes.filter(a => !a.parentId);

    // ── Single attribute card handler ─────────────────────────────────────────
    const handleSingleAttributeChange = (updated: SingleAttribute) => {
        const next = singleAttributes.some(a => a.dbId === updated.dbId)
            ? singleAttributes.map(a => a.dbId === updated.dbId ? updated : a)
            : [...singleAttributes, updated];
        setSingleAttributes(next);
        flush({ singleAttributes: next });
    };

    // ── Variant helpers ───────────────────────────────────────────────────────
    const handleGenerateVariants = () => {
        if (!selectedAttributes.length) return;
        const combos = selectedAttributes.reduce<Record<string, string>[]>((acc, attr) => {
            if (!acc.length) return attr.values.map((v: string) => ({ [attr.label]: v }));
            return acc.flatMap(combo => attr.values.map((v: string) => ({ ...combo, [attr.label]: v })));
        }, []);
        const next = combos.map((options, i) => ({
            id: `v-${Date.now()}-${i}`,
            handle: Object.entries(options).map(([, v]) => (v as string).toLowerCase().replace(/\s+/g, "-")).join("-"),
            title: "", options, sku: "", price: "", quantity: "", emotion: "",
            color: "", image: "", gallery: [], priceTiers: [], showTiers: false,
        }));
        setVariants(next); flush({ variants: next });
    };

    const handleSetSelectedAttributes = (attrs: any[]) => { setSelectedAttributes(attrs); flush({ selectedAttributes: attrs }); };
    const handleSetAttributeInputs = (inputs: Record<string, string>) => { setAttributeInputs(inputs); };
    const handleSetVariants = (v: any[]) => { setVariants(v); flush({ variants: v }); };
    const handleSetShowPreview = (v: boolean) => { setShowPreview(v); flush({ showPreview: v }); };
    const handleSetVariantDisplayStyle = (v: string) => { setVariantDisplayStyle(v); flush({ variantDisplayStyle: v }); };

    const handleUpdateVariant = (id: string, field: string, val: any) => {
        const next = variants.map(v => v.id === id ? { ...v, [field]: val } : v);
        setVariants(next); flush({ variants: next });
    };
    const handleTogglePriceTiers = (id: string) => {
        const next = variants.map(v => v.id === id ? { ...v, showTiers: !v.showTiers } : v);
        setVariants(next); flush({ variants: next });
    };
    const handleAddPriceTier = (variantId: string) => {
        const next = variants.map(v => v.id === variantId
            ? { ...v, priceTiers: [...v.priceTiers, { rangeStart: "", rangeEnd: "", price: "" }] } : v);
        setVariants(next); flush({ variants: next });
    };
    const handleRemovePriceTier = (variantId: string, tierIndex: number) => {
        const next = variants.map(v => v.id === variantId
            ? { ...v, priceTiers: v.priceTiers.filter((_: any, i: number) => i !== tierIndex) } : v);
        setVariants(next); flush({ variants: next });
    };
    const handleUpdatePriceTier = (variantId: string, tierIndex: number, field: string, val: string) => {
        const next = variants.map(v => {
            if (v.id !== variantId) return v;
            const tiers = v.priceTiers.map((t: any, i: number) => i === tierIndex ? { ...t, [field]: val } : t);
            return { ...v, priceTiers: tiers };
        });
        setVariants(next); flush({ variants: next });
    };
    const handleBulkUpdateField = (field: string, val: string) => {
        const next = variants.map(v => ({ ...v, [field]: val }));
        setVariants(next); flush({ variants: next });
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-5">

            {/* Price Type selector */}
            <div className="flex flex-col gap-1.5">
                <label htmlFor={`${name}-price-type`} className="text-xs font-semibold">
                    {label}
                </label>
                <select
                    id={`${name}-price-type`}
                    value={priceType}
                    onChange={e => {
                        const v = e.target.value as "single" | "variant";
                        setPriceType(v); flush({ priceType: v });
                    }}
                    className="appearance-none w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                >
                    <option value="single">Single</option>
                    <option value="variant">Variant</option>
                </select>
            </div>

            {/* ── Single mode ─────────────────────────────────────────────── */}
            {priceType === "single" && (
                <div className="flex flex-col gap-5">
                    {/* Price row — 3 columns */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold">Regular Price</label>
                            <input
                                type="text"
                                value={regularprice}
                                onChange={e => { setRegularprice(e.target.value); flush({ regularprice: e.target.value }); }}
                                placeholder="0.00"
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-indigo-500"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold">Selling Price</label>
                            <input
                                type="text"
                                value={sellingprice}
                                onChange={e => { setSellingprice(e.target.value); flush({ sellingprice: e.target.value }); }}
                                placeholder="0.00"
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-indigo-500"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold">Quantity</label>
                            <input
                                type="number"
                                value={stock}
                                onChange={e => { setStock(e.target.value); flush({ stock: e.target.value }); }}
                                placeholder="0"
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Product Attributes */}
                    {(parentAttrs.length > 0 || attrLoading) && (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Product Attributes
                                </span>
                                <button
                                    type="button"
                                    onClick={fetchAttributes}
                                    disabled={attrLoading}
                                    className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-40 transition"
                                >
                                    <Icon icon={attrLoading ? "mdi:loading" : "mdi:refresh"} width="13" height="13" className={attrLoading ? "animate-spin" : ""} />
                                    Refresh
                                </button>
                            </div>

                            {attrLoading ? (
                                <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                                    <Icon icon="mdi:loading" width="16" height="16" className="animate-spin" />
                                    Loading attributes…
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {parentAttrs.map(attr => (
                                        <AttrCard
                                            key={attr.id}
                                            dbAttr={attr}
                                            children={dbAttributes.filter(a => a.parentId === attr.id)}
                                            saved={singleAttributes.find(a => a.dbId === attr.id)}
                                            onChange={handleSingleAttributeChange}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Variant mode ─────────────────────────────────────────────── */}
            {priceType === "variant" && (
                <PostFormMultivariate
                    attributes={dbAttributes}
                    attrLoading={attrLoading}
                    onRefreshAttributes={fetchAttributes}
                    selectedAttributes={selectedAttributes}
                    setSelectedAttributes={handleSetSelectedAttributes}
                    attributeInputs={attributeInputs}
                    setAttributeInputs={handleSetAttributeInputs}
                    variants={variants}
                    setVariants={handleSetVariants}
                    showPreview={showPreview}
                    setShowPreview={handleSetShowPreview}
                    variantDisplayStyle={variantDisplayStyle}
                    setVariantDisplayStyle={handleSetVariantDisplayStyle}
                    onGenerateVariants={handleGenerateVariants}
                    onUpdateVariant={handleUpdateVariant}
                    onTogglePriceTiers={handleTogglePriceTiers}
                    onAddPriceTier={handleAddPriceTier}
                    onRemovePriceTier={handleRemovePriceTier}
                    onUpdatePriceTier={handleUpdatePriceTier}
                    onBulkUpdateField={handleBulkUpdateField}
                    title={title}
                />
            )}
        </div>
    );
}
