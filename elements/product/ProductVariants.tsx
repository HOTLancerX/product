"use client";

import React from "react";
import { useProduct } from "../../product/ProductContext";
import Variant from "../../product/Variant";
import { Dimensions } from "@/components/builder/controls";

export function ProductVariantsClient({ schema }: { schema: any }) {
  const product = useProduct();

  // Mock attributes fallback for page builder editor preview
  const mockAttributes = [
    {
      label: "Color",
      values: ["Red", "Blue", "Black"],
      displayStyle: "color-text",
    },
    {
      label: "Size",
      values: ["S", "M", "L"],
      displayStyle: "text",
    },
  ];

  const mockInfo = {
    variants: [
      { id: "1", options: { Color: "Red", Size: "S" }, price: "120", color: "#ef4444" },
      { id: "2", options: { Color: "Blue", Size: "M" }, price: "120", color: "#3b82f6" },
      { id: "3", options: { Color: "Black", Size: "L" }, price: "120", color: "#000000" },
    ],
  };

  const isLoaded = !!product;

  // Build the `info` object the Variant component expects:
  // it reads info.variants as an array.  The context already parses _variate
  // into product.variants, so we reconstruct the shape here.
  const info = isLoaded
    ? { variants: product.variants, selectedAttributes: product.attributes }
    : mockInfo;

  const attributes = isLoaded ? product.attributes : mockAttributes;
  const selectedOptions = isLoaded ? product.selectedOptions : { Color: "Red", Size: "S" };
  const selectedVariant = isLoaded ? product.selectedVariant : mockInfo.variants[0];
  const onOptionSelect = isLoaded ? product.handleOptionSelect : () => {};
  const curSymbol = isLoaded ? product.currencySymbol : "$";

  if (!isLoaded && !attributes.length) return null;

  return (
    <Variant
      info={info}
      attributes={attributes}
      selectedOptions={selectedOptions}
      selectedVariant={selectedVariant}
      onOptionSelect={onOptionSelect}
      currencySymbol={curSymbol}
    />
  );
}

const productVariantsElement = {
  type: "product-variants",
  category: "Product Details",
  label: "Product Variants / Options",
  icon: "solar:widget-3-bold-duotone",

  schema: {
    advanced: {
      margin: { top: 0, right: 0, bottom: 20, left: 0, unit: "px" },
      padding: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" },
    },
  },

  controls: [
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
        <ProductVariantsClient schema={element.schema} />
      </div>
    );
  },
};

export default productVariantsElement;
