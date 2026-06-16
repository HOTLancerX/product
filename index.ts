import { addHook, addPostType, addCatType, type PluginMeta } from "@/hook";
import { Text, Textarea, Select, Switch, Tags, CategoryHierarchicalSelect } from "@/components/ui";
import ProductLayout1 from "./product/Layout1";
import ProductLayout2 from "./product/Layout2";
import ProductCategoryLayout1 from "./product-category/Layout1";
import ProductCategoryLayout2 from "./product-category/Layout2";
import Variate from "./variate/Variate";
import PostSpecification from "./variate/PostSpecification";
import ProductSettingsPage from "./settings/ProductSettingsPage";
import ProductBox1 from "./box/Product-1";
import ProductBox2 from "./box/Product-2";
// NOTE: lib/category.ts is NOT imported here — it imports Mongoose models
// and would pollute the client bundle via the plugin registry chain.
// Instead, we register a lazy wrapper below that only resolves the import
// at call time (server-side only, inside an async function).

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
        {
            key: "shortDescription",
            label: "Short Description",
            type: "product",
            style: "left",
            position: 5,
            component: Textarea,
        },
        {
            key: "orderNote",
            label: "Order Note Label (leave blank to hide)",
            type: "product",
            style: "right",
            position: 75,
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

    // ─── Product box templates (reusable card components) ──────────────────
    // type: "product-box" — shown in the Template manager and used by
    // category/listing pages to render individual product cards.
    addHook("root.pages", [
        {
            key: "product-box",
            label: "Product Box 1",
            type: "product-box",
            slug: "dynamic",
            style: "left",
            position: 10,
            active: true,
            component: ProductBox1,
        },
        {
            key: "product-box",
            label: "Product Box 2",
            type: "product-box",
            slug: "dynamic",
            style: "left",
            position: 20,
            active: false,
            component: ProductBox2,
        },
    ], PLUGINS.nx);

    // ─── Product admin nav: settings link ──────────────────────────────────
    addHook("admin.nav", [
        {
            key: "product-settings",
            label: "Product Settings",
            icon: "solar:settings-bold",
            slug: "product/settings",
            parent: "product",
            position: 99,
        },
    ], PLUGINS.nx);

    // ─── Product dedicated settings page ───────────────────────────────────
    // URL: /admin/product/settings
    // Completely isolated — only fields with type "product-settings" appear.
    addHook("admin.pages", [
        {
            key: "product/settings",
            label: "Product Settings",
            type: "product-settings",
            style: "left",
            position: 10,
            path: ProductSettingsPage,
        },
    ], PLUGINS.nx);

    // ─── Product settings form fields ───────────────────────────────────────
    // type: "product-settings" → shown only on the product settings page.
    addHook("setting.form", [
        {
            key: "product_currency",
            label: "Currency",
            type: "product-settings",
            style: "left",
            position: 10,
            component: Text,
        },
        {
            key: "product_currency_symbol",
            label: "Currency Symbol",
            type: "product-settings",
            style: "left",
            position: 20,
            component: Text,
        },
        {
            key: "product_tax_rate",
            label: "Tax Rate (%)",
            type: "product-settings",
            style: "left",
            position: 30,
            component: Text,
        },
        {
            key: "product_free_shipping_min",
            label: "Free Shipping Minimum Order",
            type: "product-settings",
            style: "right",
            position: 10,
            component: Text,
        },
        {
            key: "product_out_of_stock_msg",
            label: "Out of Stock Message",
            type: "product-settings",
            style: "right",
            position: 20,
            component: Text,
        },
        {
            key: "product_reviews_enabled",
            label: "Enable Reviews",
            type: "product-settings",
            style: "right",
            position: 30,
            component: Switch,
        },
        {
            key: "product_whatsapp_number",
            label: "WhatsApp Number (with country code)",
            type: "product-settings",
            style: "left",
            position: 40,
            component: Text,
        },
        {
            key: "product_telegram_username",
            label: "Telegram Username",
            type: "product-settings",
            style: "left",
            position: 50,
            component: Text,
        },
        {
            key: "product_facebook_page_id",
            label: "Facebook Page ID (Messenger)",
            type: "product-settings",
            style: "left",
            position: 60,
            component: Text,
        },
    ], PLUGINS.nx);
}
