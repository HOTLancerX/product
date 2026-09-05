/**
 * Product Layout 2 — Dark storefront style.
 *
 * Identical data pipeline to Layout1. Passes layout={2} to ProductClient.
 */

import ProductClient from './ProductClient';
import ProductReviewsList from './ProductReviewsList';

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
    pageData?: {
        ancestors?:        { _id: string; title: string; slug: string }[];
        seller?:           { _id: string; name: string; image: string; slug: string; city: string; state: string; bio: string; website: string; twitter: string; } | null;
        compareProducts?:  any[] | null;
        categoryProducts?: any[] | null;
        flashSaleCampaign?: any | null;
        brand?:             { _id: string; title: string; slug: string } | null;
        reviewsData?:       any | null;
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

export default function ProductLayout2({ data, settings = {}, permalinkMap = {}, pageData }: ProductPageProps) {
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
    const shippingInside   = parseFloat(data.info?.shipping_inside ?? '') || undefined;
    const shippingOutside  = parseFloat(data.info?.shipping_outside ?? '') || undefined;

    const hasDiscount     = priceType === 'single' && sellingPrice > 0 && regularPrice > sellingPrice;
    const discountPercent = hasDiscount
        ? Math.round(((regularPrice - sellingPrice) / regularPrice) * 100)
        : 0;
    const displayPrice = priceType === 'single'
        ? (sellingPrice > 0 ? sellingPrice : regularPrice)
        : 0;

    const ancestors        = pageData?.ancestors        ?? [];
    const compareProducts  = pageData?.compareProducts  ?? null;
    const categoryProducts = pageData?.categoryProducts ?? null;
    const flashSaleCampaign = pageData?.flashSaleCampaign ?? null;
    const catPrefix  = (permalinkMap['product-category'] ?? 'product/category')
        .trim().replace(/^\/+|\/+$/g, '');
    const categoryLinks = ancestors.map(cat => ({
        title: cat.title,
        url:   buildUrl(catPrefix, cat.slug),
    }));

    const shippingInsideLabel  = (settings.shipping_inside_label  as string) || "Inside Shipping";
    const shippingOutsideLabel = (settings.shipping_outside_label as string) || "Outside Shipping";
    const shippingInsideRate   = parseFloat(settings.shipping_inside_rate  as string) || 0;
    const shippingOutsideRate  = parseFloat(settings.shipping_outside_rate as string) || 0;
    const relatedCols          = parseInt(settings.related_products_cols   as string ?? "6", 10) || 6;

    const seller = pageData?.seller ?? null;
    const sellerPrefix = (permalinkMap['seller'] ?? 'seller')
        .trim().replace(/^\/+|\/+$/g, '') || 'seller';

    const reviewsData = pageData?.reviewsData ?? null;

    return (
        <div className="bg-white space-y-6">
            <ProductClient
                layout={2}
                data={{ id: String(data._id), title: data.title, slug: data.slug }}
                productId={String(data._id)}
                categoryId={data.category ?? null}
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
                shippingInside={shippingInside}
                shippingOutside={shippingOutside}
                shippingInsideLabel={shippingInsideLabel}
                shippingOutsideLabel={shippingOutsideLabel}
                shippingInsideRate={shippingInsideRate}
                shippingOutsideRate={shippingOutsideRate}
                relatedCols={relatedCols}
                categoryLinks={categoryLinks}
                compareProducts={compareProducts}
                categoryProducts={categoryProducts}
                flashSaleCampaign={flashSaleCampaign}
                seller={seller ? {
                    ...seller,
                    profileUrl: buildUrl(sellerPrefix, seller.slug),
                } : null}
            />

            {/* Server-Side Rendered Product Reviews */}
            <div className="container my-8 pb-12">
                <ProductReviewsList reviewsData={reviewsData} theme="light" />
            </div>
        </div>
    );
}
