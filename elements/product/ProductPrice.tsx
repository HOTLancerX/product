"use client";

import React from "react";
import { useProduct } from "../../product/ProductContext";
import {
  ColorPickerPopup,
  Dimensions,
  ButtonGroup,
  Typography,
} from "@/components/builder/controls";

function fmtPrice(n: number) {
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function ProductPriceClient({ schema }: { schema: any }) {
  const product = useProduct();

  const color = schema.style?.color ?? "#059669";
  const regColor = schema.style?.regularColor ?? "#9ca3af";
  const align = schema.style?.textAlign ?? "left";

  const fontSize = schema.style?.typography?.fontSize ?? 24;
  const fontWeight = schema.style?.typography?.fontWeight ?? "700";

  const justify = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";

  // Fallback / Mock values if not loaded under context (e.g. inside builder editor)
  const isLoaded = !!product;
  const curSymbol = product?.currencySymbol ?? "$";
  const curPrice = product?.currentPrice ?? 120.0;
  const regPrice = product?.regularPrice ?? 150.0;
  const discount = product?.discountPercent ?? 20;
  const hasDiscount = isLoaded ? product.hasDiscount : true;
  const flashBanner = product?.flashSaleBanner ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: justify === "center" ? "center" : "flex-start", width: "100%" }}>
      {/* Flash Sale Banner if active */}
      {flashBanner && (
        <div className="flex items-center gap-2 mb-2 bg-amber-500 text-white text-xs px-3 py-1 rounded-full font-bold">
          <span>⚡ FLASH SALE</span>
          <span>-{flashBanner.percentage}%</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: justify, alignItems: "center", gap: "10px", width: "100%" }}>
        <span style={{ color, fontSize: `${fontSize}px`, fontWeight }}>
          {curSymbol} {fmtPrice(curPrice)}
        </span>
        {hasDiscount && regPrice > 0 && regPrice > curPrice && (
          <>
            <span style={{ color: regColor, textDecoration: "line-through", fontSize: "16px" }}>
              {curSymbol} {fmtPrice(regPrice)}
            </span>
            <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-bold">
              {discount}% OFF
            </span>
          </>
        )}
      </div>
    </div>
  );
}

const productPriceElement = {
  type: "product-price",
  category: "Product Details",
  label: "Product Price",
  icon: "solar:wad-of-money-bold-duotone",

  schema: {
    style: {
      color: "#059669", // Price emerald color
      regularColor: "#9ca3af", // gray-400
      typography: {
        fontSize: 24,
        fontSizeUnit: "px",
        fontWeight: "700",
      },
      textAlign: "left",
    },
    advanced: {
      margin: { top: 0, right: 0, bottom: 12, left: 0, unit: "px" },
      padding: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" },
    },
  },

  controls: [
    {
      tab: "Style",
      section: "Price Colours",
      controls: [
        {
          name: "color",
          responsive: false,
          render: (value: any, onChange: any) => (
            <ColorPickerPopup label="Price Text Color" value={value ?? "#059669"} onChange={onChange} />
          ),
        },
        {
          name: "regularColor",
          responsive: false,
          render: (value: any, onChange: any, { schema, updateSchema }: any) => (
            <ColorPickerPopup
              label="Original Price Color"
              value={schema.style.regularColor ?? "#9ca3af"}
              onChange={(v) => updateSchema("style", "regularColor", v)}
            />
          ),
        },
      ],
    },
    {
      tab: "Style",
      section: "Typography & Layout",
      controls: [
        {
          name: "typography",
          responsive: true,
          render: (value: any, onChange: any) => (
            <Typography value={value} onChange={onChange} />
          ),
        },
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
    return <ProductPriceClient schema={element.schema} />;
  },
};

export default productPriceElement;
