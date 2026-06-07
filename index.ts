import { addHook, addPostType, addCatType, type PluginMeta } from "@/hook";
import { Text, Textarea, Select, Switch, Tags, CategoryHierarchicalSelect } from "@/components/ui";
import ProductLayout1 from "./product/Layout1";
import ProductLayout2 from "./product/Layout2";
import ProductCategoryLayout1 from "./product-category/Layout1";
import ProductCategoryLayout2 from "./product-category/Layout2";
import Variate from "./variate/Variate";
import PostSpecification from "./variate/PostSpecification";

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
    // ─── Register post & category types ────────────────────────────────────
    addPostType([
        {
            key: "product",
            label: "Product",
            icon: "solar:cart-large-bold",
            color: "from-emerald-500 to-teal-600",
            position: 30,
        },
    ], PLUGINS.nx);

    addCatType([
        {
            key: "product-category",
            label: "Product Category",
            postType: "product",
            icon: "solar:folder-with-files-bold",
            color: "from-emerald-500 to-teal-600",
            position: 30,
        },
        {
            key: "brands",
            label: "Brands",
            postType: "product",
            icon: "solar:tag-bold",
            color: "from-orange-500 to-amber-600",
            position: 31,
        },
        {
            key: "attributes",
            label: "Attributes",
            postType: "product",
            icon: "solar:list-bold",
            color: "from-cyan-500 to-sky-600",
            position: 32,
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
        {
            key: "product-brands",
            label: "Brands",
            icon: "solar:tag-bold",
            slug: "category/brands",
            parent: "product",
            position: 4,
        },
        {
            key: "product-attributes",
            label: "Attributes",
            icon: "solar:list-bold",
            slug: "category/attributes",
            parent: "product",
            position: 5,
        },
    ], PLUGINS.nx);

    // ─── Product post form fields ───────────────────────────────────────────
    addHook("post.form", [
        {
            key: "_variate",
            label: "Pricing & Stock",
            type: "product",
            style: "left",
            position: 10,
            component: Variate,
        },
        {
            key: "_specifications",
            label: "Specifications",
            type: "product",
            style: "left",
            position: 20,
            component: PostSpecification,
        },
        {
            key: "category",
            label: "Category",
            type: "product",
            style: "right",
            position: 5,
            component: CategoryHierarchicalSelect,
            hierarchicalCatType: "product-category",
        },
        {
            key: "sku",
            label: "SKU",
            type: "product",
            style: "right",
            position: 30,
            component: Text,
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
        {
            key: "product_weight",
            label: "Weight (kg)",
            type: "product",
            style: "right",
            position: 60,
            component: Text,
        },
        {
            key: "product_dimensions",
            label: "Dimensions (L×W×H cm)",
            type: "product",
            style: "right",
            position: 70,
            component: Text,
        },
    ], PLUGINS.nx);

    // ─── Product Category cat form fields ───────────────────────────────────
    addHook("cat.form", [
        {
            key: "cat_image",
            label: "Category Image",
            type: "product-category",
            style: "right",
            position: 5,
            fieldType: "gallery",
        },
        {
            key: "cat_icon",
            label: "Category Icon",
            type: "product-category",
            style: "right",
            position: 6,
            component: Text,
        },
        {
            key: "cat_featured",
            label: "Featured Category",
            type: "product-category",
            style: "right",
            position: 10,
            component: Switch,
        },
        {
            key: "specifications",
            label: "Specifications",
            type: "product-category",
            style: "left",
            position: 200,
            fieldType: "specification",
        },
    ], PLUGINS.nx);

    // ─── Brands cat form fields ─────────────────────────────────────────────
    addHook("cat.form", [
        {
            key: "brand_logo",
            label: "Brand Logo URL",
            type: "brands",
            style: "right",
            position: 5,
            fieldType: "gallery",
        },
        {
            key: "brand_website",
            label: "Brand Website",
            type: "brands",
            style: "right",
            position: 10,
            component: Text,
        },
        {
            key: "brand_description",
            label: "Description",
            type: "brands",
            style: "left",
            position: 10,
            component: Textarea,
        },
        {
            key: "brand_featured",
            label: "Featured Brand",
            type: "brands",
            style: "right",
            position: 20,
            component: Switch,
        },
        {
            key: "brand_country",
            label: "Country of Origin",
            type: "brands",
            style: "right",
            position: 30,
            component: Text,
        },
    ], PLUGINS.nx);

    // ─── Attributes cat form fields ─────────────────────────────────────────
    addHook("cat.form", [
        {
            key: "linkedCategories",
            label: "Linked Categories",
            type: "attributes",
            style: "left",
            position: 5,
            fieldType: "linked-cats",
            linkedCatType: "product-category",
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
            active: true,
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
            active: true,
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
