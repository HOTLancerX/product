"use client";

import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { xFetch } from "@/lib/express";

export interface PaymentGateway {
    type: string;
    label: string;
    icon: string;
    instructions: string;
    accountNumber: string;
    accountName: string;
    bankName: string;
    enabled: boolean;
}

const GATEWAY_PRESETS = [
    { type: "cash_on_delivery",  label: "Cash on Delivery",  icon: "mdi:cash" },
    { type: "bank_transfer",     label: "Bank Transfer",      icon: "mdi:bank-outline" },
    { type: "mobile_banking",    label: "Mobile Banking",     icon: "mdi:cellphone-check" },
    { type: "stripe",            label: "Stripe",             icon: "mdi:credit-card-outline" },
    { type: "paypal",            label: "PayPal",             icon: "mdi:paypal" },
    { type: "bkash",             label: "bKash",              icon: "mdi:cellphone-wireless" },
    { type: "nagad",             label: "Nagad",              icon: "mdi:wallet-outline" },
    { type: "rocket",            label: "Rocket",             icon: "mdi:rocket-outline" },
    { type: "custom",            label: "Custom",             icon: "mdi:puzzle-outline" },
];

const BLANK_GATEWAY: PaymentGateway = {
    type:          "cash_on_delivery",
    label:         "Cash on Delivery",
    icon:          "mdi:cash",
    instructions:  "",
    accountNumber: "",
    accountName:   "",
    bankName:      "",
    enabled:       true,
};

interface Props {
    initialValues?: Record<string, any>;
}

export default function PaymentGatewaySettings({ initialValues = {} }: Props) {
    const [gateways, setGateways] = useState<PaymentGateway[]>(() => {
        if (initialValues.payment_gateways) {
            try { return JSON.parse(initialValues.payment_gateways as string); } catch { /* ignore */ }
        }
        return [{ ...BLANK_GATEWAY }];
    });

    const [editingIdx, setEditingIdx]   = useState<number | null>(null);
    const [saving, setSaving]           = useState(false);
    const [message, setMessage]         = useState("");

    useEffect(() => {
        if (initialValues.payment_gateways) {
            try { setGateways(JSON.parse(initialValues.payment_gateways as string)); } catch { /* ignore */ }
        }
    }, [initialValues.payment_gateways]);

    const addGateway = () => {
        const next = [...gateways, { ...BLANK_GATEWAY }];
        setGateways(next);
        setEditingIdx(next.length - 1);
    };

    const removeGateway = (idx: number) => {
        setGateways((prev) => prev.filter((_, i) => i !== idx));
        if (editingIdx === idx) setEditingIdx(null);
    };

    const updateGateway = (idx: number, patch: Partial<PaymentGateway>) => {
        setGateways((prev) => prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
    };

    const applyPreset = (idx: number, preset: typeof GATEWAY_PRESETS[0]) => {
        updateGateway(idx, { type: preset.type, label: preset.label, icon: preset.icon });
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage("");
        try {
            const res  = await xFetch("/settings", {
                method: "PUT",
                body:   JSON.stringify({ payment_gateways: JSON.stringify(gateways) }),
            });
            const data = await res.json();
            if (!res.ok) {
                setMessage(`Error: ${data.error ?? "Failed to save"}`);
            } else {
                setMessage("Payment gateways saved!");
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

            <div className="space-y-3">
                {gateways.map((gw, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        {/* Card header row */}
                        <div className="flex items-center gap-3 px-4 py-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                <Icon icon={gw.icon || "mdi:credit-card-outline"} width={18} className="text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">{gw.label || "Unnamed gateway"}</p>
                                <p className="text-xs text-gray-400 font-mono">{gw.type}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {/* Enabled toggle */}
                                <button
                                    type="button"
                                    onClick={() => updateGateway(idx, { enabled: !gw.enabled })}
                                    className={`w-9 h-5 rounded-full transition-colors relative ${gw.enabled ? "bg-emerald-500" : "bg-gray-200"}`}
                                    aria-label={gw.enabled ? "Disable" : "Enable"}
                                >
                                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${gw.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                                </button>
                                {/* Edit toggle */}
                                <button
                                    type="button"
                                    onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
                                    aria-label="Edit"
                                >
                                    <Icon icon={editingIdx === idx ? "mdi:chevron-up" : "mdi:pencil-outline"} width={16} />
                                </button>
                                {/* Remove */}
                                <button
                                    type="button"
                                    onClick={() => removeGateway(idx)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition"
                                    aria-label="Remove"
                                >
                                    <Icon icon="mdi:delete-outline" width={16} />
                                </button>
                            </div>
                        </div>

                        {/* Expanded edit panel */}
                        {editingIdx === idx && (
                            <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 space-y-4">
                                {/* Preset picker */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-2">Quick preset</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {GATEWAY_PRESETS.map((p) => (
                                            <button
                                                key={p.type}
                                                type="button"
                                                onClick={() => applyPreset(idx, p)}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                                                    gw.type === p.type
                                                        ? "bg-emerald-500 text-white border-emerald-500"
                                                        : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400 hover:text-emerald-700"
                                                }`}
                                            >
                                                <Icon icon={p.icon} width={12} />
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label="Label (displayed to customer)" value={gw.label}
                                        onChange={(v) => updateGateway(idx, { label: v })} />
                                    <Field label="Type (internal key)" value={gw.type}
                                        onChange={(v) => updateGateway(idx, { type: v })} />
                                    <Field label="Icon (Iconify id, e.g. mdi:cash)" value={gw.icon}
                                        onChange={(v) => updateGateway(idx, { icon: v })} />
                                    <Field label="Account / Wallet Number" value={gw.accountNumber}
                                        onChange={(v) => updateGateway(idx, { accountNumber: v })} />
                                    <Field label="Account Name" value={gw.accountName}
                                        onChange={(v) => updateGateway(idx, { accountName: v })} />
                                    <Field label="Bank / Provider Name" value={gw.bankName}
                                        onChange={(v) => updateGateway(idx, { bankName: v })} />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Payment instructions (shown at checkout)</label>
                                    <textarea
                                        rows={3}
                                        value={gw.instructions}
                                        onChange={(e) => updateGateway(idx, { instructions: e.target.value })}
                                        placeholder="Send payment to account 01XXXXXXXXX and enter your transaction ID below."
                                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Add gateway */}
            <button
                type="button"
                onClick={addGateway}
                className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-emerald-400 text-emerald-600 text-sm font-medium rounded-xl hover:bg-emerald-50 transition"
            >
                <Icon icon="mdi:plus-circle-outline" width={18} />
                Add Payment Gateway
            </button>

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
                        : <><Icon icon="solar:check-circle-bold" width={16} /> Save Gateways</>
                    }
                </button>
            </div>
        </div>
    );
}

// ── Small reusable text field ──────────────────────────────────────────────────

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
        </div>
    );
}
