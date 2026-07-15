"use client";

import React from "react";
import { useProduct } from "../../product/ProductContext";
import {
  ColorPickerPopup,
  Dimensions,
  Typography,
  ButtonGroup,
  Select,
} from "@/components/builder/controls";

export function ProductDescriptionClient({ schema }: { schema: any }) {
  const product = useProduct();

  const type = schema.content?.type || "htmlDescription";
  const color = schema.style?.color ?? "#374151";
  const align = schema.style?.textAlign ?? "left";

  const fontSize = schema.style?.typography?.fontSize ?? 16;
  const fontWeight = schema.style?.typography?.fontWeight ?? "400";
  const lineHeight = schema.style?.typography?.lineHeight ?? 26;

  // Fallback mockup
  const mockContent = "This is a preview of the product description content block. It dynamically resolves to the short description, summary, or detailed HTML product information body depending on your configuration options.";

  let content = mockContent;
  if (product) {
    if (type === "shortDescription") content = product.shortDescription;
    else if (type === "description") content = product.description;
    else if (type === "htmlDescription") content = product.htmlDescription || product.description;
  }

  if (type === "htmlDescription" && product) {
    return (
      <div
        style={{
          color,
          textAlign: align as any,
          fontSize: `${fontSize}px`,
          fontWeight,
          lineHeight: `${lineHeight}px`,
          boxSizing: "border-box",
        }}
        dangerouslySetInnerHTML={{ __html: content || "No description available." }}
      />
    );
  }

  return (
    <div
      style={{
        color,
        textAlign: align as any,
        fontSize: `${fontSize}px`,
        fontWeight,
        lineHeight: `${lineHeight}px`,
        boxSizing: "border-box",
      }}
    >
      {content || "No description available."}
    </div>
  );
}

const productDescriptionElement = {
  type: "product-description",
  category: "Product Details",
  label: "Product Description",
  icon: "solar:notes-bold-duotone",

  schema: {
    content: {
      type: "htmlDescription",
    },
    style: {
      color: "#374151",
      typography: {
        fontSize: 16,
        fontSizeUnit: "px",
        fontWeight: "400",
        lineHeight: 26,
        lineHeightUnit: "px",
      },
      textAlign: "left",
    },
    advanced: {
      margin: { top: 0, right: 0, bottom: 20, left: 0, unit: "px" },
      padding: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" },
    },
  },

  controls: [
    {
      tab: "Layout",
      section: "Content Type",
      controls: [
        {
          name: "type",
          responsive: false,
          render: (value: any, onChange: any) => (
            <Select
              label="Field Source"
              value={value ?? "htmlDescription"}
              onChange={onChange}
              options={[
                { value: "shortDescription", label: "Short Description" },
                { value: "description", label: "Description Text" },
                { value: "htmlDescription", label: "HTML Body Content" },
              ]}
            />
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
            <ColorPickerPopup label="Text Color" value={value ?? "#374151"} onChange={onChange} />
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
          marginBottom: `${marginObj.bottom ?? 20}px`,
          marginLeft: `${marginObj.left ?? 0}px`,
          paddingTop: `${paddingObj.top ?? 0}px`,
          paddingRight: `${paddingObj.right ?? 0}px`,
          paddingBottom: `${paddingObj.bottom ?? 0}px`,
          paddingLeft: `${paddingObj.left ?? 0}px`,
        }}
      >
        <ProductDescriptionClient schema={element.schema} />
      </div>
    );
  },
};

export default productDescriptionElement;
