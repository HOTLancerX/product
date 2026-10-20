"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import { xFetch } from "@/lib/express";
import { DEFAULT_SPECIFICATIONS_PROMPT, DEFAULT_NARRATIVE_PROMPT } from "../lib/aiPromptConstants";

interface Props {
    initialValues: Record<string, any>;
}

export default function ProductAiSettings({ initialValues }: Props) {
    // ── Active Provider Selection ─────────────────────────────────────────────
    const [activeProvider, setActiveProvider] = useState<"gemini" | "custom">(
        initialValues.product_ai_provider === "custom" ? "custom" : "gemini"
    );

    // Visible configuration tab in settings UI
    const [currentConfigTab, setCurrentConfigTab] = useState<"gemini" | "custom">(
        initialValues.product_ai_provider === "custom" ? "custom" : "gemini"
    );

    // ── Google Gemini Configuration ───────────────────────────────────────────
    const [geminiApiKey, setGeminiApiKey] = useState(
        initialValues.product_gemini_api_key ||
        initialValues.gemini_api_key ||
        initialValues.seo_api_key ||
        ""
    );
    const [geminiModelName, setGeminiModelName] = useState(
        initialValues.product_gemini_model || "gemini-2.5-flash"
    );

    // ── Custom / OpenAI-Compatible (OpenRouter, Groq, DeepSeek) Configuration ─
    const [customBaseUrl, setCustomBaseUrl] = useState(
        initialValues.product_custom_base_url ||
        initialValues.openai_base_url ||
        "https://openrouter.ai/api/v1/chat/completions"
    );
    const [customApiKey, setCustomApiKey] = useState(
        initialValues.product_custom_api_key ||
        initialValues.openai_api_key ||
        ""
    );
    const [customModelName, setCustomModelName] = useState(
        initialValues.product_custom_model ||
        initialValues.openai_model ||
        "meta-llama/llama-3.3-70b-instruct"
    );

    // ── Dynamic Prompt Templates ─────────────────────────────────────────────
    // 1. Short Description / Specifications Prompt
    const [promptTemplate, setPromptTemplate] = useState(
        initialValues.product_gemini_prompt ||
        initialValues.product_ai_prompt ||
        DEFAULT_SPECIFICATIONS_PROMPT
    );

    // 2. Full Product Description Prompt
    const [descPromptTemplate, setDescPromptTemplate] = useState(
        initialValues.product_desc_prompt ||
        DEFAULT_NARRATIVE_PROMPT
    );

    // ── Model Fetching States ─────────────────────────────────────────────────
    const [fetchingGemini, setFetchingGemini] = useState(false);
    const [fetchingCustom, setFetchingCustom] = useState(false);
    const [fetchGeminiError, setFetchGeminiError] = useState("");
    const [fetchCustomError, setFetchCustomError] = useState("");
    const [fetchedGeminiModels, setFetchedGeminiModels] = useState<string[]>([]);
    const [fetchedCustomModels, setFetchedCustomModels] = useState<string[]>([]);
    const [showGeminiDropdown, setShowGeminiDropdown] = useState(false);
    const [showCustomDropdown, setShowCustomDropdown] = useState(false);

    // ── Password visibility toggles ───────────────────────────────────────────
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [showCustomKey, setShowCustomKey] = useState(false);

    // ── Save state ────────────────────────────────────────────────────────────
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    // Suggested models
    const suggestedGeminiModels = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
    ];

    const suggestedCustomModels = [
        { label: "Llama 3.3 70B", value: "meta-llama/llama-3.3-70b-instruct" },
        { label: "Gemini 2.5 Flash", value: "google/gemini-2.5-flash" },
        { label: "Claude 3.5 Sonnet", value: "anthropic/claude-3.5-sonnet" },
        { label: "DeepSeek Chat", value: "deepseek/deepseek-chat" },
        { label: "GPT-4o Mini", value: "openai/gpt-4o-mini" },
        { label: "Mistral Large", value: "mistralai/mistral-large-2411" },
    ];

    const endpointPresets = [
        { label: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions" },
        { label: "OpenAI", url: "https://api.openai.com/v1/chat/completions" },
        { label: "Groq", url: "https://api.groq.com/openai/v1/chat/completions" },
        { label: "DeepSeek", url: "https://api.deepseek.com/v1/chat/completions" },
        { label: "Ollama (Local)", url: "http://localhost:11434/v1/chat/completions" },
    ];

    // Fetch Gemini models
    const fetchGeminiModels = async () => {
        if (!geminiApiKey?.trim()) {
            setFetchGeminiError("Please enter your Gemini API key before fetching models.");
            return;
        }
        setFetchingGemini(true);
        setFetchGeminiError("");
        try {
            const res = await fetch(`/api/product/ai-models?provider=gemini&apiKey=${encodeURIComponent(geminiApiKey.trim())}`);
            const data = await res.json();
            if (!res.ok || data.error) {
                setFetchGeminiError(data.error || "Failed to fetch Gemini models.");
                return;
            }
            setFetchedGeminiModels(data.models || []);
            setShowGeminiDropdown(true);
        } catch {
            setFetchGeminiError("Network error while communicating with Gemini API.");
        } finally {
            setFetchingGemini(false);
        }
    };

    // Fetch Custom / OpenRouter models
    const fetchCustomModels = async () => {
        if (!customApiKey?.trim()) {
            setFetchCustomError("Please enter your API key before fetching models.");
            return;
        }
        setFetchingCustom(true);
        setFetchCustomError("");
        try {
            const params = new URLSearchParams({
                provider: "custom",
                apiKey: customApiKey.trim(),
                baseUrl: customBaseUrl.trim(),
            });
            const res = await fetch(`/api/product/ai-models?${params.toString()}`);
            const data = await res.json();
            if (!res.ok || data.error) {
                setFetchCustomError(data.error || "Failed to fetch models from endpoint.");
                return;
            }
            setFetchedCustomModels(data.models || []);
            setShowCustomDropdown(true);
        } catch {
            setFetchCustomError("Network error while connecting to custom endpoint.");
        } finally {
            setFetchingCustom(false);
        }
    };

    // Save All Settings
    const handleSave = async () => {
        setSaving(true);
        setMessage("");
        try {
            const res = await xFetch("/settings", {
                method: "PUT",
                body: JSON.stringify({
                    product_ai_provider: activeProvider,
                    product_gemini_api_key: geminiApiKey.trim(),
                    gemini_api_key: geminiApiKey.trim(),
                    product_gemini_model: geminiModelName.trim(),
                    product_custom_base_url: customBaseUrl.trim(),
                    product_custom_api_key: customApiKey.trim(),
                    product_custom_model: customModelName.trim(),
                    product_gemini_prompt: promptTemplate.trim(),
                    product_desc_prompt: descPromptTemplate.trim(),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setMessage(`Error: ${data.error || "Failed to save settings"}`);
            } else {
                setMessage("AI Settings & Prompt Template saved successfully!");
                setTimeout(() => setMessage(""), 3500);
            }
        } catch {
            setMessage("Network error while saving settings.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Feedback Message */}
            {message && (
                <div
                    className={`rounded-xl px-4 py-3 text-xs font-semibold border flex items-center gap-2 ${
                        message.startsWith("Error")
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                >
                    <Icon
                        icon={message.startsWith("Error") ? "solar:danger-triangle-bold" : "solar:check-circle-bold"}
                        width={18}
                    />
                    {message}
                </div>
            )}

            {/* ── Active Provider Selection Hero Card ── */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div>
                    <h2 className="text-base font-bold text-gray-900">Active AI Generation Engine</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Choose which AI provider powers bulk product short descriptions and copywriting. You can switch between Google Gemini and Custom / OpenRouter anytime.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                    {/* Google Gemini Card */}
                    <div
                        onClick={() => {
                            setActiveProvider("gemini");
                            setCurrentConfigTab("gemini");
                        }}
                        className={`relative rounded-xl border p-4.5 cursor-pointer transition-all ${
                            activeProvider === "gemini"
                                ? "bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                                : "bg-gray-50/60 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                        }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-xs shrink-0">
                                    <Icon icon="logos:google-gemini" width={22} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-gray-900">Google Gemini</h3>
                                        {activeProvider === "gemini" && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                ACTIVE
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                        Direct Google AI Studio integration (Gemini 2.5/2.0/1.5)
                                    </p>
                                </div>
                            </div>

                            <input
                                type="radio"
                                name="activeProvider"
                                checked={activeProvider === "gemini"}
                                onChange={() => {
                                    setActiveProvider("gemini");
                                    setCurrentConfigTab("gemini");
                                }}
                                className="mt-1 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Custom / OpenRouter Card */}
                    <div
                        onClick={() => {
                            setActiveProvider("custom");
                            setCurrentConfigTab("custom");
                        }}
                        className={`relative rounded-xl border p-4.5 cursor-pointer transition-all ${
                            activeProvider === "custom"
                                ? "bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs"
                                : "bg-gray-50/60 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                        }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xs shrink-0">
                                    <Icon icon="solar:cpu-bolt-bold" width={22} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-gray-900">Custom System / OpenRouter</h3>
                                        {activeProvider === "custom" && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                                                ACTIVE
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                        OpenRouter, OpenAI, Groq, DeepSeek, or local Ollama
                                    </p>
                                </div>
                            </div>

                            <input
                                type="radio"
                                name="activeProvider"
                                checked={activeProvider === "custom"}
                                onChange={() => {
                                    setActiveProvider("custom");
                                    setCurrentConfigTab("custom");
                                }}
                                className="mt-1 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Configuration Settings Form Tabs ── */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-6">
                {/* Secondary navigation for configuring both */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setCurrentConfigTab("gemini")}
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                currentConfigTab === "gemini"
                                    ? "bg-emerald-600 text-white shadow-2xs"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                        >
                            <Icon icon="logos:google-gemini" width={14} />
                            Google Gemini Config
                            {activeProvider === "gemini" && (
                                <span className={`w-2 h-2 rounded-full ${currentConfigTab === "gemini" ? "bg-white" : "bg-emerald-500"}`} />
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setCurrentConfigTab("custom")}
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                currentConfigTab === "custom"
                                    ? "bg-indigo-600 text-white shadow-2xs"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                        >
                            <Icon icon="solar:cpu-bolt-bold" width={14} />
                            Custom / OpenRouter Config
                            {activeProvider === "custom" && (
                                <span className={`w-2 h-2 rounded-full ${currentConfigTab === "custom" ? "bg-white" : "bg-indigo-500"}`} />
                            )}
                        </button>
                    </div>

                    <div className="text-[11px] font-medium text-gray-500">
                        Active in generator:{" "}
                        <strong className={activeProvider === "gemini" ? "text-emerald-700" : "text-indigo-700"}>
                            {activeProvider === "gemini" ? "Google Gemini" : "Custom / OpenRouter"}
                        </strong>
                    </div>
                </div>

                {/* ── Google Gemini Tab Panel ── */}
                {currentConfigTab === "gemini" && (
                    <div className="space-y-5">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                            <Icon icon="logos:google-gemini" width={16} />
                            Google Gemini API Settings
                        </div>

                        {/* API Key */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-gray-700">Google Gemini API Key</label>
                            <p className="text-[11px] text-gray-500">
                                Get your API key from Google AI Studio (ai.google.dev). Stored securely on your server.
                            </p>
                            <div className="relative">
                                <input
                                    type={showGeminiKey ? "text" : "password"}
                                    value={geminiApiKey}
                                    onChange={(e) => setGeminiApiKey(e.target.value)}
                                    placeholder="AIzaSy..."
                                    className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3.5 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50/50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                                >
                                    <Icon icon={showGeminiKey ? "solar:eye-closed-bold" : "solar:eye-bold"} width={16} />
                                </button>
                            </div>
                        </div>

                        {/* Gemini Model Selector */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-700">Gemini AI Model</label>
                            <p className="text-[11px] text-gray-500">
                                Choose or type the model name. Use <strong>Fetch Models</strong> to see available models for your API key.
                            </p>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={geminiModelName}
                                    onChange={(e) => setGeminiModelName(e.target.value)}
                                    placeholder="e.g. gemini-2.5-flash"
                                    className="flex-1 text-xs font-mono border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={fetchGeminiModels}
                                    disabled={fetchingGemini || !geminiApiKey?.trim()}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl border border-gray-200 transition disabled:opacity-50 cursor-pointer"
                                >
                                    {fetchingGemini ? (
                                        <Icon icon="svg-spinners:ring-resize" width={14} />
                                    ) : (
                                        <Icon icon="solar:refresh-bold" width={14} />
                                    )}
                                    Fetch Models
                                </button>
                            </div>

                            {/* Gemini Quick Chips */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-[11px] font-medium text-gray-400 mr-1">Recommended:</span>
                                {suggestedGeminiModels.map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setGeminiModelName(m)}
                                        className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono transition cursor-pointer ${
                                            geminiModelName === m
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold"
                                                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                                        }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>

                            {fetchGeminiError && (
                                <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                    <Icon icon="solar:danger-triangle-bold" width={14} />
                                    {fetchGeminiError}
                                </p>
                            )}

                            {showGeminiDropdown && fetchedGeminiModels.length > 0 && (
                                <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-52 overflow-y-auto shadow-sm bg-white">
                                    {fetchedGeminiModels.map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => {
                                                setGeminiModelName(m);
                                                setShowGeminiDropdown(false);
                                            }}
                                            className={`w-full text-left px-3.5 py-2 text-xs transition-colors cursor-pointer flex items-center justify-between ${
                                                geminiModelName === m
                                                    ? "bg-emerald-50 text-emerald-700 font-bold"
                                                    : "hover:bg-gray-50 text-gray-700"
                                            }`}
                                        >
                                            <span className="font-mono">{m}</span>
                                            {geminiModelName === m && (
                                                <Icon icon="solar:check-circle-bold" width={14} className="text-emerald-600" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Custom / OpenRouter Tab Panel ── */}
                {currentConfigTab === "custom" && (
                    <div className="space-y-5">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                            <Icon icon="solar:cpu-bolt-bold" width={16} className="text-indigo-600" />
                            Custom System / OpenAI-Compatible (OpenRouter, Groq, DeepSeek) Settings
                        </div>

                        {/* Base URL / Endpoint */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-700">API Endpoint / Base URL</label>
                            <p className="text-[11px] text-gray-500">
                                Enter the full chat completions URL or base URL. Example:{" "}
                                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-indigo-700">
                                    https://openrouter.ai/api/v1/chat/completions
                                </code>
                            </p>
                            <input
                                type="text"
                                value={customBaseUrl}
                                onChange={(e) => setCustomBaseUrl(e.target.value)}
                                placeholder="https://openrouter.ai/api/v1/chat/completions"
                                className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            />

                            {/* Preset Buttons */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-[11px] font-medium text-gray-400 mr-1">Presets:</span>
                                {endpointPresets.map((ep) => (
                                    <button
                                        key={ep.label}
                                        type="button"
                                        onClick={() => setCustomBaseUrl(ep.url)}
                                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer font-medium ${
                                            customBaseUrl === ep.url
                                                ? "bg-indigo-50 text-indigo-700 border-indigo-300 font-bold"
                                                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                                        }`}
                                    >
                                        {ep.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom API Key */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-gray-700">API Key</label>
                            <p className="text-[11px] text-gray-500">
                                API Key for OpenRouter (<code className="text-gray-700">sk-or-v1-...</code>), OpenAI, Groq, or DeepSeek. Stored securely on your server.
                            </p>
                            <div className="relative">
                                <input
                                    type={showCustomKey ? "text" : "password"}
                                    value={customApiKey}
                                    onChange={(e) => setCustomApiKey(e.target.value)}
                                    placeholder="sk-or-v1-..."
                                    className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3.5 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50/50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCustomKey(!showCustomKey)}
                                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                                >
                                    <Icon icon={showCustomKey ? "solar:eye-closed-bold" : "solar:eye-bold"} width={16} />
                                </button>
                            </div>
                        </div>

                        {/* Custom Model Selector */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-700">AI Model Name</label>
                            <p className="text-[11px] text-gray-500">
                                Exact model ID on OpenRouter or your custom provider.
                            </p>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={customModelName}
                                    onChange={(e) => setCustomModelName(e.target.value)}
                                    placeholder="e.g. meta-llama/llama-3.3-70b-instruct"
                                    className="flex-1 text-xs font-mono border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={fetchCustomModels}
                                    disabled={fetchingCustom || !customApiKey?.trim()}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl border border-gray-200 transition disabled:opacity-50 cursor-pointer"
                                >
                                    {fetchingCustom ? (
                                        <Icon icon="svg-spinners:ring-resize" width={14} />
                                    ) : (
                                        <Icon icon="solar:refresh-bold" width={14} />
                                    )}
                                    Fetch Models
                                </button>
                            </div>

                            {/* Custom Quick Chips */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-[11px] font-medium text-gray-400 mr-1">Popular Models:</span>
                                {suggestedCustomModels.map((m) => (
                                    <button
                                        key={m.value}
                                        type="button"
                                        onClick={() => setCustomModelName(m.value)}
                                        className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono transition cursor-pointer ${
                                            customModelName === m.value
                                                ? "bg-indigo-50 text-indigo-700 border-indigo-300 font-bold"
                                                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                                        }`}
                                    >
                                        {m.label}
                                    </button>
                                ))}
                            </div>

                            {fetchCustomError && (
                                <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                    <Icon icon="solar:danger-triangle-bold" width={14} />
                                    {fetchCustomError}
                                </p>
                            )}

                            {showCustomDropdown && fetchedCustomModels.length > 0 && (
                                <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-52 overflow-y-auto shadow-sm bg-white">
                                    {fetchedCustomModels.map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => {
                                                setCustomModelName(m);
                                                setShowCustomDropdown(false);
                                            }}
                                            className={`w-full text-left px-3.5 py-2 text-xs transition-colors cursor-pointer flex items-center justify-between ${
                                                customModelName === m
                                                    ? "bg-indigo-50 text-indigo-700 font-bold"
                                                    : "hover:bg-gray-50 text-gray-700"
                                            }`}
                                        >
                                            <span className="font-mono">{m}</span>
                                            {customModelName === m && (
                                                <Icon icon="solar:check-circle-bold" width={14} className="text-indigo-600" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Dynamic Prompt Templates Editor (Shared) ── */}
                <div className="space-y-6 pt-6 border-t border-gray-100">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">AI Prompt Guidelines & Templates</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Configure prompt instructions for short descriptions (specifications) and full descriptions. Applied dynamically by whichever AI engine is active.
                        </p>
                    </div>

                    {/* BOX 1: Short Description / Specifications Prompt */}
                    <div className="space-y-2.5 p-4.5 rounded-2xl border border-gray-200 bg-gray-50/40">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <label className="block text-xs font-bold text-gray-900">
                                        1. Short Description / Specifications Prompt Template
                                    </label>
                                </div>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                    Used by <strong>Bulk Short Description</strong> page to produce the 8 HTML bullet specifications.
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] text-gray-400 font-medium">Reset:</span>
                                <button
                                    type="button"
                                    onClick={() => setPromptTemplate(DEFAULT_SPECIFICATIONS_PROMPT)}
                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                                >
                                    8 Specs Default (&lt;ul&gt;&lt;li&gt;)
                                </button>
                            </div>
                        </div>

                        <div className="relative">
                            <textarea
                                rows={10}
                                value={promptTemplate}
                                onChange={(e) => setPromptTemplate(e.target.value)}
                                placeholder="Enter specifications prompt guidelines here..."
                                className="w-full text-xs font-mono border border-gray-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-900 text-emerald-300 leading-relaxed resize-y selection:bg-emerald-600 selection:text-white"
                            />
                            <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
                                <span>Output will be injected as product short description / specs list.</span>
                                <span className="font-mono">{promptTemplate.length} characters</span>
                            </div>
                        </div>
                    </div>

                    {/* BOX 2: Full Product Description Prompt */}
                    <div className="space-y-2.5 p-4.5 rounded-2xl border border-gray-200 bg-gray-50/40">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                    <label className="block text-xs font-bold text-gray-900">
                                        2. Full Product Description Prompt Template
                                    </label>
                                </div>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                    Used by <strong>Bulk Description</strong> page to produce detailed 200–300 words narrative copywriting with HTML formatting.
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] text-gray-400 font-medium">Reset:</span>
                                <button
                                    type="button"
                                    onClick={() => setDescPromptTemplate(DEFAULT_NARRATIVE_PROMPT)}
                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
                                >
                                    200–300 Words Narrative Default
                                </button>
                            </div>
                        </div>

                        <div className="relative">
                            <textarea
                                rows={10}
                                value={descPromptTemplate}
                                onChange={(e) => setDescPromptTemplate(e.target.value)}
                                placeholder="Enter full description prompt guidelines here..."
                                className="w-full text-xs font-mono border border-gray-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-900 text-indigo-300 leading-relaxed resize-y selection:bg-indigo-600 selection:text-white"
                            />
                            <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
                                <span>Output will be injected directly as the full product description.</span>
                                <span className="font-mono">{descPromptTemplate.length} characters</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Active Info Box */}
                <div className={`rounded-xl p-4 space-y-1.5 border ${
                    activeProvider === "custom"
                        ? "bg-indigo-50/50 border-indigo-200/70 text-indigo-900"
                        : "bg-emerald-50/50 border-emerald-200/70 text-emerald-900"
                }`}>
                    <div className="flex items-center gap-2 text-xs font-bold">
                        <Icon
                            icon={activeProvider === "custom" ? "solar:cpu-bolt-bold" : "solar:info-circle-bold"}
                            width={16}
                            className={activeProvider === "custom" ? "text-indigo-600" : "text-emerald-600"}
                        />
                        Active Provider: {activeProvider === "custom" ? "Custom System / OpenRouter" : "Google Gemini"}
                    </div>
                    <p className={`text-[11px] leading-relaxed ${
                        activeProvider === "custom" ? "text-indigo-800" : "text-emerald-800"
                    }`}>
                        Bulk Short Descriptions will use{" "}
                        <strong>{activeProvider === "custom" ? (customModelName || "Custom Model") : (geminiModelName || "Gemini Model")}</strong>{" "}
                        via {activeProvider === "custom" ? customBaseUrl : "Google Generative AI"}.
                    </p>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-2">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className={`inline-flex items-center gap-2 px-6 py-2.5 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 ${
                            activeProvider === "custom"
                                ? "bg-indigo-600 hover:bg-indigo-500"
                                : "bg-emerald-600 hover:bg-emerald-500"
                        }`}
                    >
                        {saving ? (
                            <>
                                <Icon icon="svg-spinners:ring-resize" width={14} />
                                Saving AI Settings...
                            </>
                        ) : (
                            <>
                                <Icon icon="solar:check-circle-bold" width={14} />
                                Save AI Settings & Engine
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
