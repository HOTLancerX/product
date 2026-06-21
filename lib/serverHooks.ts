/**
 * plugin/product/lib/serverHooks.ts — Server-only hook registration.
 *
 * Auto-discovered by hook/serverDataHooks.ts via require.context.
 * Registers data providers for product post types and category types.
 *
 * NEVER import this file from plugin/index.ts or any client component.
 */

import { registerServerDataHook } from "@/hook/serverDataHooks";
import { getCategoryPageData, getCategoryAncestors } from "./category";
import connectDB from "@/lib/mongodb";
import User from "@/models/Users";
import UserInfo from "@/models/Users_info";

// ── Category types — full page data (products, subCats, ancestors, activeBox)
registerServerDataHook("product-category", getCategoryPageData);
registerServerDataHook("brands",           getCategoryPageData);

// ── Product post type — ancestors + seller info
registerServerDataHook("product", async (_id, _slug, data) => {
    await connectDB();

    // Category breadcrumb ancestors
    const ancestors = data?.category
        ? await getCategoryAncestors(String(data.category))
        : [];

    // Seller info from PostInfo userId field
    const userIdInfo = data?.info?.userId as string | undefined;
    let seller: Record<string, string> | null = null;

    if (userIdInfo) {
        try {
            const sellerUser = await User.findById(userIdInfo).lean() as any;
            if (sellerUser) {
                const userInfoDocs = await UserInfo.find({ userId: sellerUser._id }).lean() as any[];
                const uiMap: Record<string, string> = {};
                userInfoDocs.forEach((d: any) => { uiMap[d.name] = String(d.value ?? ""); });

                // Fully-serialized — no ObjectId / Date / Buffer
                seller = {
                    _id:     String(sellerUser._id),
                    name:    String(sellerUser.name    ?? ""),
                    image:   String(sellerUser.image   ?? ""),
                    slug:    String(sellerUser.slug    ?? ""),
                    city:    String(sellerUser.city    ?? ""),
                    state:   String(sellerUser.state   ?? ""),
                    bio:     String(uiMap.bio     ?? ""),
                    website: String(uiMap.website ?? ""),
                    twitter: String(uiMap.twitter ?? ""),
                };
            }
        } catch { /* non-critical — product page still works */ }
    }

    return { ancestors, seller };
});
