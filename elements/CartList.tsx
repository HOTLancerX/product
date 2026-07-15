"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { getCart, updateCartItemQuantity, removeFromCart, clearCart, CartItem } from "../lib/cart";
import useSettings from "@/lib/useSettings";
import {
  Dimensions,
  Section,
  NumberControl,
  Toggle,
  ColorPickerPopup,
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

function formatPrice(amount: number, currencySymbol: string) {
  const formatted = Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return currencySymbol ? `${currencySymbol} ${formatted}` : formatted;
}

export function CartListFrontend({ element }: { element: any }) {
  const s = element.schema;
  const [mounted, setMounted] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const { settings } = useSettings();
  const currencySymbol = (settings?.product_currency_symbol || settings?.currency_symbol || "Rp.") as string;

  const updateCartState = () => {
    setCart(getCart());
  };

  useEffect(() => {
    setMounted(true);
    updateCartState();
    window.addEventListener("cartUpdated", updateCartState);
    return () => window.removeEventListener("cartUpdated", updateCartState);
  }, []);

  const handleQuantityChange = (productId: string, variantId: string | undefined, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId, variantId);
    } else {
      updateCartItemQuantity(productId, variantId, newQty);
    }
    updateCartState();
  };

  const handleClearCart = () => {
    if (confirm("Are you sure you want to clear your cart?")) {
      clearCart();
      updateCartState();
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const marginStyle = getDimensionsStyles(s.advanced?.margin, "margin");
  const paddingStyle = getDimensionsStyles(s.advanced?.padding, "padding");

  if (!mounted) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        Loading shopping cart...
      </div>
    );
  }

  const outerBg = s.style?.outerBg ?? "#ffffff";
  const itemBg = s.style?.itemBg ?? "#ebf1f5";
  const outerPadding = s.style?.outerPadding ?? 24;
  const itemPadding = s.style?.itemPadding ?? 14;
  const iconPadding = s.style?.iconPadding ?? 8;
  const itemGap = s.style?.itemGap ?? 12;
  const fullHeight = s.style?.fullHeight ?? false;
  const cartIcon = s.style?.cartIcon ?? "mdi:cart-outline";
  const trashIcon = s.style?.trashIcon ?? "solar:trash-bin-trash-bold-duotone";

  return (
    <div
      className="w-full max-w-lg mx-auto border border-gray-150 rounded-[32px] shadow-sm flex flex-col font-sans relative"
      style={{
        boxSizing: "border-box",
        backgroundColor: outerBg,
        padding: `${outerPadding}px`,
        height: fullHeight ? "100%" : "auto",
        ...marginStyle,
        ...paddingStyle,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div
          className="relative rounded-full"
          style={{ padding: `${iconPadding}px` }}
        >
          <Icon icon={cartIcon} className="text-gray-800" width={26} height={26} />
          {totalItems > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-[#00bcd4] text-white text-[10px] font-bold rounded-full w-5.5 h-5.5 flex items-center justify-center leading-none">
              {totalItems}
            </span>
          )}
        </div>
        <button
          onClick={handleClearCart}
          disabled={cart.length === 0}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-50 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Clear all cart items"
        >
          <Icon icon={trashIcon} width={24} height={24} />
        </button>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto min-h-[250px] pr-1">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-55 flex items-center justify-center mb-3">
              <Icon icon={cartIcon} width={30} height={30} />
            </div>
            <p className="text-sm font-semibold text-gray-500">Your cart is empty</p>
          </div>
        ) : (
          cart.map((item) => {
            const itemKey = `${item.productId}-${item.variantId || "single"}`;
            return (
              <div
                key={itemKey}
                className="flex items-center justify-between transition duration-200"
                style={{
                  backgroundColor: itemBg,
                  padding: `${itemPadding}px`,
                  borderRadius: "20px",
                  marginBottom: `${itemGap}px`
                }}
              >
                {/* Desktop Version */}
                <div className="hidden md:flex items-center gap-3.5 flex-1 min-w-0">
                  {/* Photo Image box */}
                  <div
                    onClick={() => item.productImage && setLightboxImage(item.productImage)}
                    className="relative w-14 h-14 bg-white rounded-xl overflow-hidden border border-white/60 shadow-sm shrink-0 cursor-pointer hover:opacity-90 transition"
                  >
                    {item.productImage ? (
                      <Image
                        src={item.productImage}
                        alt={item.productTitle}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <Icon icon="mdi:image-off" className="text-gray-400" width={20} />
                      </div>
                    )}
                  </div>

                  {/* Title & Price */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[14px] font-bold text-[#3a4d5b] truncate leading-snug">
                      {item.productTitle}
                    </h4>
                    <p className="text-[12px] font-medium text-gray-500 mt-0.5">
                      {formatPrice(item.price, currencySymbol)}
                    </p>
                  </div>
                </div>

                {/* Mobile Version layout */}
                <div className="flex md:hidden flex-col gap-2 flex-1 min-w-0 relative">
                  <div className="flex gap-3 items-center">
                    {/* Photo Box with Overlay details */}
                    <div className="relative w-20 h-20 bg-white rounded-xl overflow-hidden border border-white/60 shadow-sm shrink-0">
                      {item.productImage ? (
                        <Image
                          src={item.productImage}
                          alt={item.productTitle}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <Icon icon="mdi:image-off" className="text-gray-400" width={20} />
                        </div>
                      )}
                      {/* Fixed position price overlay inside the photo */}
                      <span className="absolute top-1 left-1 bg-black/70 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded leading-none">
                        {formatPrice(item.price, currencySymbol)}
                      </span>
                      {/* Fixed position quantity stepper overlay inside the photo */}
                      <div className="absolute bottom-1 right-1 flex items-center gap-0.5 bg-black/70 backdrop-blur-xs rounded-md p-0.5 scale-75 origin-bottom-right">
                        <button
                          onClick={() => handleQuantityChange(item.productId, item.variantId, item.quantity - 1)}
                          className="w-5 h-5 rounded bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
                          aria-label="Decrease quantity"
                        >
                          <Icon icon="mdi:minus" width={9} height={9} />
                        </button>
                        <span className="w-4 text-center text-[10px] font-bold text-white leading-none">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(item.productId, item.variantId, item.quantity + 1)}
                          disabled={item.quantity >= item.maxQuantity}
                          className="w-5 h-5 rounded bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition disabled:opacity-30 disabled:hover:bg-white/20"
                          aria-label="Increase quantity"
                        >
                          <Icon icon="mdi:plus" width={9} height={9} />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-bold text-[#3a4d5b] leading-tight truncate">
                        {item.productTitle}
                      </h4>
                      {/* write a price content action */}
                      <button
                        onClick={() => item.productImage && setLightboxImage(item.productImage)}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 underline font-semibold mt-1 block text-left"
                      >
                        write a price
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stepper controls (Desktop only) */}
                <div className="hidden md:flex items-center gap-1.5 shrink-0 ml-3">
                  <button
                    onClick={() => handleQuantityChange(item.productId, item.variantId, item.quantity - 1)}
                    className="w-8 h-8 rounded-lg bg-[#4c6371] hover:bg-[#3d505c] text-white flex items-center justify-center transition shadow-sm"
                    aria-label="Decrease quantity"
                  >
                    <Icon icon="mdi:minus" width={14} height={14} />
                  </button>
                  <div className="w-9 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center shadow-inner">
                    <span className="text-[13px] font-bold text-[#3a4d5b]">{item.quantity}</span>
                  </div>
                  <button
                    onClick={() => handleQuantityChange(item.productId, item.variantId, item.quantity + 1)}
                    disabled={item.quantity >= item.maxQuantity}
                    className="w-8 h-8 rounded-lg bg-[#4c6371] hover:bg-[#3d505c] text-white flex items-center justify-center transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Increase quantity"
                  >
                    <Icon icon="mdi:plus" width={14} height={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Total & Submit */}
      <div className="border-t border-gray-150 pt-5 mt-4 shrink-0">
        <div className="flex justify-between items-center text-sm font-bold text-[#3a4d5b] mb-4 px-1">
          <span className="tracking-wider uppercase text-[13px] text-gray-500">TOTAL</span>
          <span className="text-[18px] text-[#3a4d5b]">
            {formatPrice(subtotal, currencySymbol)}
          </span>
        </div>
        <button
          disabled={cart.length === 0}
          className="w-full h-13 rounded-2xl bg-[#b0bdc6] hover:bg-[#9eb0bc] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm uppercase tracking-wider transition shadow-sm flex items-center justify-center"
        >
          SUBMIT
        </button>
      </div>

      {/* Full HD Lightbox / Modal Overlay */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-99999 flex items-center justify-center anim-fade-in p-4">
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
            aria-label="Close Full HD preview"
          >
            <Icon icon="mdi:close" width={24} height={24} />
          </button>
          <div className="relative max-w-4xl max-h-[80vh] w-full h-full flex items-center justify-center">
            <Image
              src={lightboxImage}
              alt="Full HD product image"
              fill
              className="object-contain rounded-lg"
              sizes="100vw"
              priority
            />
          </div>
        </div>
      )}

      {/* Embedded Animations CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .anim-fade-in { animation: fadeIn 0.25s ease-out forwards; }
      `}} />
    </div>
  );
}

const cartListElement = {
  type: "cart-list",
  category: "E-Commerce",
  label: "Cart Items List",
  icon: "solar:list-down-linear",

  schema: {
    style: {
      outerBg: "#ffffff",
      itemBg: "#ebf1f5",
      outerPadding: 24,
      itemPadding: 14,
      iconPadding: 8,
      itemGap: 12,
      fullHeight: false,
      cartIcon: "mdi:cart-outline",
      trashIcon: "solar:trash-bin-trash-bold-duotone",
    },
    advanced: {
      margin: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" },
      padding: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" },
    },
  },

  controls: [
    {
      tab: "Style",
      section: "Colours",
      controls: [
        {
          name: "outerBg",
          responsive: false,
          render: (value: any, onChange: any) => (
            <ColorPickerPopup label="Box Background Color" value={value ?? "#ffffff"} onChange={onChange} />
          ),
        },
        {
          name: "itemBg",
          responsive: false,
          render: (value: any, onChange: any) => (
            <ColorPickerPopup label="Product Card Background" value={value ?? "#ebf1f5"} onChange={onChange} />
          ),
        },
      ],
    },
    {
      tab: "Style",
      section: "Custom Sizing & Spacing",
      controls: [
        {
          name: "outerPadding",
          responsive: false,
          render: (value: any, onChange: any) => (
            <NumberControl
              label="Box Padding spacing (px)"
              value={value ?? 24}
              onChange={onChange}
              min={0}
              max={64}
              step={1}
            />
          ),
        },
        {
          name: "itemPadding",
          responsive: false,
          render: (value: any, onChange: any) => (
            <NumberControl
              label="Card Padding spacing (px)"
              value={value ?? 14}
              onChange={onChange}
              min={0}
              max={48}
              step={1}
            />
          ),
        },
        {
          name: "itemGap",
          responsive: false,
          render: (value: any, onChange: any) => (
            <NumberControl
              label="Item Margin Gap spacing (px)"
              value={value ?? 12}
              onChange={onChange}
              min={0}
              max={40}
              step={1}
            />
          ),
        },
        {
          name: "iconPadding",
          responsive: false,
          render: (value: any, onChange: any) => (
            <NumberControl
              label="Icon Padding spacing (px)"
              value={value ?? 8}
              onChange={onChange}
              min={0}
              max={32}
              step={1}
            />
          ),
        },
        {
          name: "fullHeight",
          responsive: false,
          render: (value: any, onChange: any) => (
            <Toggle
              label="Use Full Height (100%)"
              value={value ?? false}
              onChange={onChange}
            />
          ),
        },
      ],
    },
    {
      tab: "Style",
      section: "Icons Configuration",
      controls: [
        {
          name: "cartIcon",
          responsive: false,
          render: (value: any, onChange: any) => (
            <Section label="Header Cart Icon">
              <IconPicker label="Cart Icon" value={value || "mdi:cart-outline"} onChange={onChange} />
            </Section>
          ),
        },
        {
          name: "trashIcon",
          responsive: false,
          render: (value: any, onChange: any) => (
            <Section label="Clear Cart Trash Icon">
              <IconPicker label="Clear Icon" value={value || "solar:trash-bin-trash-bold-duotone"} onChange={onChange} />
            </Section>
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

  render: (element: any) => <CartListFrontend element={element} />,
};

export default cartListElement;
