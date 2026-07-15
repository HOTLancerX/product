"use client";

import React from "react";
import { useProduct } from "../../product/ProductContext";
import Specification from "../../product/Specification";
import {
  Text,
  Select,
  Dimensions,
} from "@/components/builder/controls";

export function ProductSpecsClient({ schema }: { schema: any }) {
  const product = useProduct();

  const title = schema.content?.title || "Product Specifications";
  const specStyle = parseInt(String(schema.content?.style ?? 1), 10) || 1;

  // Mock specifications list for page builder editor preview
  const mockSpecs = [
    {
      title: "Dimensions & Weight",
      fields: [
        { title: "Width", description: "10 cm" },
        { title: "Height", description: "20 cm" },
        { title: "Weight", description: "500 grams" },
      ],
    },
    {
      title: "Materials",
      fields: [
        { title: "Material Type", description: "Premium Stainless Steel" },
        { title: "Finish", description: "Matte Black" },
      ],
    },
  ];

  const specs = product?.specifications ?? mockSpecs;

  return <Specification specifications={specs} title={title} style={specStyle} />;
}

const productSpecsElement = {
  type: "product-specs",
  category: "Product Details",
  label: "Product Specifications",
  icon: "solar:checklist-bold-duotone",

  schema: {
    content: {
      title: "Product Specifications",
      style: 1,
    },
    advanced: {
      margin: { top: 0, right: 0, bottom: 20, left: 0, unit: "px" },
      padding: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" },
    },
  },

  controls: [
    {
      tab: "Layout",
      section: "Title & Style",
      controls: [
        {
          name: "title",
          responsive: false,
          render: (value: any, onChange: any) => (
            <Text label="Widget Title" value={value} onChange={onChange} />
          ),
        },
        {
          name: "style",
          responsive: false,
          render: (value: any, onChange: any) => (
            <Select
              label="Layout Style"
              value={String(value ?? 1)}
              onChange={onChange}
              options={[
                { value: "1", label: "Accordions" },
                { value: "2", label: "Horizontal Tabs" },
                { value: "3", label: "Grid Cards" },
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
        <ProductSpecsClient schema={element.schema} />
      </div>
    );
  },
};

export default productSpecsElement;
