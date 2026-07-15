/**
 * plugin/product/lib/builderData.tsx
 *
 * SERVER-ONLY. Registers server-side renderers for product plugin elements.
 */

import React from "react";
import { registerBuilderElement } from "@/hook/builderDataHooks";
import CartExtended from "../elements/CartExtended";
import { CartListFrontend } from "../elements/CartList";

import { ProductTitleClient } from "../elements/product/ProductTitle";
import { ProductPriceClient } from "../elements/product/ProductPrice";
import { ProductSliderClient } from "../elements/product/ProductSlider";
import { ProductVariantsClient } from "../elements/product/ProductVariants";
import { ProductQtyAndCartClient } from "../elements/product/ProductQtyAndCart";
import { ProductSpecsClient } from "../elements/product/ProductSpecs";
import { ProductDescriptionClient } from "../elements/product/ProductDescription";
import { ProductMetaClient } from "../elements/product/ProductMeta";

registerBuilderElement("cart", async (schema: any) => {
    const fontSize = schema.style?.fontSize || 20;
    const color = schema.style?.color || "#374151";
    const displayType = schema.content?.displayType || "drawer-right";
    const icon = schema.content?.icon || "mdi:cart-outline";

    return (
        <div style={{ display: "inline-block" }}>
            <CartExtended displayType={displayType} fontSize={fontSize} color={color} icon={icon} />
        </div>
    );
});

registerBuilderElement("cart-list", async (schema: any) => {
    return (
        <CartListFrontend element={{ schema }} />
    );
});

registerBuilderElement("product-title", async (schema: any, data?: any) => {
    return <ProductTitleClient schema={schema} />;
});

registerBuilderElement("product-price", async (schema: any, data?: any) => {
    return <ProductPriceClient schema={schema} />;
});

registerBuilderElement("product-slider", async (schema: any, data?: any) => {
    return <ProductSliderClient schema={schema} />;
});

registerBuilderElement("product-variants", async (schema: any, data?: any) => {
    return <ProductVariantsClient schema={schema} />;
});

registerBuilderElement("product-qty-cart", async (schema: any, data?: any) => {
    return <ProductQtyAndCartClient schema={schema} />;
});

registerBuilderElement("product-specs", async (schema: any, data?: any) => {
    return <ProductSpecsClient schema={schema} />;
});

registerBuilderElement("product-description", async (schema: any, data?: any) => {
    return <ProductDescriptionClient schema={schema} />;
});

registerBuilderElement("product-meta", async (schema: any, data?: any) => {
    return <ProductMetaClient schema={schema} />;
});

import { ProductRelatedClient } from "../elements/product/Related";
import { getAllRootPages } from "@/hook";

registerBuilderElement("product-related", async (schema: any, data?: any) => {
    const limit = schema.content?.limit ?? 4;
    let relatedProducts: any[] = [];
    let BoxComponent: any = null;
    let productPrefix = "product";

    if (data?.category && data?._id) {
        try {
            const PostModel = (await import("@/models/post")).default;
            const PostInfoModel = (await import("@/models/post_info")).default;
            const TemplateModel = (await import("@/models/template")).default;
            const PermalinkModel = (await import("@/models/permalink")).default;

            const posts = await PostModel.find({
                type: "product",
                category: data.category,
                _id: { $ne: data._id },
                status: "published",
            })
            .limit(limit)
            .lean() as any[];

            relatedProducts = await Promise.all(
                posts.map(async (post) => {
                    const infoRecords = await PostInfoModel.find({ postId: post._id }).lean() as any[];
                    const infoMap = infoRecords.reduce<Record<string, string>>((acc, r) => {
                        acc[r.name] = r.value;
                        return acc;
                    }, {});
                    return {
                        _id: String(post._id),
                        title: post.title,
                        slug: post.slug,
                        info: infoMap,
                    };
                })
            );

            const activeBoxDoc = await TemplateModel.findOne({
                type: "product-box",
                isDefault: true,
            }).lean() as any;

            const boxes = getAllRootPages().filter(
                (p) => p.type === "product-box" && p.slug === "dynamic"
            );
            if (boxes.length > 0) {
                let match = null;
                if (activeBoxDoc) {
                    match = boxes.find(
                        (b) => b.label === activeBoxDoc.label && b.pluginNx === activeBoxDoc.pluginNx
                    );
                }
                BoxComponent = (match?.component || (boxes.find((b) => b.active === true) ?? boxes[0])?.component) ?? null;
            }

            const pm = await PermalinkModel.findOne({ contentType: "product" }).lean() as any;
            productPrefix = pm?.prefix || "product";

        } catch (err) {
            console.error("product-related server build error:", err);
        }
    }

    return (
        <div className="font-sans w-full">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Related Products</h3>
            <ProductRelatedClient
                schema={schema}
                products={relatedProducts}
                BoxComponent={BoxComponent}
                productPrefix={productPrefix}
            />
        </div>
    );
});

import { registerBuilderWrapper } from "@/hook/builderDataHooks";
import { ProductProvider } from "../product/ProductContext";

registerBuilderWrapper((builderComponent, data, pageData, settings, permalinkMap) => {
    if (data?.type === "product") {
        return (
            <ProductProvider data={data} settings={settings} permalinkMap={permalinkMap} pageData={pageData}>
                {builderComponent}
            </ProductProvider>
        );
    }
    return builderComponent;
});
