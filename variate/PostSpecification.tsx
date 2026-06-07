"use client";

/**
 * PostSpecification.tsx — Product specification fields (left/main column).
 *
 * Reads categoryId + categoryPath from ctx (provided by PostForm).
 * Fetches the spec template from the selected category (walks up ancestry
 * if the selected level has none).
 * Stores filled values as JSON in postinfos: name="_specifications".
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import type { FieldProps } from "@/hook";
import { xFetch } from "@/lib/express";
import Gallery from "@/components/Gallery";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SpecField {
    title: string;
    description: string;
    image?: string;
}

interface SpecBox {
    title: string;
    fields: SpecField[];
}

function parseBlob(raw: string): SpecBox[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : (parsed.specifications ?? []);
    } catch {
        return [];
    }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PostSpecification({ value, onChange, ctx }: FieldProps) {
    const categoryId   = (ctx?.categoryId   as string)   ?? "";
    const categoryPath = (ctx?.categoryPath as string[]) ?? [];

    const valueLoaded    = useRef(false);
    const lastCategoryId = useRef<string | null>(null);
    const lastFetchedId  = useRef("");

    const [specs, setSpecs]         = useState<SpecBox[]>(() => parseBlob(value));
    const [template, setTemplate]   = useState<SpecBox[]>([]);
    const [loading, setLoading]     = useState(false);

    // Restore from saved value — waits for the first real value from PostForm
    // (edit mode: PostForm loads the post async, so value starts as "")
    useEffect(() => {
        if (valueLoaded.current) return;
        if (value !== "") {
            valueLoaded.current = true;
            setSpecs(parseBlob(value));
        }
    }, [value]);

    // Flush to parent
    const flush = useCallback((next: SpecBox[]) => {
        onChange(JSON.stringify(next));
    }, [onChange]);

    // Fetch spec template, walking hierarchy deepest → shallowest
    const fetchTemplate = useCallback(async (id: string, path: string[]) => {
        if (!id || id === lastFetchedId.current) return;
        lastFetchedId.current = id;
        setLoading(true);
        try {
            const order = path.length > 0 ? [...path].reverse() : [id];
            for (const catId of order) {
                const res = await xFetch(`/cat?id=${catId}`, { cache: "no-store" });
                if (!res.ok) continue;
                const data = await res.json();

                // Express-server shape: data.info[] with name="specifications"
                const infoArr: { name: string; value: string }[] = data.info ?? [];
                const entry = infoArr.find((i) => i.name === "specifications");
                let tpl: SpecBox[] = [];
                if (entry?.value) {
                    try { tpl = JSON.parse(entry.value); } catch { tpl = []; }
                }

                if (tpl.length > 0) {
                    setTemplate(tpl);
                    return;
                }
            }
            setTemplate([]);
        } catch {
            setTemplate([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Re-fetch when category changes
    useEffect(() => {
        if (!categoryId) {
            setTemplate([]);
            lastFetchedId.current = "";
            return;
        }
        fetchTemplate(categoryId, categoryPath);
    }, [categoryId, categoryPath.join(","), fetchTemplate]);

    // Reset specs only when the user actively switches category after load
    useEffect(() => {
        if (!valueLoaded.current) return;
        if (lastCategoryId.current === null) {
            lastCategoryId.current = categoryId;
            return;
        }
        if (lastCategoryId.current !== categoryId) {
            lastCategoryId.current = categoryId;
            setSpecs([]);
            flush([]);
        }
    }, [categoryId, flush]);

    // Apply template
    const applyTemplate = () => {
        const filled = template.map((box) => ({
            title: box.title,
            fields: box.fields.map((f) => ({
                title: f.title,
                description: "",
                image: f.image ?? "",
            })),
        }));
        setSpecs(filled);
        flush(filled);
    };

    const updateDesc = (bi: number, fi: number, val: string) => {
        const next = specs.map((box, b) =>
            b !== bi ? box : {
                ...box,
                fields: box.fields.map((f, i) => i !== fi ? f : { ...f, description: val }),
            }
        );
        setSpecs(next);
        flush(next);
    };

    const updateImage = (bi: number, fi: number, img: string) => {
        const next = specs.map((box, b) =>
            b !== bi ? box : {
                ...box,
                fields: box.fields.map((f, i) => i !== fi ? f : { ...f, image: img }),
            }
        );
        setSpecs(next);
        flush(next);
    };

    // ── No category selected ────────────────────────────────────────────────
    if (!categoryId) {
        return (
            <div className="border rounded-lg p-6 bg-gray-50 text-center">
                <Icon icon="mdi:information-outline" width="40" height="40" className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">Select a product category to load specifications.</p>
            </div>
        );
    }

    // ── Loading ─────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="border rounded-lg p-6 bg-white text-center">
                <Icon icon="mdi:loading" width="40" height="40" className="mx-auto mb-2 text-blue-500 animate-spin" />
                <p className="text-sm text-gray-500">Loading specifications…</p>
            </div>
        );
    }

    // ── No template on this category ────────────────────────────────────────
    if (template.length === 0 && specs.length === 0) {
        return (
            <div className="border rounded-lg p-6 bg-yellow-50 text-center">
                <Icon icon="mdi:alert-circle-outline" width="40" height="40" className="mx-auto mb-2 text-yellow-500" />
                <p className="text-sm text-yellow-800">
                    No specification template found for this category or its ancestors.
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                    Add specifications in the category settings first.
                </p>
            </div>
        );
    }

    // ── Template available but not yet applied ──────────────────────────────
    if (template.length > 0 && specs.length === 0) {
        return (
            <div className="border rounded-lg p-5 bg-blue-50">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <Icon icon="mdi:clipboard-list" width="22" height="22" className="text-blue-500 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-blue-900">Specification template available</p>
                            <p className="text-xs text-blue-700 mt-0.5">
                                {template.reduce((s, b) => s + b.fields.length, 0)} fields across {template.length} {template.length === 1 ? "box" : "boxes"}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={applyTemplate}
                        className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition"
                    >
                        <Icon icon="mdi:auto-fix" width="16" height="16" />
                        Apply Template
                    </button>
                </div>
            </div>
        );
    }

    // ── Specification fields ────────────────────────────────────────────────
    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Icon icon="mdi:clipboard-list" width="22" height="22" className="text-blue-600" />
                    <h2 className="text-base font-semibold">Product Specifications</h2>
                </div>
                {template.length > 0 && (
                    <button
                        type="button"
                        onClick={applyTemplate}
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 transition"
                    >
                        <Icon icon="mdi:refresh" width="14" height="14" />
                        Reset to template
                    </button>
                )}
            </div>

            {/* Boxes */}
            <div className="space-y-4">
                {specs.map((box, bi) => (
                    <div key={bi} className="bg-white border rounded-lg overflow-hidden">
                        {/* Box title bar */}
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-gray-50">
                            <Icon icon="mdi:folder-open" width="16" height="16" className="text-blue-500 shrink-0" />
                            <span className="text-sm font-semibold text-gray-700">{box.title}</span>
                        </div>

                        {/* Fields */}
                        <div className="divide-y">
                            {box.fields.map((field, fi) => (
                                <div
                                    key={fi}
                                    className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-center px-4 py-3"
                                >
                                    <label className="text-sm font-medium text-gray-600 md:col-span-1">
                                        {field.title}
                                    </label>
                                    <textarea
                                        value={field.description}
                                        onChange={(e) => updateDesc(bi, fi, e.target.value)}
                                        placeholder={`Enter ${field.title.toLowerCase()}…`}
                                        rows={1}
                                        className="lg:col-span-2 w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-indigo-500 resize-none"
                                    />
                                    <Gallery
                                        value={field.image ?? ""}
                                        onChange={(img) =>
                                            updateImage(
                                                bi, fi,
                                                typeof img === "string" ? img : (img as string[])[0] ?? ""
                                            )
                                        }
                                        placeholder="Field image"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
