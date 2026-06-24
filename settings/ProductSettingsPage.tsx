"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import FormSettings from "@/components/admin/FormSettings";
import { useActivePlugins } from "@/hook/useActivePlugins";
import useSettings from "@/lib/useSettings";
import PaymentGatewaySettings from "./PaymentGatewaySettings";
import CheckoutFieldSettings from "./CheckoutFieldSettings";
import CategoryPageSettings from "./CategoryPageSettings";

/**
 * Product plugin settings page.
 * Mounted at /admin/product/settings via addHook("admin.pages", ...) in index.ts.
 *
 * Tabs:
 *   General   — currency, social order buttons, stock messaging
 *   Shipping  — shipping costs, free shipping threshold
 *   Checkout  — configurable checkout form fields (order/visibility/required)
 *   Payment   — payment gateway management (JSON editor + builder UI)
 */

interface Tab {
    key: string;
    label: string;
    icon: string;
    description: string;
}

const TABS: Tab[] = [
    {
        key:         "general",
        label:       "General",
        icon:        "solar:settings-bold",
        description: "Currency, social order channels, stock messaging and product reviews.",
    },
    {
        key:         "shipping",
        label:       "Shipping",
        icon:        "solar:delivery-bold",
        description: "Default shipping rates, free shipping threshold and shipping zones.",
    },
    {
        key:         "category",
        label:       "Category Page",
        icon:        "solar:filter-bold",
        description: "Configure the filter panel, filter style and sort options shown on product category pages.",
    },
    {
        key:         "checkout",
        label:       "Checkout Fields",
        icon:        "solar:checklist-bold",
        description: "Control which fields appear on the checkout form, their order and whether they are required.",
    },
    {
        key:         "payment",
        label:       "Payment",
        icon:        "solar:card-bold",
        description: "Configure payment gateways available at checkout.",
    },
];

export default function ProductSettingsPage() {
    const activePlugins         = useActivePlugins();
    const { settings, loading } = useSettings();
    const [activeTab, setActiveTab] = useState("general");

    if (activePlugins === null || loading) {
        return (
            <div className="flex items-center justify-center py-24 text-gray-400">
                <Icon icon="svg-spinners:ring-resize" width={32} />
            </div>
        );
    }

    const currentTab = TABS.find((t) => t.key === activeTab) ?? TABS[0];

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Product Settings</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Configure your store's currency, shipping, checkout form and payment methods.
                </p>
            </div>

            {/* Tab bar */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex gap-1 overflow-x-auto">
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                                    isActive
                                        ? "border-emerald-500 text-emerald-600"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                            >
                                <Icon icon={tab.icon} width={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Tab description */}
            <p className="text-sm text-gray-500">{currentTab.description}</p>

            {/* Tab content */}
            {activeTab === "general" && (
                <FormSettings
                    type="product-settings"
                    activePlugins={activePlugins}
                    initialValues={settings}
                />
            )}

            {activeTab === "shipping" && (
                <FormSettings
                    type="product-shipping"
                    activePlugins={activePlugins}
                    initialValues={settings}
                />
            )}

            {activeTab === "category" && (
                <CategoryPageSettings initialValues={settings} />
            )}

            {activeTab === "checkout" && (
                <CheckoutFieldSettings initialValues={settings} />
            )}

            {activeTab === "payment" && (
                <PaymentGatewaySettings initialValues={settings} />
            )}
        </div>
    );
}
