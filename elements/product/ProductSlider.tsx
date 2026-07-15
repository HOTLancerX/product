"use client";

import React from "react";
import { useProduct } from "../../product/ProductContext";
import Slider from "../../product/Slider";
import { Dimensions } from "@/components/builder/controls";

export function ProductSliderClient({ schema }: { schema: any }) {
  const product = useProduct();

  // Fallback / Mock values if not loaded under context (e.g. inside builder editor)
  const mockGallery = [
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800",
    "https://images.unsplash.com/photo-1572635196237-14b3f281503f?q=80&w=800",
  ];

  const gallery = product?.gallery ?? mockGallery;
  const title = product?.data?.title ?? "Product Image";

  return <Slider gallery={gallery} alt={title} />;
}

const productSliderElement = {
  type: "product-slider",
  category: "Product Details",
  label: "Product Image Slider",
  icon: "solar:gallery-wide-bold-duotone",

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
        <ProductSliderClient schema={element.schema} />
      </div>
    );
  },
};

export default productSliderElement;
