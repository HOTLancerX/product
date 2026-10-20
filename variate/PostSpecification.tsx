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
import { matchSimilarData } from "./similarDataParser";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SpecField {
    title: string;
    description: string;
    image?: string;
}

interface SpecBox {
    title: string;
    icon?: string;
    fields: SpecField[];
}

interface AiConfig {
    provider: "gemini" | "custom";
    model: string;
    hasGeminiKey: boolean;
    hasCustomKey: boolean;
    isConfigured: boolean;
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
    const title        = (ctx?.title        as string)   ?? "";

    const valueLoaded    = useRef(false);
    const lastCategoryId = useRef<string | null>(null);
    const lastFetchedId  = useRef("");

    const [specs, setSpecs]         = useState<SpecBox[]>(() => parseBlob(value));
    const [template, setTemplate]   = useState<SpecBox[]>([]);
    const [loading, setLoading]     = useState(false);

    // ── AI Generation States ──────────────────────────────────────────────────
    const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState("");
    const [aiSuccess, setAiSuccess] = useState("");

    // Custom Reference / Dummy Data provided by user
    const [customData, setCustomData] = useState("");
    const [showCustomDataInput, setShowCustomDataInput] = useState(false);

    // Similar Data (Offline HTML/Text Matcher)
    const [showSimilarModal, setShowSimilarModal] = useState(false);
    const [similarRawInput, setSimilarRawInput] = useState("");

    // Load AI engine settings from API (strictly follows Product AI Settings)
    useEffect(() => {
        fetch("/api/product/specification/generate")
            .then((res) => res.json())
            .then((data: AiConfig) => {
                if (data && data.provider) {
                    setAiConfig(data);
                }
            })
            .catch(() => {});
    }, []);

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
            icon: box.icon ?? "",
            fields: box.fields.map((f) => ({
                title: f.title,
                description: "",
                image: f.image ?? "",
            })),
        }));
        setSpecs(filled);
        flush(filled);
    };

    // ── AI Auto-Fill Handler ──────────────────────────────────────────────────
    const handleAiGenerate = async (customBoxes?: SpecBox[]) => {
        setAiError("");
        setAiSuccess("");

        if (!title.trim() && !customData.trim()) {
            setAiError("Please enter the Product Title or provide custom reference data first so AI can identify specifications.");
            return;
        }

        const targetBoxes = customBoxes || (specs.length > 0 ? specs : template);
        if (targetBoxes.length === 0) {
            setAiError("No specification template or boxes available to fill.");
            return;
        }

        setIsGenerating(true);

        try {
            const res = await fetch("/api/product/specification/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    boxes: targetBoxes,
                    customData: customData.trim(),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setAiError(data.error || "Failed to generate specifications with AI.");
                setIsGenerating(false);
                return;
            }

            if (Array.isArray(data.boxes)) {
                setSpecs(data.boxes);
                flush(data.boxes);
                const engineName = data.provider === "custom" ? "Custom AI" : "Google Gemini";
                const sourceNote = customData.trim() ? " (parsed from custom reference data)" : "";
                setAiSuccess(`Successfully filled ${data.totalFilled || "all"} specifications using ${engineName} (${data.model})${sourceNote}!`);
                setTimeout(() => setAiSuccess(""), 4500);
            }
        } catch (err: any) {
            setAiError(err?.message || "Network error while connecting to AI specification generator.");
        } finally {
            setIsGenerating(false);
        }
    };

    // Fill a single box with AI
    const handleAiGenerateSingleBox = async (boxIndex: number) => {
        const targetBox = specs[boxIndex];
        if (!targetBox) return;

        setAiError("");
        setAiSuccess("");

        if (!title.trim() && !customData.trim()) {
            setAiError("Please enter the Product Title or provide custom data first.");
            return;
        }

        setIsGenerating(true);

        try {
            const res = await fetch("/api/product/specification/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    boxes: [targetBox],
                    customData: customData.trim(),
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setAiError(data.error || `Failed to fill ${targetBox.title} box.`);
                setIsGenerating(false);
                return;
            }

            if (Array.isArray(data.boxes) && data.boxes[0]) {
                const filledBox = data.boxes[0];
                const next = specs.map((b, i) => (i === boxIndex ? filledBox : b));
                setSpecs(next);
                flush(next);
                setAiSuccess(`Updated "${targetBox.title}" specifications with AI!`);
                setTimeout(() => setAiSuccess(""), 3500);
            }
        } catch (err: any) {
            setAiError(err?.message || `Network error generating ${targetBox.title}.`);
        } finally {
            setIsGenerating(false);
        }
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

    // ── Offline Similar Data Matcher Handler ──────────────────────────────────
    const handleApplySimilarData = () => {
        const trimmed = similarRawInput.trim();
        if (!trimmed) {
            setAiError("Please paste some HTML or specification text first.");
            return;
        }

        const targetBoxes = specs.length > 0 ? specs : template;
        if (targetBoxes.length === 0) {
            setAiError("No specification template available to match.");
            return;
        }

        const result = matchSimilarData(trimmed, targetBoxes);
        setSpecs(result.matchedBoxes);
        flush(result.matchedBoxes);

        setAiSuccess(
            `Matched & filled ${result.totalMatched} fields from similar data! (${result.totalFields - result.totalMatched} fields left blank)`
        );
        setTimeout(() => setAiSuccess(""), 5500);
        setShowSimilarModal(false);
        setSimilarRawInput("");
    };

    const renderSimilarDataModal = () => {
        if (!showSimilarModal) return null;
        return (
            <div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
                onClick={() => setShowSimilarModal(false)}
            >
                <div
                    className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-gray-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 text-left"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Modal Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/80">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-2xs">
                                <Icon icon="solar:clipboard-text-bold" width={22} height={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Similar Data Matcher</h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Paste HTML tables, card code, or raw specs text. Analyzes and maps fields offline instantly.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowSimilarModal(false)}
                            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                        >
                            <Icon icon="solar:close-circle-bold" width={20} />
                        </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6 space-y-3 overflow-y-auto">
                        <div className="flex items-center justify-between text-xs text-gray-600">
                            <span className="font-semibold text-gray-700">Paste Raw Code / Specifications:</span>
                            <span className="text-[11px] text-gray-400">
                                {similarRawInput.length > 0
                                    ? `${similarRawInput.length.toLocaleString()} characters • ${similarRawInput.split("\n").length} lines`
                                    : "HTML tables, tags, or key: value"}
                            </span>
                        </div>

                        <textarea
                            value={similarRawInput}
                            onChange={(e) => setSimilarRawInput(e.target.value)}
                            rows={12}
                            placeholder="Paste complete HTML code (e.g. <section>...</section>, <table>...</table> from Kimovil, GSMArena, Gadgets360) or lines like 'Brand: vivo' here..."
                            className="w-full text-xs p-3 font-mono bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:outline-indigo-500 focus:border-indigo-500 text-gray-800 placeholder-gray-400 leading-relaxed resize-y min-h-45 max-h-95"
                        />

                        <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex items-start gap-2.5 text-xs text-indigo-950">
                            <Icon icon="solar:info-circle-bold" width={18} className="text-indigo-600 shrink-0 mt-0.5" />
                            <div className="leading-relaxed text-[11px]">
                                <strong>How it works:</strong> The system analyzes table cells, rows, labels and values offline. Any field matching your category template will be automatically filled, and fields without a match will stay blank.
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-between px-6 py-3.5 border-t bg-gray-50/80">
                        <div className="flex items-center gap-2">
                            {similarRawInput.trim() && (
                                <button
                                    type="button"
                                    onClick={() => setSimilarRawInput("")}
                                    className="text-xs text-red-600 hover:text-red-800 font-semibold cursor-pointer px-2 py-1"
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowSimilarModal(false)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-semibold transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleApplySimilarData}
                                disabled={!similarRawInput.trim()}
                                className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Icon icon="solar:magic-stick-3-bold" width={15} />
                                <span>⚡ Analyze & Match Now</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderCustomDataBox = (onFillNow?: () => void) => {
        if (!showCustomDataInput) return null;
        return (
            <div className="mt-4 p-4 bg-linear-to-br from-blue-50/90 to-indigo-50/50 border border-blue-200/90 rounded-xl space-y-2.5 shadow-2xs text-left">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Icon icon="solar:document-text-bold" width={18} className="text-blue-600" />
                        <div>
                            <span className="text-xs font-bold text-gray-900">Custom Reference / Raw Specs Data</span>
                            <span className="text-[11px] text-gray-500 ml-1.5">(Dummy data or raw specifications)</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowCustomDataInput(false)}
                        className="text-gray-400 hover:text-gray-700 p-0.5 cursor-pointer"
                        title="Close panel"
                    >
                        <Icon icon="solar:close-circle-bold" width={16} />
                    </button>
                </div>
                <p className="text-[11px] text-gray-600 leading-normal">
                    AI might not know all details for new or obscure products. Paste raw specs text, datasheet information, or dummy data below. AI will analyze and accurately map this data into each specification field.
                </p>
                <textarea
                    value={customData}
                    onChange={(e) => setCustomData(e.target.value)}
                    rows={4}
                    placeholder="Paste raw specifications text here (e.g. copied from GSMArena, official datasheet, manufacturer website, or notes)..."
                    className="w-full text-xs p-3 bg-white border border-gray-300 rounded-lg focus:outline-blue-500 focus:border-blue-500 text-gray-800 placeholder-gray-400 font-mono leading-relaxed"
                />
                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5 flex-wrap gap-2">
                    <span className="text-gray-600">
                        {customData.trim()
                            ? `✓ ${customData.length} characters attached. AI will prioritize this reference data.`
                            : "Leave empty to generate automatically using the product title."}
                    </span>
                    <div className="flex items-center gap-2">
                        {customData.trim() && (
                            <button
                                type="button"
                                onClick={() => setCustomData("")}
                                className="text-red-500 hover:text-red-700 hover:underline cursor-pointer font-medium text-xs px-1"
                            >
                                Clear
                            </button>
                        )}
                        {onFillNow && (
                            <button
                                type="button"
                                onClick={onFillNow}
                                disabled={isGenerating || (!title.trim() && !customData.trim())}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 transition cursor-pointer disabled:opacity-40"
                            >
                                <Icon icon={isGenerating ? "mdi:loading" : "solar:magic-stick-3-bold"} width={13} className={isGenerating ? "animate-spin" : ""} />
                                <span>{isGenerating ? "Processing..." : "Extract & Fill"}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // ── Template available but not yet applied ──────────────────────────────
    if (template.length > 0 && specs.length === 0) {
        return (
            <div className="border border-blue-200 rounded-xl p-5 bg-linear-to-r from-blue-50/80 to-indigo-50/50 shadow-2xs">
                {aiError && (
                    <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
                        <span>{aiError}</span>
                        <button type="button" onClick={() => setAiError("")} className="text-red-500 hover:text-red-800 cursor-pointer">
                            <Icon icon="solar:close-circle-bold" width={16} />
                        </button>
                    </div>
                )}
                {aiSuccess && (
                    <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                        <span>{aiSuccess}</span>
                        <button type="button" onClick={() => setAiSuccess("")} className="text-emerald-500 hover:text-emerald-800 cursor-pointer">
                            <Icon icon="solar:close-circle-bold" width={16} />
                        </button>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
                            <Icon icon="mdi:clipboard-list" width={22} height={22} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900">Specification template available</p>
                            <p className="text-xs text-gray-600 mt-0.5">
                                {template.reduce((s, b) => s + b.fields.length, 0)} fields across {template.length} {template.length === 1 ? "box" : "boxes"}
                            </p>
                            {title ? (
                                <p className="text-[11px] text-indigo-700 font-medium mt-1 truncate max-w-sm sm:max-w-md">
                                    Target Product: <span className="font-bold underline">{title}</span>
                                </p>
                            ) : (
                                <p className="text-[11px] text-amber-700 font-medium mt-1">
                                    Enter Product Title or provide custom data to enable AI specifications generation.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Configured AI Badge */}
                        {aiConfig && (
                            <div
                                className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs shadow-2xs"
                                title={`Engine configured in Settings: ${aiConfig.provider === "custom" ? "Custom AI" : "Google Gemini"}`}
                            >
                                <Icon
                                    icon={aiConfig.provider === "custom" ? "solar:server-square-bold" : "logos:google-gemini"}
                                    width={13}
                                    className={aiConfig.provider === "custom" ? "text-indigo-600" : ""}
                                />
                                <span className="text-[11px] font-semibold text-gray-700">
                                    {aiConfig.provider === "custom"
                                        ? (aiConfig.model?.split("/").pop() || "Custom AI")
                                        : (aiConfig.model || "Gemini")}
                                </span>
                            </div>
                        )}

                        {/* Custom Data / Raw Specs Toggle */}
                        <button
                            type="button"
                            onClick={() => setShowCustomDataInput((v) => !v)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer shadow-2xs ${
                                customData.trim()
                                    ? "bg-blue-600 text-white border-blue-600 font-bold"
                                    : showCustomDataInput
                                    ? "bg-gray-100 border-gray-300 text-gray-800"
                                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                            title="Paste raw specs text or dummy data for AI analysis"
                        >
                            <Icon icon="solar:document-text-bold" width={15} />
                            <span>{customData.trim() ? "Raw Data (Attached)" : "Paste Raw Data"}</span>
                            {customData.trim() && (
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            )}
                        </button>

                        {/* Similar Data Button */}
                        <button
                            type="button"
                            onClick={() => setShowSimilarModal(true)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                            title="Paste HTML code or specifications text from another site to match and auto-fill offline"
                        >
                            <Icon icon="solar:clipboard-text-bold" width={16} />
                            <span>Similar Data</span>
                        </button>

                        {/* AI Auto-Fill Button */}
                        <button
                            type="button"
                            onClick={() => handleAiGenerate(template)}
                            disabled={isGenerating || (!title.trim() && !customData.trim())}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-linear-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-xs font-bold hover:brightness-110 transition shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={!title.trim() && !customData.trim() ? "Enter product title or custom data first" : "Automatically fill all specifications with AI"}
                        >
                            <Icon
                                icon={isGenerating ? "mdi:loading" : "solar:magic-stick-3-bold"}
                                width={16}
                                className={isGenerating ? "animate-spin" : ""}
                            />
                            <span>{isGenerating ? "Generating Specs..." : "⚡ Auto-Fill with AI"}</span>
                        </button>

                        {/* Manual Apply */}
                        <button
                            type="button"
                            onClick={applyTemplate}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-semibold transition cursor-pointer"
                            title="Load empty template fields for manual entry"
                        >
                            <Icon icon="mdi:auto-fix" width={15} />
                            Apply Blank
                        </button>
                    </div>
                </div>

                {/* Collapsible Custom Data Panel */}
                {renderCustomDataBox(() => handleAiGenerate(template))}

                {/* Similar Data Modal */}
                {renderSimilarDataModal()}
            </div>
        );
    }

    // ── Specification fields ────────────────────────────────────────────────
    return (
        <div>
            {/* AI Error Alert */}
            {aiError && (
                <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between shadow-2xs animate-in fade-in">
                    <div className="flex items-center gap-2">
                        <Icon icon="solar:danger-triangle-bold" width={16} className="text-red-500 shrink-0" />
                        <span>{aiError}</span>
                    </div>
                    <button type="button" onClick={() => setAiError("")} className="text-red-400 hover:text-red-700 cursor-pointer">
                        <Icon icon="solar:close-circle-bold" width={16} />
                    </button>
                </div>
            )}

            {/* AI Success Alert */}
            {aiSuccess && (
                <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between shadow-2xs animate-in fade-in">
                    <div className="flex items-center gap-2">
                        <Icon icon="solar:check-circle-bold" width={16} className="text-emerald-600 shrink-0" />
                        <span className="font-medium">{aiSuccess}</span>
                    </div>
                    <button type="button" onClick={() => setAiSuccess("")} className="text-emerald-400 hover:text-emerald-700 cursor-pointer">
                        <Icon icon="solar:close-circle-bold" width={16} />
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
                <div className="flex items-center gap-2">
                    <Icon icon="mdi:clipboard-list" width={22} height={22} className="text-blue-600" />
                    <h2 className="text-base font-bold text-gray-900">Product Specifications</h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {specs.length} {specs.length === 1 ? "Section" : "Sections"}
                    </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Configured AI Badge */}
                    {aiConfig && (
                        <div
                            className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs shadow-2xs"
                            title={`Engine configured in Settings: ${aiConfig.provider === "custom" ? "Custom AI" : "Google Gemini"}`}
                        >
                            <Icon
                                icon={aiConfig.provider === "custom" ? "solar:server-square-bold" : "logos:google-gemini"}
                                width={13}
                                className={aiConfig.provider === "custom" ? "text-indigo-600" : ""}
                            />
                            <span className="text-[11px] font-semibold text-gray-700">
                                {aiConfig.provider === "custom"
                                    ? (aiConfig.model?.split("/").pop() || "Custom AI")
                                    : (aiConfig.model || "Gemini")}
                            </span>
                        </div>
                    )}

                    {/* Custom Data / Raw Specs Toggle */}
                    <button
                        type="button"
                        onClick={() => setShowCustomDataInput((v) => !v)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer shadow-2xs ${
                            customData.trim()
                                ? "bg-blue-600 text-white border-blue-600 font-bold"
                                : showCustomDataInput
                                ? "bg-gray-100 border-gray-300 text-gray-800"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                        title="Paste raw specs text or dummy data for AI analysis"
                    >
                        <Icon icon="solar:document-text-bold" width={15} />
                        <span>{customData.trim() ? "Raw Data (Attached)" : "Paste Raw Data"}</span>
                        {customData.trim() && (
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        )}
                    </button>

                    {/* Similar Data Button */}
                    <button
                        type="button"
                        onClick={() => setShowSimilarModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                        title="Paste HTML code or specifications text from another site to match and auto-fill offline"
                    >
                        <Icon icon="solar:clipboard-text-bold" width={15} />
                        <span>Similar Data</span>
                    </button>

                    {/* AI Auto-Fill Button */}
                    <button
                        type="button"
                        onClick={() => handleAiGenerate()}
                        disabled={isGenerating || (!title.trim() && !customData.trim())}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-linear-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-xs font-bold hover:brightness-110 transition shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!title.trim() && !customData.trim() ? "Enter product title or custom data first" : `Fill all specifications using AI`}
                    >
                        <Icon
                            icon={isGenerating ? "mdi:loading" : "solar:magic-stick-3-bold"}
                            width={15}
                            className={isGenerating ? "animate-spin" : ""}
                        />
                        <span>{isGenerating ? "Generating..." : "⚡ Auto-Fill with AI"}</span>
                    </button>

                    {template.length > 0 && (
                        <button
                            type="button"
                            onClick={applyTemplate}
                            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition px-2 py-1"
                            title="Reset all fields to blank template"
                        >
                            <Icon icon="mdi:refresh" width={14} height={14} />
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* Collapsible Custom Data Panel */}
            {renderCustomDataBox(() => handleAiGenerate())}

            {/* Similar Data Modal */}
            {renderSimilarDataModal()}

            {/* Boxes */}
            <div className="space-y-4">
                {specs.map((box, bi) => (
                    <div key={bi} className="bg-white border rounded-xl overflow-hidden shadow-2xs">
                        {/* Box title bar */}
                        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50/80">
                            <div className="flex items-center gap-2 min-w-0">
                                <Icon
                                    icon={box.icon || "mdi:folder-open"}
                                    width={18}
                                    height={18}
                                    className="text-indigo-600 shrink-0"
                                />
                                <span className="text-sm font-bold text-gray-800 truncate">{box.title}</span>
                                <span className="text-xs text-gray-400 font-medium">({box.fields.length} fields)</span>
                            </div>

                            {/* Single box AI fill button */}
                            <button
                                type="button"
                                onClick={() => handleAiGenerateSingleBox(bi)}
                                disabled={isGenerating || (!title?.trim() && !customData?.trim())}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-200 transition cursor-pointer disabled:opacity-40"
                                title={`Fill ${box.title} using AI`}
                            >
                                <Icon icon="solar:magic-stick-3-linear" width={13} />
                                <span>Fill Box</span>
                            </button>
                        </div>

                        {/* Fields */}
                        <div className="divide-y">
                            {box.fields.map((field, fi) => (
                                <div
                                    key={fi}
                                    className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-center px-4 py-3 hover:bg-gray-50/50 transition"
                                >
                                    <label className="text-sm font-semibold text-gray-700 md:col-span-1">
                                        {field.title}
                                    </label>
                                    <textarea
                                        value={field.description}
                                        onChange={(e) => updateDesc(bi, fi, e.target.value)}
                                        placeholder={`Enter ${field.title.toLowerCase()}…`}
                                        rows={1}
                                        className="lg:col-span-2 w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-indigo-500 resize-none font-medium text-gray-900 bg-white"
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
