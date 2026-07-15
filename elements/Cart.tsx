"use client";

import React from "react";
import CartExtended, { CartDisplayType } from "./CartExtended";
import {
  Select,
  ColorPickerPopup,
  Dimensions,
  Section,
  NumberControl,
  IconPicker,
} from "@/components/builder/controls";

function getDimensionsStyles(obj: any, property: "margin" | "padding") {
  if (!obj || typeof obj !== "object") return {};
  const u = obj.unit || "px";
  if (u === "auto") return { [property]: "auto" };
  const t = obj.top === "" || obj.top === undefined ? 0 : obj.top;
  const r = obj.right === "" || obj.right === undefined ? 0 : obj.right;
  const b = obj.bottom === "" || obj.bottom === undefined ? 0 : obj.bottom;
  const l = obj.left === "" || obj.left === undefined ? 0 : obj.left;
  if (t === 0 && r === 0 && b === 0 && l === 0) return {};
  return { [property]: `${t}${u} ${r}${u} ${b}${u} ${l}${u}` };
}

function CartFrontend({ element }: { element: any }) {
  const s = element.schema;
  const displayType = (s.content?.displayType || "drawer-right") as CartDisplayType;
  const fontSize = s.style?.fontSize || 20;
  const color = s.style?.color || "#374151";
  const icon = s.content?.icon || "mdi:cart-outline";

  const marginStyle = getDimensionsStyles(s.advanced?.margin, "margin");
  const paddingStyle = getDimensionsStyles(s.advanced?.padding, "padding");

  return (
    <div
      style={{
        display: "inline-block",
        boxSizing: "border-box",
        ...marginStyle,
        ...paddingStyle,
      }}
    >
      <CartExtended displayType={displayType} fontSize={fontSize} color={color} icon={icon} />
    </div>
  );
}

const cartElement = {
  type: "cart",
  category: "E-Commerce",
  label: "Shopping Cart",
  icon: "solar:cart-large-linear",

  schema: {
    content: {
      displayType: "drawer-right",
      icon: "mdi:cart-outline",
    },
    style: {
      fontSize: 20,
      color: "#374151",
    },
    advanced: {
      margin: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" },
      padding: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" },
    },
  },

  controls: [
    {
      tab: "Layout",
      section: "Settings",
      controls: [
        {
          name: "displayType",
          responsive: false,
          render: (value: any, onChange: any) => (
            <Section label="Cart Panel Display Mode" defaultOpen>
              <Select
                label="Layout Mode"
                value={value || "drawer-right"}
                onChange={onChange}
                options={[
                  { value: "drawer-right", label: "Drawer (Right Side)" },
                  { value: "drawer-left", label: "Drawer (Left Side)" },
                  { value: "dropdown", label: "Dropdown Panel (Mini Cart)" },
                ]}
              />
            </Section>
          ),
        },
        {
          name: "icon",
          responsive: false,
          render: (value: any, onChange: any) => (
            <Section label="Icon Selection">
              <IconPicker label="Cart Icon" value={value || "mdi:cart-outline"} onChange={onChange} />
            </Section>
          ),
        },
      ],
    },
    {
      tab: "Style",
      section: "Icon Style",
      controls: [
        {
          name: "color",
          responsive: false,
          render: (value: any, onChange: any) => (
            <ColorPickerPopup label="Icon Color" value={value || "#374151"} onChange={onChange} />
          ),
        },
        {
          name: "fontSize",
          responsive: false,
          render: (value: any, onChange: any) => (
            <NumberControl
              label="Icon Size (px)"
              value={value ?? 20}
              onChange={onChange}
              min={12}
              max={64}
              step={1}
            />
          ),
        },
      ],
    },
    {
      tab: "Advanced",
      section: "Spacing Bounds",
      controls: [
        {
          name: "margin",
          responsive: true,
          render: (value: any, onChange: any) => (
            <Dimensions type="margin" value={value} onChange={onChange} />
          ),
        },
        {
          name: "padding",
          responsive: true,
          render: (value: any, onChange: any) => (
            <Dimensions type="padding" value={value} onChange={onChange} />
          ),
        },
      ],
    },
  ],

  render: (element: any) => <CartFrontend element={element} />,
};

export default cartElement;
