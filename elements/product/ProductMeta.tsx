"use client";

import React from "react";
import { useProduct } from "../../product/ProductContext";
import {
  ColorPickerPopup,
  Dimensions,
  Typography,
  ButtonGroup,
  Toggle,
  Section,
} from "@/components/builder/controls";

export function ProductMetaClient({ schema }: { schema: any }) {
  const product = useProduct();

  const color = schema.style?.color ?? "#6b7280";
  const align = schema.style?.textAlign ?? "left";

  const fontSize = schema.style?.typography?.fontSize ?? 14;
  const fontWeight = schema.style?.typography?.fontWeight ?? "400";

  const showBreadcrumb = schema.content?.showBreadcrumb !== false;
  const showStock = schema.content?.showStockBadge !== false;

  const justify = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";

  // Fallback mockups
  const isLoaded = !!product;
  const breadcrumbs = product?.categoryLinks ?? [
    { title: "Home", url: "/" },
    { title: "Shop", url: "#" },
    { title: "Category", url: "#" },
  ];
  const stock = product?.currentStock ?? 45;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: justify,
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
        color,
        fontSize: `${fontSize}px`,
        fontWeight,
        width: "100%",
      }}
    >
      {showBreadcrumb && (
        <div className="flex items-center gap-2">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.url + i}>
              {i > 0 && <span>&gt;</span>}
              <a href={crumb.url} className="hover:underline text-inherit" style={{ textDecoration: "none" }}>
                {crumb.title}
              </a>
            </React.Fragment>
          ))}
        </div>
      )}
      {showStock && (
        <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-bold">
          {stock > 0 ? `In Stock (${stock} available)` : "Out of Stock"}
        </span>
      )}
    </div>
  );
}

const productMetaElement = {
  type: "product-meta",
  category: "Product Details",
  label: "Product Metadata & Breadcrumbs",
  icon: "solar:folder-with-files-bold-duotone",

  schema: {
    content: {
      showBreadcrumb: true,
      showStockBadge: true,
    },
    style: {
      color: "#6b7280",
      typography: {
        fontSize: 14,
        fontSizeUnit: "px",
        fontWeight: "400",
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
      tab: "Layout",
      section: "Metadata Display",
      controls: [
        {
          name: "showBreadcrumb",
          responsive: false,
          render: (value: any, onChange: any, { schema, updateSchema }: any) => (
            <Section label="Display Options" defaultOpen>
              <Toggle label="Show Breadcrumb" value={value !== false} onChange={onChange} />
              <Toggle
                label="Show Stock Badge"
                value={schema.content.showStockBadge !== false}
                onChange={(v) => updateSchema("content", "showStockBadge", v)}
              />
            </Section>
          ),
        },
      ],
    },
    {
      tab: "Style",
      section: "Typography",
      controls: [
        {
          name: "color",
          responsive: false,
          render: (value: any, onChange: any) => (
            <ColorPickerPopup label="Text Color" value={value ?? "#6b7280"} onChange={onChange} />
          ),
        },
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
    const marginObj = element.schema.advanced?.margin || {};
    const paddingObj = element.schema.advanced?.padding || {};

    return (
      <div
        style={{
          boxSizing: "border-box",
          marginTop: `${marginObj.top ?? 0}px`,
          marginRight: `${marginObj.right ?? 0}px`,
          marginBottom: `${marginObj.bottom ?? 12}px`,
          marginLeft: `${marginObj.left ?? 0}px`,
          paddingTop: `${paddingObj.top ?? 0}px`,
          paddingRight: `${paddingObj.right ?? 0}px`,
          paddingBottom: `${paddingObj.bottom ?? 0}px`,
          paddingLeft: `${paddingObj.left ?? 0}px`,
        }}
      >
        <ProductMetaClient schema={element.schema} />
      </div>
    );
  },
};

export default productMetaElement;
