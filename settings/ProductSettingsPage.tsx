"use client";

import { Icon } from "@iconify/react";
import FormSettings from "@/components/admin/FormSettings";
import { useActivePlugins } from "@/hook/useActivePlugins";
import useSettings from "@/lib/useSettings";

/**
 * Product plugin settings page.
 * Mounted at /admin/product/settings via addHook("admin.pages", ...) in index.ts.
 *
 * Renders ONLY setting.form fields with type "product-settings".
 * Completely isolated — no core settings fields appear here.
 * Other plugins can also inject into type "product-settings" if needed.
 */
export default function ProductSettingsPage() {
    const activePlugins         = useActivePlugins();
    const { settings, loading } = useSettings();

    if (activePlugins === null || loading) {
        return (
            <div className="flex items-center justify-center py-24 text-gray-400">
                <Icon icon="svg-spinners:ring-resize" width={32} />
            </div>
        );
    }

    return (
        <>
            <FormSettings
                type="product-settings"
                activePlugins={activePlugins}
                initialValues={settings}
            />
        </>
    );
}
