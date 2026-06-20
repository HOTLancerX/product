import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getOrdersCollection, initializeOrdersCollection, generateOrderNumber } from '@/plugin/product/models/Order';
import Post from '@/models/post';
import { resolveUser } from '@/lib/session';

function parseUserAgent(userAgent: string) {
    const device = /mobile/i.test(userAgent) ? 'Mobile' : /tablet/i.test(userAgent) ? 'Tablet' : 'Desktop';
    let browser = 'Unknown';
    if (userAgent.includes('Chrome'))        browser = 'Chrome';
    else if (userAgent.includes('Firefox'))  browser = 'Firefox';
    else if (userAgent.includes('Safari'))   browser = 'Safari';
    else if (userAgent.includes('Edge'))     browser = 'Edge';
    let os = 'Unknown';
    if (userAgent.includes('Windows'))       os = 'Windows';
    else if (userAgent.includes('Mac'))      os = 'macOS';
    else if (userAgent.includes('Linux'))    os = 'Linux';
    else if (userAgent.includes('Android'))  os = 'Android';
    else if (userAgent.includes('iOS'))      os = 'iOS';
    return { device, browser, os };
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { items, shippingAddress, shippingMethod, shippingCost,
                subtotal, total, paymentMethod, transactionId,
                paymentInfo, proofImage, notes } = body;

        if (!items || items.length === 0)
            return NextResponse.json({ error: 'No items in order' }, { status: 400 });

        if (!shippingAddress?.name || !shippingAddress?.phone)
            return NextResponse.json({ error: 'Name and phone number are required' }, { status: 400 });

        if (!shippingMethod || !['inside', 'outside'].includes(shippingMethod))
            return NextResponse.json({ error: 'Invalid shipping method' }, { status: 400 });

        await connectDB();
        await initializeOrdersCollection();
        const ordersCollection = await getOrdersCollection();
        const orderNumber = generateOrderNumber();

        const userAgent = request.headers.get('user-agent') || '';
        const ipAddress = request.headers.get('x-forwarded-for')
            || request.headers.get('x-real-ip') || 'Unknown';
        const { device, browser, os } = parseUserAgent(userAgent);

        // Enrich items with product uploader's userId
        const enrichedItems = await Promise.all(
            items.map(async (item: any) => {
                try {
                    const product = await Post.findById(item.productId).select('userId').lean();
                    return { ...item, uploadedBy: (product as any)?.userId || undefined };
                } catch { return item; }
            })
        );

        // Resolve caller from NextAuth session (optional — guest checkout allowed)
        const caller  = await resolveUser(request);
        const userId  = caller?.userId;
        const userName = 'Guest';

        const order = {
            orderNumber,
            userId,
            userEmail:          shippingAddress.email || '',
            items:              enrichedItems,
            shippingAddress,
            shippingMethod,
            shippingCost:       parseFloat(shippingCost)  || 0,
            subtotal:           parseFloat(subtotal)       || 0,
            total:              parseFloat(total)          || 0,
            status:             'pending' as const,
            paymentStatus:      'pending' as const,
            paymentGatewayType: paymentMethod || 'cash_on_delivery',
            paymentProof: (transactionId || paymentInfo || proofImage) ? {
                transactionId: transactionId || undefined,
                paymentInfo:   paymentInfo   || undefined,
                proofImage:    proofImage    || undefined,
            } : undefined,
            timeline: [{
                status:        'pending',
                note:          'Order placed',
                createdBy:     userId || 'guest',
                createdByName: userName,
                createdAt:     new Date(),
            }],
            metadata: { ipAddress, userAgent, device, browser, os },
            notes:            notes || '',
            inventoryUpdated: false,
            createdAt:        new Date(),
            updatedAt:        new Date(),
        };

        const result = await ordersCollection.insertOne(order);

        return NextResponse.json({
            success: true, orderNumber,
            orderId: result.insertedId.toString(),
        });
    } catch (error) {
        console.error('Checkout error:', error);
        return NextResponse.json({ error: 'Failed to process order' }, { status: 500 });
    }
}
