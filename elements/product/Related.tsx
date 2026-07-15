"use client";

import React from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useProduct } from "../../product/ProductContext";
import {
  Select,
  Dimensions,
  NumberControl,
} from "@/components/builder/controls";

// Dynamic client wrapper to handle Embla carousel initialization
export function ProductRelatedClient({
  schema,
  products = [],
  BoxComponent,
  productPrefix = "product",
}: {
  schema: any;
  products?: any[];
  BoxComponent?: React.ComponentType<any> | null;
  productPrefix?: string;
}) {
  const productContext = useProduct();

  const limit = schema.content?.limit ?? 4;
  const viewType = schema.content?.viewType || "grid";
  const dCols = schema.content?.desktopCols ?? 4;
  const tCols = schema.content?.tabletCols ?? 3;
  const mCols = schema.content?.mobileCols ?? 1;

  // Embla slider hook
  const [emblaRef] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragFree: true,
  });

  // Mock list for page builder editor preview
  const mockProducts = Array.from({ length: limit }, (_, i) => ({
    id: `mock-p-${i}`,
    title: `Mock Product Title ${i + 1}`,
    slug: `mock-product-${i + 1}`,
    info: {
      images: JSON.stringify(["https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400"]),
      _variate: JSON.stringify({
        priceType: "single",
        regularprice: "150",
        sellingprice: "120",
        stock: "50",
      }),
    },
  }));

  const isLoaded = products.length > 0;
  const items = isLoaded ? products : mockProducts;

  // Fallback layout when custom ProductBox component is not supplied (e.g. in editor)
  const renderFallbackCard = (item: any) => {
    let price = "$120.00";
    try {
      const variate = JSON.parse(item.info?._variate || "{}");
      const sell = parseFloat(variate.sellingprice) || 0;
      const reg = parseFloat(variate.regularprice) || 0;
      price = sell > 0 ? `$${sell.toFixed(2)}` : `$${reg.toFixed(2)}`;
    } catch {}

    const img = item.info?.images ? JSON.parse(item.info.images)[0] : "";

    return (
      <div className="bg-white border rounded-xl overflow-hidden shadow-xs hover:shadow-md transition p-3 flex flex-col h-full">
        <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden relative mb-3">
          <img src={img || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400"} alt={item.title} className="w-full h-full object-cover" />
        </div>
        <h4 className="font-semibold text-sm text-gray-800 line-clamp-2 min-h-[40px]">{item.title}</h4>
        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className="font-bold text-emerald-600">{price}</span>
        </div>
      </div>
    );
  };

  const buildUrl = (prefix: string, slug: string) => {
    const cleanPrefix = (prefix || "").trim().replace(/^\/+|\/+$/g, "");
    return cleanPrefix ? `/${cleanPrefix}/${slug}` : `/${slug}`;
  };

  const renderItem = (item: any) => {
    if (BoxComponent) {
      return (
        <BoxComponent
          data={{
            _id: item.id || item._id,
            title: item.title,
            slug: item.slug,
            info: item.info,
          }}
          productUrl={buildUrl(productPrefix, item.slug)}
        />
      );
    }
    return renderFallbackCard(item);
  };

  if (viewType === "slider") {
    return (
      <div className="w-full relative overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4">
          {items.map((item) => (
            <div
              key={item.id || item._id}
              className="shrink-0"
              style={{
                width: `calc((100% - (${mCols - 1} * 16px)) / ${mCols})`,
                // Responsiveness style properties mapped via css variables or media queries
              }}
            >
              {renderItem(item)}
            </div>
          ))}
        </div>
        <style jsx>{`
          @media (min-width: 640px) {
            .shrink-0 {
              width: calc((100% - (${tCols - 1} * 16px)) / ${tCols}) !important;
            }
          }
          @media (min-width: 1024px) {
            .shrink-0 {
              width: calc((100% - (${dCols - 1} * 16px)) / ${dCols}) !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // Grid layout mode
  return (
    <div className={`grid gap-5`} style={{ display: "grid", gap: "20px" }}>
      {items.map((item) => (
        <div key={item.id || item._id}>{renderItem(item)}</div>
      ))}
      <style jsx>{`
        div {
          grid-template-columns: repeat(${mCols}, minmax(0, 1fr));
        }
        @media (min-width: 640px) {
          div {
            grid-template-columns: repeat(${tCols}, minmax(0, 1fr)) !important;
          }
        }
        @media (min-width: 1024px) {
          div {
            grid-template-columns: repeat(${dCols}, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  );
}

const productRelatedElement = {
  type: "product-related",
  category: "Product Details",
  label: "Related Category Products",
  icon: "solar:shop-bold-duotone",

  schema: {
    content: {
      limit: 4,
      viewType: "grid", // "grid" | "slider"
      desktopCols: 4,
      tabletCols: 3,
      mobileCols: 1,
    },
    advanced: {
      margin: { top: 0, right: 0, bottom: 24, left: 0, unit: "px" },
      padding: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" },
    },
  },

  controls: [
    {
      tab: "Layout",
      section: "Query Limits",
      controls: [
        {
          name: "limit",
          responsive: false,
          render: (value: any, onChange: any) => (
            <NumberControl label="Max Products Limit" value={value ?? 4} onChange={onChange} min={1} max={12} />
          ),
        },
        {
          name: "viewType",
          responsive: false,
          render: (value: any, onChange: any) => (
            <Select
              label="Layout Mode"
              value={value || "grid"}
              onChange={onChange}
              options={[
                { value: "grid", label: "Responsive Grid" },
                { value: "slider", label: "Embla Touch Slider" },
              ]}
            />
          ),
        },
      ],
    },
    {
      tab: "Layout",
      section: "Columns Configuration",
      controls: [
        {
          name: "desktopCols",
          responsive: false,
          render: (value: any, onChange: any) => (
            <Select
              label="Desktop Columns"
              value={String(value ?? 4)}
              onChange={(v) => onChange(parseInt(v) || 4)}
              options={[
                { value: "1", label: "1 Column" },
                { value: "2", label: "2 Columns" },
                { value: "3", label: "3 Columns" },
                { value: "4", label: "4 Columns" },
                { value: "5", label: "5 Columns" },
                { value: "6", label: "6 Columns" },
              ]}
            />
          ),
        },
        {
          name: "tabletCols",
          responsive: false,
          render: (value: any, onChange: any) => (
            <Select
              label="Tablet Columns"
              value={String(value ?? 3)}
              onChange={(v) => onChange(parseInt(v) || 3)}
              options={[
                { value: "1", label: "1 Column" },
                { value: "2", label: "2 Columns" },
                { value: "3", label: "3 Columns" },
                { value: "4", label: "4 Columns" },
              ]}
            />
          ),
        },
        {
          name: "mobileCols",
          responsive: false,
          render: (value: any, onChange: any) => (
            <Select
              label="Mobile Columns"
              value={String(value ?? 1)}
              onChange={(v) => onChange(parseInt(v) || 1)}
              options={[
                { value: "1", label: "1 Column" },
                { value: "2", label: "2 Columns" },
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
        className="font-sans w-full"
        style={{
          boxSizing: "border-box",
          marginTop: `${marginObj.top ?? 0}px`,
          marginRight: `${marginObj.right ?? 0}px`,
          marginBottom: `${marginObj.bottom ?? 24}px`,
          marginLeft: `${marginObj.left ?? 0}px`,
          paddingTop: `${paddingObj.top ?? 0}px`,
          paddingRight: `${paddingObj.right ?? 0}px`,
          paddingBottom: `${paddingObj.bottom ?? 0}px`,
          paddingLeft: `${paddingObj.left ?? 0}px`,
        }}
      >
        <h3 className="text-lg font-bold mb-4 text-gray-800">Related Products</h3>
        <ProductRelatedClient schema={element.schema} />
      </div>
    );
  },
};

export default productRelatedElement;
