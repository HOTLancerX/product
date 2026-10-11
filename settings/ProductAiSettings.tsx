"use client";

import React, { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { xFetch } from "@/lib/express";

interface Props {
    initialValues: Record<string, any>;
}

import { DEFAULT_SPECIFICATIONS_PROMPT, DEFAULT_NARRATIVE_PROMPT } from "../lib/aiPromptConstants";

export default function ProductAiSettings({ initialValues }: Props) {
    const [apiKey, setApiKey] = useState(
        initialValues.product_gemini_api_key ||
        initialValues.gemini_api_key ||
        initialValues.seo_api_key ||
        ""
    );
    const [modelName, setModelName] = useState(
        initialValues.product_gemini_model || "gemini-3.6-flash"
    );
    const [promptTemplate, setPromptTemplate] = useState(
        initialValues.product_gemini_prompt || DEFAULT_SPECIFICATIONS_PROMPT
    );

    const [fetching, setFetching] = useState(false);
    const [fetchError, setFetchError] = useState("");
    const [fetchedModels, setFetchedModels] = useState<string[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);

    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    const suggestedModels = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
    ];

    const fetchModels = async () => {
        if (!apiKey?.trim()) {
            setFetchError("Please enter your Gemini API key and click Save Settings before fetching live models.");
            return;
        }
        setFetching(true);
        setFetchError("");
        try {
            const res = await fetch("/api/product/ai-models");
            const data = await res.json();
            if (!res.ok || data.error) {
                setFetchError(data.error || "Failed to fetch Gemini models.");
                return;
            }
            setFetchedModels(data.models || []);
            setShowDropdown(true);
        } catch {
            setFetchError("Network error while communicating with Gemini API.");
        } finally {
            setFetching(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage("");
        try {
            const res = await xFetch("/settings", {
                method: "PUT",
                body: JSON.stringify({
                    product_gemini_api_key: apiKey.trim(),
                    gemini_api_key: apiKey.trim(),
                    product_gemini_model: modelName.trim(),
                    product_gemini_prompt: promptTemplate.trim(),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setMessage(`Error: ${data.error || "Failed to save settings"}`);
            } else {
                setMessage("Gemini AI settings and prompt template saved successfully!");
                setTimeout(() => setMessage(""), 3000);
            }
        } catch {
            setMessage("Network error while saving settings.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl">
            {message && (
                <div
                    className={`rounded-xl px-4 py-3 text-xs font-semibold border ${
                        message.startsWith("Error")
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                >
                    {message}
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-6">
                {/* Header Badge */}
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-xs">
                        <Icon icon="logos:google-gemini" width={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Google Gemini API Configuration</h2>
                        <p className="text-xs text-gray-500">
                            Power bulk product short descriptions and copywriting directly with Gemini 2.5/2.0/1.5 models.
                        </p>
                    </div>
                </div>

                {/* API Key */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700">Google Gemini API Key</label>
                    <p className="text-[11px] text-gray-500">
                        Get your API key from Google AI Studio (ai.google.dev). Stored securely on your server.
                    </p>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50/50"
                    />
                </div>

                {/* Model Selector */}
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700">Gemini AI Model</label>
                    <p className="text-[11px] text-gray-500">
                        Select a model or click <strong>Fetch Models</strong> to view all available models for your API key.
                    </p>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                            placeholder="e.g. gemini-2.5-flash"
                            className="flex-1 text-xs font-mono border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                        <button
                            type="button"
                            onClick={fetchModels}
                            disabled={fetching || !apiKey?.trim()}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl border border-gray-200 transition disabled:opacity-50 cursor-pointer"
                        >
                            {fetching ? (
                                <Icon icon="svg-spinners:ring-resize" width={14} />
                            ) : (
                                <Icon icon="solar:refresh-bold" width={14} />
                            )}
                            Fetch Models
                        </button>
                    </div>

                    {/* Quick Pick Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-medium text-gray-400 mr-1">Recommended:</span>
                        {suggestedModels.map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setModelName(m)}
                                className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono transition cursor-pointer ${
                                    modelName === m
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold"
                                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                                }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    {fetchError && (
                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                            <Icon icon="solar:danger-triangle-bold" width={14} />
                            {fetchError}
                        </p>
                    )}

                    {showDropdown && fetchedModels.length > 0 && (
                        <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-52 overflow-y-auto shadow-sm bg-white">
                            {fetchedModels.map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => {
                                        setModelName(m);
                                        setShowDropdown(false);
                                    }}
                                    className={`w-full text-left px-3.5 py-2 text-xs transition-colors cursor-pointer flex items-center justify-between ${
                                        modelName === m
                                            ? "bg-emerald-50 text-emerald-700 font-bold"
                                            : "hover:bg-gray-50 text-gray-700"
                                    }`}
                                >
                                    <span className="font-mono">{m}</span>
                                    {modelName === m && (
                                        <Icon icon="solar:check-circle-bold" width={14} className="text-emerald-600" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Dynamic Prompt Template Editor */}
                <div className="space-y-3 pt-4 border-t border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-900">
                                AI Prompt & Specifications Instruction Template
                            </label>
                            <p className="text-[11px] text-gray-500">
                                Enter your custom instructions and guidelines. Used dynamically by the bulk generator.
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] text-gray-400 font-medium">Presets:</span>
                            <button
                                type="button"
                                onClick={() => setPromptTemplate(DEFAULT_SPECIFICATIONS_PROMPT)}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                            >
                                8 Specifications List (HTML &lt;ul&gt;)
                            </button>
                            <button
                                type="button"
                                onClick={() => setPromptTemplate(DEFAULT_NARRATIVE_PROMPT)}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition cursor-pointer"
                            >
                                200–300 Words Narrative
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        <textarea
                            rows={14}
                            value={promptTemplate}
                            onChange={(e) => setPromptTemplate(e.target.value)}
                            placeholder="Enter /human prompt guidelines here..."
                            className="w-full text-xs font-mono border border-gray-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-900 text-emerald-300 leading-relaxed resize-y selection:bg-emerald-600 selection:text-white"
                        />
                        <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
                            <span>Includes dynamic product input and generates strict valid HTML.</span>
                            <span className="font-mono">{promptTemplate.length} characters</span>
                        </div>
                    </div>
                </div>

                {/* Prompt Info Box */}
                <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-xl p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                        <Icon icon="solar:info-circle-bold" width={16} className="text-emerald-600" />
                        Dynamic Prompt Engine Active
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                        Whenever you click <strong>Generate All with Gemini</strong> or generate an individual product, this prompt template is injected into the AI request dynamically so you have complete control over formatting, rules, and tags.
                    </p>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-2">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <Icon icon="svg-spinners:ring-resize" width={14} />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Icon icon="solar:check-circle-bold" width={14} />
                                Save AI Settings & Prompt
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
