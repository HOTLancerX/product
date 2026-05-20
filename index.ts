import { addHook, addPostType, addCatType, type PluginMeta } from "@/hook";
import { Text, Select, Switch } from "@/components/ui";
import ProductLayout1 from "./product/Layout1";
import ProductLayout2 from "./product/Layout2";
import ProductCategoryLayout1 from "./product-category/Layout1";
import ProductCategoryLayout2 from "./product-category/Layout2";

// ─── Plugin metadata ───────────────────────────────────────────────────────────
export const PLUGINS: PluginMeta = {
    nx: "com.system.product",
    name: "product",
    version: "1.0.0",
    description: "E-commerce product post type with price, SKU, and stock fields.",
    author: "System",
    path: "https://github.com/HOTLancerX/product.git",
    icon: "solar:cart-large-bold",
    color: "from-emerald-500 to-teal-600",
};

/**
 * Register all hooks for this plugin.
 * Called by PluginList.reregisterHooks() after the gate is armed.
 */
export function register() {
    // ─── Register the "product" post type ──────────────────────────────────
    addPostType([
        {
            key: "product",
            label: "Product",
            icon: "solar:cart-large-bold",
            color: "from-emerald-500 to-teal-600",
            position: 30,
        },
    ], PLUGINS.nx);

    // ─── Register the "product-category" category type ──────────────────────
    addCatType([
        {
            key: "product-category",
            label: "Product Category",
            postType: "product",
            icon: "solar:folder-with-files-bold",
            color: "from-emerald-500 to-teal-600",
            position: 30,
        },
    ], PLUGINS.nx);

    // ─── Admin nav items ────────────────────────────────────────────────────
    addHook("admin.nav", [
        // ── Product top-level parent ──
        {
            key: "product",
            label: "Product",
            icon: "solar:cart-large-bold",
            slug: "posts/product",
            parent: "",
            position: 13,
        },
        {
            key: "product-add",
            label: "Add Product",
            icon: "solar:add-circle-bold",
            slug: "posts/product/new",
            parent: "product",
            position: 2,
        },
        {
            key: "product-category",
            label: "Categories",
            icon: "solar:folder-with-files-bold",
            slug: "category/product-category",
            parent: "product",
            position: 3,
        },
    ], PLUGINS.nx);

    // ─── Product-specific form fields ───────────────────────────────────────
    addHook("post.form", [
        {
            key: "product_price",
            label: "Price",
            type: "product",
            style: "right",
            position: 10,
            component: Text,
        },
        {
            key: "product_sku",
            label: "SKU",
            type: "product",
            style: "right",
            position: 20,
            component: Text,
        },
        {
            key: "product_stock",
            label: "Stock Quantity",
            type: "product",
            style: "right",
            position: 30,
            component: Text,
        },
        {
            key: "product_in_stock",
            label: "In Stock",
            type: "product",
            style: "right",
            position: 40,
            component: Switch,
        },
        {
            key: "product_condition",
            label: "Condition",
            type: "product",
            style: "right",
            position: 50,
            component: Select,
            options: [
                { label: "New", value: "new" },
                { label: "Used", value: "used" },
                { label: "Refurbished", value: "refurbished" },
            ],
        },
    ], PLUGINS.nx);

    // ─── Product page templates ─────────────────────────────────────────────
    addHook("root.pages", [
        {
            key: "product",
            label: "Product Layout 1",
            type: "product",
            slug: "dynamic",
            style: "left",
            position: 10,
            active: true,           // first-boot default
            component: ProductLayout1,
        },
        {
            key: "product",
            label: "Product Layout 2",
            type: "product",
            slug: "dynamic",
            style: "left",
            position: 20,
            active: false,
            component: ProductLayout2,
        },
    ], PLUGINS.nx);

    // ─── Product category page templates ───────────────────────────────────
    addHook("root.pages", [
        {
            key: "product-category",
            label: "Product Category Layout 1",
            type: "product-category",
            slug: "dynamic",
            style: "left",
            position: 10,
            active: true,           // first-boot default
            component: ProductCategoryLayout1,
        },
        {
            key: "product-category",
            label: "Product Category Layout 2",
            type: "product-category",
            slug: "dynamic",
            style: "left",
            position: 20,
            active: false,
            component: ProductCategoryLayout2,
        },
    ], PLUGINS.nx);
}
