/**
 * Product Layout 1 — Clean e-commerce style.
 *
 * Server component. Receives `data`, `settings`, `permalinkMap`, and
 * `pageData` from the slug page router.
 *
 * `pageData.ancestors` contains the category breadcrumb chain (root → leaf)
 * fetched server-side by serverHooks.ts via getCategoryAncestors().
 * No HTTP fetch here — direct DB call via the hook system.
 */

import ProductClient from './ProductClient';

interface ProductPageProps {
    data: {
        _id: string;
        title: string;
        slug: string;
        status: string;
        category?: string;
        createdAt: string;
        updatedAt: string;
        info: Record<string, string>;
    };
    settings?: Record<string, any>;
    permalinkMap?: Record<string, string>;
    /** Injected by serverDataHooks: { ancestors: [...], seller: {...} | null } */
    pageData?: {
        ancestors?: { _id: string; title: string; slug: string }[];
        seller?: {
            _id: string; name: string; image: string; slug: string;
            city: string; state: string; bio: string; website: string; twitter: string;
        } | null;
    };
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function buildUrl(prefix: string, slug: string): string {
    const p = prefix.trim().replace(/^\/+|\/+$/g, '');
    return p ? `/${p}/${slug}` : `/${slug}`;
}

export default function ProductLayout1({ data, settings = {}, permalinkMap = {}, pageData }: ProductPageProps) {
    const variate = parseJson<Record<string, any>>(data.info?._variate, {});

    const priceType: 'single' | 'variant' = variate.priceType ?? 'single';
    const regularPrice  = parseFloat(variate.regularprice ?? '0') || 0;
    const sellingPrice  = parseFloat(variate.sellingprice ?? '0') || 0;
    const singleStock   = parseInt(variate.stock          ?? '0', 10) || 0;
    const variants: any[]             = variate.variants           ?? [];
    const selectedAttributes: any[]   = variate.selectedAttributes ?? [];
    const variantDisplayStyle: string = variate.variantDisplayStyle ?? 'text';

    const variantImages: string[] = [];
    for (const v of variants) {
        if (v.image)           variantImages.push(v.image);
        if (v.gallery?.length) variantImages.push(...v.gallery);
    }
    const defaultImages: string[] = parseJson<string[]>(data.info?.images, []);
    const allImages = [...new Set([...defaultImages, ...variantImages])].filter(Boolean);

    const specifications: any[] = parseJson<any[]>(data.info?._specifications, []);
    const compareIds: string[]  = parseJson<string[]>(data.info?._compare, []);

    const currencySymbol   = (settings.product_currency_symbol   as string) || '$';
    const whatsappNumber   = (settings.product_whatsapp_number   as string) || '';
    const telegramUsername = (settings.product_telegram_username as string) || '';
    const facebookPageId   = (settings.product_facebook_page_id  as string) || '';

    const shortDescription = data.info?.shortDescription ?? '';
    const description      = data.info?.description      ?? '';
    const htmlDescription  = data.info?.htmlDescription  ?? '';
    const orderNote        = data.info?.orderNote        ?? '';

    const hasDiscount     = priceType === 'single' && sellingPrice > 0 && regularPrice > sellingPrice;
    const discountPercent = hasDiscount
        ? Math.round(((regularPrice - sellingPrice) / regularPrice) * 100)
        : 0;
    const displayPrice    = priceType === 'single' ? (sellingPrice || regularPrice) : 0;

    // ── Category breadcrumb from pageData (injected server-side, no fetch) ──
    const ancestors  = pageData?.ancestors ?? [];
    const seller     = pageData?.seller    ?? null;
    const catPrefix  = (permalinkMap['product-category'] ?? 'product/category')
        .trim().replace(/^\/+|\/+$/g, '');
    const categoryLinks = ancestors.map(cat => ({
        title: cat.title,
        url:   buildUrl(catPrefix, cat.slug),
    }));

    // Build seller profile URL using the "seller" permalink prefix
    const sellerPrefix = (permalinkMap['seller'] ?? 'seller')
        .trim().replace(/^\/+|\/+$/g, '') || 'seller';

    return (
        <ProductClient
            layout={1}
            data={{ id: String(data._id), title: data.title, slug: data.slug }}
            priceType={priceType}
            regularPrice={regularPrice}
            sellingPrice={sellingPrice}
            displayPrice={displayPrice}
            hasDiscount={hasDiscount}
            discountPercent={discountPercent}
            singleStock={singleStock}
            variants={variants}
            selectedAttributes={selectedAttributes}
            variantDisplayStyle={variantDisplayStyle}
            allImages={allImages}
            specifications={specifications}
            compareIds={compareIds}
            currencySymbol={currencySymbol}
            whatsappNumber={whatsappNumber}
            telegramUsername={telegramUsername}
            facebookPageId={facebookPageId}
            shortDescription={shortDescription}
            description={description}
            htmlDescription={htmlDescription}
            orderNote={orderNote}
            categoryLinks={categoryLinks}
            seller={seller ? {
                ...seller,
                profileUrl: buildUrl(sellerPrefix, seller.slug),
            } : null}
        />
    );
}
