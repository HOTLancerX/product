import { NextRequest, NextResponse } from 'next/server';
import { getOrdersCollection, initializeOrdersCollection } from '@/plugin/product/models/Order';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orders/:orderNumber
 *
 * Returns a single order by its human-readable order number (e.g. ORD-ABC123-XY).
 * Authenticated users can only fetch their own orders.
 * Admins can fetch any order.
 * Unauthenticated callers can also fetch (guest order confirmation display).
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ orderNumber: string }> }
) {
    try {
        const { orderNumber } = await params;
        if (!orderNumber) {
            return NextResponse.json({ error: 'Order number required' }, { status: 400 });
        }

        // Resolve caller (optional — guests can view their own confirmation)
        let userId: string | null = null;
        let userType = 'user';
        try {
            const sessionCookie = req.cookies.get('session');
            if (sessionCookie) {
                const sessionData = JSON.parse(
                    Buffer.from(sessionCookie.value, 'base64').toString()
                );
                userId   = sessionData.userId ?? null;
                userType = sessionData.type   ?? 'user';
            }
        } catch {
            // guest
        }

        await initializeOrdersCollection();
        const collection = await getOrdersCollection();

        const order = await collection.findOne({ orderNumber });
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Non-admin, logged-in users may only view their own orders
        const isAdmin = userType === 'admin' || userType === 'superadmin';
        if (userId && !isAdmin && order.userId && order.userId !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({ order: { ...order, _id: order._id?.toString() } });
    } catch (error) {
        console.error('Order GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
    }
}

/**
 * PUT /api/orders/:orderNumber
 *
 * Update an order's status, paymentStatus, or add a timeline note.
 * Admin only.
 *
 * Body: { status?, paymentStatus?, note?, inventoryUpdated? }
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ orderNumber: string }> }
) {
    try {
        const { orderNumber } = await params;

        // Admin guard
        let userId   = 'unknown';
        let userName = 'Admin';
        let userType = 'user';
        try {
            const sessionCookie = req.cookies.get('session');
            if (sessionCookie) {
                const sessionData = JSON.parse(
                    Buffer.from(sessionCookie.value, 'base64').toString()
                );
                userId   = sessionData.userId ?? 'unknown';
                userType = sessionData.type   ?? 'user';
                userName = sessionData.name   ?? 'Admin';
            }
        } catch {
            // unauthenticated
        }

        const isAdmin = userType === 'admin' || userType === 'superadmin';
        if (!isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { status, paymentStatus, note, inventoryUpdated } = body;

        await initializeOrdersCollection();
        const collection = await getOrdersCollection();

        const order = await collection.findOne({ orderNumber });
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Build update payload
        const $set: Record<string, any> = { updatedAt: new Date() };
        if (status)           $set.status           = status;
        if (paymentStatus)    $set.paymentStatus    = paymentStatus;
        if (inventoryUpdated !== undefined) $set.inventoryUpdated = inventoryUpdated;

        // Append timeline entry when a meaningful change or note is provided
        const timelineStatus = status ?? order.status;
        const timelineEntry = {
            status:        timelineStatus,
            note:          note || `Status updated to ${timelineStatus}`,
            createdBy:     userId,
            createdByName: userName,
            createdAt:     new Date(),
        };

        await collection.updateOne(
            { orderNumber },
            {
                $set,
                $push: { timeline: timelineEntry },
            } as any
        );

        const updated = await collection.findOne({ orderNumber });
        return NextResponse.json({ order: { ...updated, _id: updated?._id?.toString() } });
    } catch (error) {
        console.error('Order PUT error:', error);
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }
}
