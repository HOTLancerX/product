import { addHook, addPostType, addCatType, addBuilderElement, type PluginMeta } from "@/hook";
import { Text, Textarea, Select, Switch, CategoryHierarchicalSelect } from "@/components/ui";
import { registerLazyComponent } from "@/hook/pluginHooks";
import cartElement from "./elements/Cart";
import cartListElement from "./elements/CartList";

// ─── Lazy component registrations ─────────────────────────────────────────────
// Heavy page components are NOT imported at module load time.
// They are dynamically imported on-demand when the plugin is active.
// This keeps them out of the bundle when the plugin is disabled.
//
// Components used directly in addHook() calls (pass as `component:`) are still
// imported statically here because they are lightweight UI field components
// that must be synchronously available during hook registration.
// Only page-level / route-level components use lazy loading.

import ProductLayout1 from "./product/Layout1";
import ProductLayout2 from "./product/Layout2";
import ProductCategoryLayout1 from "./product-category/Layout1";
import ProductCategoryLayout2 from "./product-category/Layout2";
import Variate from "./variate/Variate";
import PostSpecification from "./variate/PostSpecification";
import ProductSettingsPage from "./settings/ProductSettingsPage";
import ProductBox1 from "./box/Product-1";
import ProductBox2 from "./box/Product-2";
import Header4 from "./header/Header1";

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
    // ─── Register Builder Elements ───────────────────────────────────────────
    addBuilderElement(cartElement, PLUGINS.nx);
    addBuilderElement(cartListElement, PLUGINS.nx);

    // ─── Register lazy page components ───────────────────────────────────────
    // These are registered once per register() call (dedup is inside
    // registerLazyComponent — last write wins on re-register / hot-reload).
    registerLazyComponent("product.CheckoutPage",          () => import("./checkout/page"),           PLUGINS.nx);
    registerLazyComponent("product.OrderConfirmationPage", () => import("./order-confirmation/page"), PLUGINS.nx);
    registerLazyComponent("product.AdminOrdersPage",       () => import("./orders/page"),             PLUGINS.nx);
    registerLazyComponent("product.AdminOrderDetailPage",  () => import("./orders/details"),          PLUGINS.nx);
    registerLazyComponent("product.PendingOrdersPage",     () => import("./orders/pending/page"),     PLUGINS.nx);
    registerLazyComponent("product.ProcessingOrdersPage",  () => import("./orders/processing/page"),  PLUGINS.nx);
    registerLazyComponent("product.ShippedOrdersPage",     () => import("./orders/shipped/page"),     PLUGINS.nx);
    registerLazyComponent("product.DeliveredOrdersPage",   () => import("./orders/delivered/page"),   PLUGINS.nx);
    registerLazyComponent("product.CancelledOrdersPage",   () => import("./orders/cancelled/page"),   PLUGINS.nx);
    registerLazyComponent("product.ReturnManager",         () => import("./orders/ReturnManager"),    PLUGINS.nx);
    registerLazyComponent("product.UserOrderList",         () => import("./users/orderlist"),         PLUGINS.nx);
    registerLazyComponent("product.UserOrderDetails",      () => import("./users/orderdetails"),      PLUGINS.nx);
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
        {
            key: "shipping_inside",
            label: "Inside Shipping Cost (per item)",
            type: "product",
            style: "right",
            position: 80,
            component: Text,
        },
        {
            key: "shipping_outside",
            label: "Outside Shipping Cost (per item)",
            type: "product",
            style: "right",
            position: 85,
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
        {
            key: "header",
            label: "Header Layout 5",
            type: "header",
            slug: "layout",
            style: "left",
            position: 10,
            active: true,           // first-boot default
            component: Header4,
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

    // ─── Orders nav — top-level parent + status sub-items ──────────────────
    addHook("admin.nav", [
        {
            key: "orders",
            label: "Orders",
            icon: "carbon:order-storm",
            slug: "orders",
            parent: "",
            position: 14,
        },
        {
            key: "orders-pending",
            label: "Pending",
            icon: "mdi:clock-outline",
            slug: "orders/pending",
            parent: "orders",
            position: 2,
        },
        {
            key: "orders-processing",
            label: "Processing",
            icon: "mdi:cog-outline",
            slug: "orders/processing",
            parent: "orders",
            position: 3,
        },
        {
            key: "orders-shipped",
            label: "Shipped",
            icon: "mdi:truck-delivery-outline",
            slug: "orders/shipped",
            parent: "orders",
            position: 4,
        },
        {
            key: "orders-delivered",
            label: "Delivered",
            icon: "mdi:check-circle-outline",
            slug: "orders/delivered",
            parent: "orders",
            position: 5,
        },
        {
            key: "orders-cancelled",
            label: "Cancelled",
            icon: "mdi:close-circle-outline",
            slug: "orders/cancelled",
            parent: "orders",
            position: 6,
        },
        {
            key: "orders-returns",
            label: "Returns",
            icon: "solar:box-minimalistic-bold",
            slug: "orders/returns",
            parent: "orders",
            position: 7,
        },
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
            key: "orders",
            label: "All Orders",
            type: "product-orders",
            style: "left",
            position: 10,
            lazyPath: "product.AdminOrdersPage",
        },
        {
            key: "orders/",
            label: "Order Detail",
            type: "product-orders",
            style: "left",
            position: 11,
            lazyPath: "product.AdminOrderDetailPage",
        },
        {
            key: "orders/pending",
            label: "Pending Orders",
            type: "product-orders",
            style: "left",
            position: 12,
            lazyPath: "product.PendingOrdersPage",
        },
        {
            key: "orders/processing",
            label: "Processing Orders",
            type: "product-orders",
            style: "left",
            position: 13,
            lazyPath: "product.ProcessingOrdersPage",
        },
        {
            key: "orders/shipped",
            label: "Shipped Orders",
            type: "product-orders",
            style: "left",
            position: 14,
            lazyPath: "product.ShippedOrdersPage",
        },
        {
            key: "orders/delivered",
            label: "Delivered Orders",
            type: "product-orders",
            style: "left",
            position: 15,
            lazyPath: "product.DeliveredOrdersPage",
        },
        {
            key: "orders/cancelled",
            label: "Cancelled Orders",
            type: "product-orders",
            style: "left",
            position: 16,
            lazyPath: "product.CancelledOrdersPage",
        },
        {
            key: "orders/returns",
            label: "Return Requests",
            type: "product-orders",
            style: "left",
            position: 17,
            lazyPath: "product.ReturnManager",
        },
        {
            key: "product/settings",
            label: "Product Settings",
            type: "product-settings",
            style: "left",
            position: 20,
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

    // ─── Shipping settings form fields ──────────────────────────────────────
    // type: "product-shipping" → shown on the Shipping tab of product settings.
    addHook("setting.form", [
        {
            key: "shipping_inside_rate",
            label: "Shipping Rate — Inside (default per item)",
            type: "product-shipping",
            style: "left",
            position: 10,
            component: Text,
        },
        {
            key: "shipping_outside_rate",
            label: "Shipping Rate — Outside (default per item)",
            type: "product-shipping",
            style: "left",
            position: 20,
            component: Text,
        },
        {
            key: "shipping_inside_label",
            label: "Inside Shipping Label",
            type: "product-shipping",
            style: "left",
            position: 30,
            component: Text,
        },
        {
            key: "shipping_outside_label",
            label: "Outside Shipping Label",
            type: "product-shipping",
            style: "left",
            position: 40,
            component: Text,
        },
        {
            key: "product_free_shipping_min",
            label: "Free Shipping Minimum Order Amount",
            type: "product-shipping",
            style: "right",
            position: 10,
            component: Text,
        },
        {
            key: "shipping_estimated_days_inside",
            label: "Estimated Delivery Days — Inside",
            type: "product-shipping",
            style: "right",
            position: 20,
            component: Text,
        },
        {
            key: "shipping_estimated_days_outside",
            label: "Estimated Delivery Days — Outside",
            type: "product-shipping",
            style: "right",
            position: 30,
            component: Text,
        },
    ], PLUGINS.nx);

    // ─── Checkout static page (root.pages single) ──────────────────────────
    addHook("root.pages", [
        {
            key: "checkout",
            label: "Checkout",
            type: "single",
            slug: "single",
            style: "left",
            position: 10,
            active: true,
            lazyPath: "product.CheckoutPage",
        },
        {
            key: "order-confirmation",
            label: "Order Confirmation",
            type: "single",
            slug: "prefix",
            style: "left",
            position: 11,
            active: true,
            lazyPath: "product.OrderConfirmationPage",
        },
    ], PLUGINS.nx);

    // ─── User account nav items ─────────────────────────────────────────────
    addHook("user.nav", [
        {
            key:      "user-orders",
            label:    "My Orders",
            icon:     "solar:bag-bold",
            slug:     "orders",
            parent:   "",
            position: 2,
        },
    ], PLUGINS.nx);

    // ─── User account pages ─────────────────────────────────────────────────
    // URL: /account/orders          → order list
    // URL: /account/orders/<_id>    → order detail (prefix match)
    addHook("user.page", [
        {
            key:      "orders",
            label:    "My Orders",
            type:     "user-orders",
            style:    "left",
            position: 10,
            lazyPath: "product.UserOrderList",
        },
        {
            key:      "orders/",
            label:    "Order Detail",
            type:     "user-orders",
            style:    "left",
            position: 11,
            lazyPath: "product.UserOrderDetails",
        },
    ], PLUGINS.nx);
}
