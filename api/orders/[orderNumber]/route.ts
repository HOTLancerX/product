import { NextRequest, NextResponse } from 'next/server';
import { getOrdersCollection, initializeOrdersCollection } from '@/plugin/product/models/Order';
import { resolveUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** GET /api/orders/:orderNumber */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ orderNumber: string }> }
) {
    try {
        const { orderNumber } = await params;
        if (!orderNumber) {
            return NextResponse.json({ error: 'Order number required' }, { status: 400 });
        }

        const caller = await resolveUser(req);
        const isAdmin = caller?.userType === 'admin' || caller?.userType === 'superadmin';

        await initializeOrdersCollection();
        const collection = await getOrdersCollection();

        const order = await collection.findOne({ orderNumber });
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Logged-in non-admin users may only view their own orders
        if (caller && !isAdmin && order.userId && order.userId !== caller.userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({ order: { ...order, _id: order._id?.toString() } });
    } catch (error) {
        console.error('Order GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
    }
}

/** PUT /api/orders/:orderNumber — admin only */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ orderNumber: string }> }
) {
    try {
        const { orderNumber } = await params;

        const caller = await resolveUser(req);
        const isAdmin = caller?.userType === 'admin' || caller?.userType === 'superadmin';

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

        const $set: Record<string, any> = { updatedAt: new Date() };
        if (status)                       $set.status           = status;
        if (paymentStatus)                $set.paymentStatus    = paymentStatus;
        if (inventoryUpdated !== undefined) $set.inventoryUpdated = inventoryUpdated;

        const timelineEntry = {
            status:        status ?? order.status,
            note:          note || `Status updated to ${status ?? order.status}`,
            createdBy:     caller?.userId    ?? 'admin',
            createdByName: 'Admin',
            createdAt:     new Date(),
        };

        await collection.updateOne(
            { orderNumber },
            { $set, $push: { timeline: timelineEntry } } as any
        );

        const updated = await collection.findOne({ orderNumber });
        return NextResponse.json({ order: { ...updated, _id: updated?._id?.toString() } });
    } catch (error) {
        console.error('Order PUT error:', error);
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }
}
