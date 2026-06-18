"use client";

import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { xFetch } from "@/lib/express";

export interface CheckoutField {
    key: string;
    name: string;
    desktop: string;
    mobile: string;
    required: boolean;
    status: boolean;
}

const DEFAULT_FIELDS: CheckoutField[] = [
    { key: "name",           name: "Full Name",           desktop: "w-1/2", mobile: "wp-full", required: true,  status: true },
    { key: "phone",          name: "Phone Number",         desktop: "w-1/2", mobile: "wp-full", required: true,  status: true },
    { key: "email",          name: "Email",                desktop: "w-full", mobile: "wp-full", required: false, status: true },
    { key: "address",        name: "Address",              desktop: "w-full", mobile: "wp-full", required: false, status: true },
    { key: "state",          name: "State / Province",     desktop: "w-1/2", mobile: "wp-full", required: false, status: true },
    { key: "city",           name: "City",                 desktop: "w-1/2", mobile: "wp-full", required: false, status: true },
    { key: "zipCode",        name: "Zip Code",             desktop: "w-1/2", mobile: "wp-full", required: false, status: true },
    { key: "shippingMethod", name: "Shipping Method",      desktop: "w-full", mobile: "wp-full", required: true,  status: true },
    { key: "paymentMethod",  name: "Payment Method",       desktop: "w-full", mobile: "wp-full", required: true,  status: true },
    { key: "transactionId",  name: "Transaction ID",       desktop: "w-1/2", mobile: "wp-full", required: false, status: true },
    { key: "paymentInfo",    name: "Payment Details",      desktop: "w-1/2", mobile: "wp-full", required: false, status: true },
    { key: "proofImage",     name: "Payment Screenshot",   desktop: "w-full", mobile: "wp-full", required: false, status: true },
    { key: "notes",          name: "Order Notes",          desktop: "w-full", mobile: "wp-full", required: false, status: true },
];

const WIDTH_OPTIONS = ["wp-full", "wp-1/2", "wp-1/3", "wp-2/3"];

interface Props {
    initialValues?: Record<string, any>;
}

export default function CheckoutFieldSettings({ initialValues = {} }: Props) {
    const [fields, setFields] = useState<CheckoutField[]>(() => {
        if (initialValues.checkout_fields) {
            try {
                return JSON.parse(initialValues.checkout_fields as string);
            } catch {
                return DEFAULT_FIELDS;
            }
        }
        return DEFAULT_FIELDS;
    });

    const [saving, setSaving]   = useState(false);
    const [message, setMessage] = useState("");

    // Sync when initialValues arrive async
    useEffect(() => {
        if (initialValues.checkout_fields) {
            try {
                setFields(JSON.parse(initialValues.checkout_fields as string));
            } catch {
                /* ignore */
            }
        }
    }, [initialValues.checkout_fields]);

    const update = (idx: number, patch: Partial<CheckoutField>) => {
        setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
    };

    const moveUp = (idx: number) => {
        if (idx === 0) return;
        setFields((prev) => {
            const next = [...prev];
            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
            return next;
        });
    };

    const moveDown = (idx: number) => {
        setFields((prev) => {
            if (idx >= prev.length - 1) return prev;
            const next = [...prev];
            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage("");
        try {
            const res  = await xFetch("/settings", {
                method: "PUT",
                body:   JSON.stringify({ checkout_fields: JSON.stringify(fields) }),
            });
            const data = await res.json();
            if (!res.ok) {
                setMessage(`Error: ${data.error ?? "Failed to save"}`);
            } else {
                setMessage("Checkout fields saved!");
                setTimeout(() => setMessage(""), 3000);
            }
        } catch {
            setMessage("Network error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            {message && (
                <div className={`rounded-lg px-4 py-3 text-sm font-medium border ${
                    message.startsWith("Error")
                        ? "bg-red-400/10 text-red-400 border-red-400/25"
                        : "bg-emerald-400/10 text-emerald-400 border-emerald-400/25"
                }`}>
                    {message}
                </div>
            )}

            {/* Column headers */}
            <div className="hidden md:grid grid-cols-[1.5rem_1fr_6rem_6rem_5rem_5rem_3rem] gap-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <span />
                <span>Field</span>
                <span>Desktop width</span>
                <span>Mobile width</span>
                <span className="text-center">Required</span>
                <span className="text-center">Visible</span>
                <span />
            </div>

            <div className="space-y-2">
                {fields.map((field, idx) => (
                    <div
                        key={field.key}
                        className={`grid grid-cols-1 md:grid-cols-[1.5rem_1fr_6rem_6rem_5rem_5rem_3rem] gap-2 items-center bg-white border rounded-xl px-3 py-3 shadow-sm transition ${
                            field.status ? "border-gray-200" : "border-gray-100 opacity-60"
                        }`}
                    >
                        {/* Drag handle (visual only) */}
                        <Icon icon="mdi:drag-vertical" width={16} className="text-gray-300 hidden md:block cursor-grab" />

                        {/* Label */}
                        <div>
                            <p className="text-sm font-medium text-gray-800">{field.name}</p>
                            <p className="text-xs text-gray-400 font-mono">{field.key}</p>
                        </div>

                        {/* Desktop width */}
                        <select
                            value={field.desktop}
                            onChange={(e) => update(idx, { desktop: e.target.value })}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            {WIDTH_OPTIONS.map((w) => (
                                <option key={w} value={w}>{w}</option>
                            ))}
                        </select>

                        {/* Mobile width */}
                        <select
                            value={field.mobile}
                            onChange={(e) => update(idx, { mobile: e.target.value })}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            {WIDTH_OPTIONS.map((w) => (
                                <option key={w} value={w}>{w}</option>
                            ))}
                        </select>

                        {/* Required toggle */}
                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={() => update(idx, { required: !field.required })}
                                className={`w-9 h-5 rounded-full transition-colors relative ${
                                    field.required ? "bg-emerald-500" : "bg-gray-200"
                                }`}
                                aria-label={`${field.required ? "Disable" : "Enable"} required for ${field.name}`}
                            >
                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                    field.required ? "translate-x-4" : "translate-x-0.5"
                                }`} />
                            </button>
                        </div>

                        {/* Visible toggle */}
                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={() => update(idx, { status: !field.status })}
                                className={`w-9 h-5 rounded-full transition-colors relative ${
                                    field.status ? "bg-emerald-500" : "bg-gray-200"
                                }`}
                                aria-label={`${field.status ? "Hide" : "Show"} ${field.name}`}
                            >
                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                    field.status ? "translate-x-4" : "translate-x-0.5"
                                }`} />
                            </button>
                        </div>

                        {/* Reorder buttons */}
                        <div className="flex flex-col gap-0.5 items-center">
                            <button
                                type="button"
                                onClick={() => moveUp(idx)}
                                disabled={idx === 0}
                                className="text-gray-400 hover:text-gray-600 disabled:opacity-20 transition"
                                aria-label="Move up"
                            >
                                <Icon icon="mdi:chevron-up" width={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => moveDown(idx)}
                                disabled={idx === fields.length - 1}
                                className="text-gray-400 hover:text-gray-600 disabled:opacity-20 transition"
                                aria-label="Move down"
                            >
                                <Icon icon="mdi:chevron-down" width={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Save */}
            <div className="flex justify-end pt-2">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold rounded-lg transition disabled:opacity-55 disabled:cursor-not-allowed"
                >
                    {saving
                        ? <><Icon icon="svg-spinners:ring-resize" width={16} /> Saving…</>
                        : <><Icon icon="solar:check-circle-bold" width={16} /> Save Fields</>
                    }
                </button>
            </div>
        </div>
    );
}
