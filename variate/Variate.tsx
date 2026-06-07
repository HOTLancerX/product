"use client";

/**
 * Variate.tsx — Dynamic price-type switcher for the product post form.
 *
 * Registered as a normal `component` via the hook system.
 * The form passes ambient context via the `ctx` prop so this component
 * reads ctx?.title for AI fill without any direct coupling to PostForm.
 *
 * The JSON blob stored in info["_variate"]:
 * {
 *   priceType: "single" | "variant",
 *   regularprice, sellingprice, stock,   // single mode
 *   selectedAttributes, variants,        // variant mode
 *   variantDisplayStyle,
 * }
 *
 * KEY DESIGN: selectedAttributes, variants, etc. are kept in LOCAL React
 * state inside this component. They are serialised to the parent's info
 * store only on explicit changes (via flushToParent). This avoids the
 * stale-closure loop that happens when every keystroke round-trips through
 * PostForm → info → JSON.parse → re-render.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldProps } from "@/hook";
import { xFetch } from "@/lib/express";
import { singleFields } from "./single";
import PostFormMultivariate from "./PostFormMultivariate";

interface DbAttribute {
    id: string;
    title: string;
    parentId?: string;
}

interface VariateState {
    priceType: "single" | "variant";
    regularprice: string;
    sellingprice: string;
    stock: string;
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
    selectedAttributes: [],
    attributeInputs: {},
    variants: [],
    showPreview: false,
    variantDisplayStyle: "list",
};

function parseBlob(raw: string): VariateState {
    if (!raw) return { ...DEFAULT_STATE };
    try {
        return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_STATE };
    }
}

export default function Variate({ name, label, value, onChange, ctx }: FieldProps) {
    const title = (ctx?.title as string) ?? "";

    // ── Local state — avoids stale-closure loop through PostForm ─────────────
    const [priceType, setPriceType]               = useState<"single" | "variant">(() => parseBlob(value).priceType);
    const [regularprice, setRegularprice]          = useState(() => parseBlob(value).regularprice);
    const [sellingprice, setSellingprice]          = useState(() => parseBlob(value).sellingprice);
    const [stock, setStock]                        = useState(() => parseBlob(value).stock);
    const [selectedAttributes, setSelectedAttributes] = useState<any[]>(() => parseBlob(value).selectedAttributes);
    const [attributeInputs, setAttributeInputs]   = useState<Record<string, string>>(() => parseBlob(value).attributeInputs);
    const [variants, setVariants]                 = useState<any[]>(() => parseBlob(value).variants);
    const [showPreview, setShowPreview]           = useState(() => parseBlob(value).showPreview);
    const [variantDisplayStyle, setVariantDisplayStyle] = useState(() => parseBlob(value).variantDisplayStyle);

    // Track whether we've initialised from the parent value yet
    const initialised = useRef(false);
    useEffect(() => {
        if (initialised.current) return; // only run once on mount
        initialised.current = true;
        const s = parseBlob(value);
        setPriceType(s.priceType);
        setRegularprice(s.regularprice);
        setSellingprice(s.sellingprice);
        setStock(s.stock);
        setSelectedAttributes(s.selectedAttributes);
        setAttributeInputs(s.attributeInputs);
        setVariants(s.variants);
        setShowPreview(s.showPreview);
        setVariantDisplayStyle(s.variantDisplayStyle);
    }, [value]);

    // ── Flush local state → parent onChange ───────────────────────────────────
    // Called whenever any piece of state changes.
    const flush = useCallback((patch: Partial<VariateState>) => {
        // We read current local state values here — patch overrides specific keys
        onChange(JSON.stringify({
            priceType,
            regularprice,
            sellingprice,
            stock,
            selectedAttributes,
            attributeInputs,
            variants,
            showPreview,
            variantDisplayStyle,
            ...patch,
        }));
    }, [priceType, regularprice, sellingprice, stock, selectedAttributes, attributeInputs, variants, showPreview, variantDisplayStyle, onChange]);

    const handlePriceTypeChange = (v: "single" | "variant") => {
        setPriceType(v);
        flush({ priceType: v });
    };

    const handleSingleField = (key: keyof VariateState, v: string) => {
        if (key === "regularprice") { setRegularprice(v); flush({ regularprice: v }); }
        if (key === "sellingprice") { setSellingprice(v); flush({ sellingprice: v }); }
        if (key === "stock")        { setStock(v);        flush({ stock: v }); }
    };

    // ── Fetch attributes ──────────────────────────────────────────────────────
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

    // ── Variant generation ────────────────────────────────────────────────────
    const handleGenerateVariants = () => {
        if (!selectedAttributes.length) return;
        const combos = selectedAttributes.reduce<Record<string, string>[]>((acc, attr) => {
            if (!acc.length) return attr.values.map((v: string) => ({ [attr.label]: v }));
            return acc.flatMap(combo => attr.values.map((v: string) => ({ ...combo, [attr.label]: v })));
        }, []);
        const newVariants = combos.map((options, i) => ({
            id: `v-${Date.now()}-${i}`,
            handle: Object.entries(options).map(([, v]) => (v as string).toLowerCase().replace(/\s+/g, "-")).join("-"),
            title: "", options, sku: "", price: "", quantity: "", emotion: "",
            color: "", image: "", gallery: [], priceTiers: [], showTiers: false,
        }));
        setVariants(newVariants);
        flush({ variants: newVariants });
    };

    const handleSetSelectedAttributes = (attrs: any[]) => {
        setSelectedAttributes(attrs);
        flush({ selectedAttributes: attrs });
    };

    const handleSetAttributeInputs = (inputs: Record<string, string>) => {
        setAttributeInputs(inputs);
        // Don't flush on every keystroke — just keep local state
    };

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
            {/* Price Type */}
            <div className="flex flex-col gap-1.5">
                <label htmlFor={`${name}-price-type`} className="text-xs font-semibold">
                    {label}
                </label>
                <select
                    id={`${name}-price-type`}
                    value={priceType}
                    onChange={e => handlePriceTypeChange(e.target.value as "single" | "variant")}
                    className="appearance-none w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                >
                    <option value="single">Single</option>
                    <option value="variant">Variant</option>
                </select>
            </div>

            {/* Single mode */}
            {priceType === "single" && singleFields.map(field => {
                const Component = field.component;
                const val = field.key === "regularprice" ? regularprice
                          : field.key === "sellingprice"  ? sellingprice
                          : stock;
                return (
                    <Component
                        key={field.key}
                        name={field.key}
                        label={field.label}
                        value={val}
                        onChange={(v: string) => handleSingleField(field.key as keyof VariateState, v)}
                    />
                );
            })}

            {/* Variant mode */}
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
