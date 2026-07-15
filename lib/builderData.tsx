/**
 * plugin/product/lib/builderData.tsx
 *
 * SERVER-ONLY. Registers server-side renderers for product plugin elements.
 */

import React from "react";
import { registerBuilderElement } from "@/hook/builderDataHooks";
import CartExtended from "../elements/CartExtended";
import { CartListFrontend } from "../elements/CartList";

registerBuilderElement("cart", async (schema: any) => {
    const fontSize = schema.style?.fontSize || 20;
    const color = schema.style?.color || "#374151";
    const displayType = schema.content?.displayType || "drawer-right";
    const icon = schema.content?.icon || "mdi:cart-outline";

    return (
        <div style={{ display: "inline-block" }}>
            <CartExtended displayType={displayType} fontSize={fontSize} color={color} icon={icon} />
        </div>
    );
});

registerBuilderElement("cart-list", async (schema: any) => {
    return (
        <CartListFrontend element={{ schema }} />
    );
});
