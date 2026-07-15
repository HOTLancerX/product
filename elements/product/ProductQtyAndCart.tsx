"use client";

import React from "react";
import { useProduct } from "../../product/ProductContext";
import { Icon } from "@iconify/react";
import {
  ColorPickerPopup,
  Dimensions,
  ButtonGroup,
} from "@/components/builder/controls";

export function ProductQtyAndCartClient({ schema }: { schema: any }) {
  const product = useProduct();

  const btnBg = schema.style?.btnBg ?? "#059669";
  const btnTextColor = schema.style?.btnTextColor ?? "#ffffff";
  const buyBg = schema.style?.buyBg ?? "#2563eb";
  const buyTextColor = schema.style?.buyTextColor ?? "#ffffff";
  const align = schema.style?.textAlign ?? "left";

  const justify = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";

  // Fallback / Mock values if not loaded under context (e.g. inside builder editor)
  const isLoaded = !!product;
  const qty = product?.quantity ?? 1;
  const inc = product?.inc ?? (() => {});
  const dec = product?.dec ?? (() => {});
  const stock = product?.currentStock ?? 45;
  const onAdd = product?.handleAddToCart ?? (() => {});
  const onBuy = product?.handleBuyNow ?? (() => {});
  const onSocial = product?.handleSocial ?? (() => {});
  const hasSocial = isLoaded ? product.socialCount > 0 : true;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: justify,
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          width: "100%",
        }}
      >
        {/* Quantity controller */}
        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden shrink-0 bg-white" style={{ height: "42px" }}>
          <button onClick={dec} className="px-3 hover:bg-gray-100 font-bold transition h-full">-</button>
          <span className="px-4 font-semibold text-gray-700 min-w-[36px] text-center">{qty}</span>
          <button onClick={inc} className="px-3 hover:bg-gray-100 font-bold transition h-full">+</button>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onAdd}
            style={{
              backgroundColor: btnBg,
              color: btnTextColor,
              padding: "10px 20px",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
              height: "42px",
            }}
          >
            Add to Cart
          </button>
          <button
            onClick={onBuy}
            style={{
              backgroundColor: buyBg,
              color: buyTextColor,
              padding: "10px 20px",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
              height: "42px",
            }}
          >
            Buy Now
          </button>
        </div>
      </div>

      {/* Social Ordering Buttons if active */}
      {hasSocial && (
        <div style={{ display: "flex", justifyContent: justify, gap: "10px", flexWrap: "wrap", width: "100%" }}>
          {(!isLoaded || product.whatsappNumber) && (
            <button
              onClick={() => onSocial("whatsapp")}
              className="flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-emerald-50 text-emerald-600 border-emerald-200 transition"
            >
              <Icon icon="mdi:whatsapp" width="18" height="18" />
              Order WhatsApp
            </button>
          )}
          {(!isLoaded || product.telegramUsername) && (
            <button
              onClick={() => onSocial("telegram")}
              className="flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-sky-50 text-sky-600 border-sky-200 transition"
            >
              <Icon icon="mdi:telegram" width="18" height="18" />
              Order Telegram
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const productQtyAndCartElement = {
  type: "product-qty-cart",
  category: "Product Details",
  label: "Product Qty & Cart Buttons",
  icon: "solar:cart-large-bold-duotone",

  schema: {
    style: {
      btnBg: "#059669", // emerald-600 default
      btnTextColor: "#ffffff",
      buyBg: "#2563eb", // blue-600 default
      buyTextColor: "#ffffff",
      textAlign: "left",
    },
    advanced: {
      margin: { top: 0, right: 0, bottom: 20, left: 0, unit: "px" },
      padding: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" },
    },
  },

  controls: [
    {
      tab: "Style",
      section: "Button Colours",
      controls: [
        {
          name: "btnBg",
          responsive: false,
          render: (value: any, onChange: any) => (
            <ColorPickerPopup label="Add to Cart Bg" value={value ?? "#059669"} onChange={onChange} />
          ),
        },
        {
          name: "btnTextColor",
          responsive: false,
          render: (value: any, onChange: any, { schema, updateSchema }: any) => (
            <ColorPickerPopup
              label="Add to Cart Text Color"
              value={schema.style.btnTextColor ?? "#ffffff"}
              onChange={(v) => updateSchema("style", "btnTextColor", v)}
            />
          ),
        },
        {
          name: "buyBg",
          responsive: false,
          render: (value: any, onChange: any, { schema, updateSchema }: any) => (
            <ColorPickerPopup
              label="Buy Now Bg"
              value={schema.style.buyBg ?? "#2563eb"}
              onChange={(v) => updateSchema("style", "buyBg", v)}
            />
          ),
        },
        {
          name: "buyTextColor",
          responsive: false,
          render: (value: any, onChange: any, { schema, updateSchema }: any) => (
            <ColorPickerPopup
              label="Buy Now Text Color"
              value={schema.style.buyTextColor ?? "#ffffff"}
              onChange={(v) => updateSchema("style", "buyTextColor", v)}
            />
          ),
        },
      ],
    },
    {
      tab: "Style",
      section: "Layout Alignment",
      controls: [
        {
          name: "textAlign",
          responsive: true,
          render: (value: any, onChange: any) => (
            <ButtonGroup
              value={value}
              onChange={onChange}
              label="Alignment"
              defaultValue="left"
              grid={2}
              options={[
                { value: "left", icon: "mdi:format-align-left" },
                { value: "center", icon: "mdi:format-align-center" },
                { value: "right", icon: "mdi:format-align-right" },
              ]}
            />
          ),
        },
      ],
    },
    {
      tab: "Advanced",
      section: "Spacing",
      controls: [
        {
          name: "margin",
          responsive: true,
          render: (value: any, onChange: any) => <Dimensions type="margin" value={value} onChange={onChange} />,
        },
        {
          name: "padding",
          responsive: true,
          render: (value: any, onChange: any) => <Dimensions type="padding" value={value} onChange={onChange} />,
        },
      ],
    },
  ],

  render: (element: any) => {
    const marginObj = element.schema.advanced?.margin || {};
    const paddingObj = element.schema.advanced?.padding || {};

    return (
      <div
        style={{
          boxSizing: "border-box",
          marginTop: `${marginObj.top ?? 0}px`,
          marginRight: `${marginObj.right ?? 0}px`,
          marginBottom: `${marginObj.bottom ?? 20}px`,
          marginLeft: `${marginObj.left ?? 0}px`,
          paddingTop: `${paddingObj.top ?? 0}px`,
          paddingRight: `${paddingObj.right ?? 0}px`,
          paddingBottom: `${paddingObj.bottom ?? 0}px`,
          paddingLeft: `${paddingObj.left ?? 0}px`,
        }}
      >
        <ProductQtyAndCartClient schema={element.schema} />
      </div>
    );
  },
};

export default productQtyAndCartElement;
