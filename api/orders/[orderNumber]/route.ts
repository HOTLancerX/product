import { NextRequest, NextResponse } from 'next/server';
import { getOrdersCollection, initializeOrdersCollection } from '@/plugin/product/models/Order';
import { resolveUser } from '@/lib/session';
import { doAction } from '@/hook/pluginHooks';

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

/** PUT /api/orders/:orderNumber — admin or seller (limited status update) */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ orderNumber: string }> }
) {
    try {
        const { orderNumber } = await params;

        const caller = await resolveUser(req);
        if (!caller) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin  = caller.userType === 'admin' || caller.userType === 'superadmin';
        const isSeller = caller.userType === 'seller';

        await initializeOrdersCollection();
        const collection = await getOrdersCollection();

        const order = await collection.findOne({ orderNumber });
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Verify seller owns at least one item in this order
        if (!isAdmin) {
            if (!isSeller) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            // Fast path: uploadedBy already stamped
            let isSellerInOrder = order.items.some(
                (item: any) => item.uploadedBy === caller.userId
            );

            // Slow path: old orders without uploadedBy — check PostInfo
            if (!isSellerInOrder) {
                const { getCollection } = await import('@/lib/mongodb');
                const postInfoCol = await getCollection('postinfos');
                const productIds  = order.items.map((item: any) => item.productId).filter(Boolean);
                const match = await postInfoCol.findOne({
                    postId: { $in: productIds },
                    name:   'userId',
                    value:  caller.userId,
                });
                isSellerInOrder = Boolean(match);
            }

            if (!isSellerInOrder) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const body = await req.json();
        const { status, paymentStatus, note, inventoryUpdated } = body;

        // Sellers may only update to processing, shipped, delivered, or cancelled
        const SELLER_ALLOWED_STATUSES = ['processing', 'shipped', 'delivered', 'cancelled'];
        if (!isAdmin && status && !SELLER_ALLOWED_STATUSES.includes(status)) {
            return NextResponse.json(
                { error: `Sellers may only set status to: ${SELLER_ALLOWED_STATUSES.join(', ')}` },
                { status: 403 }
            );
        }

        // Sellers cannot change payment status
        if (!isAdmin && paymentStatus) {
            return NextResponse.json(
                { error: 'Sellers cannot update payment status' },
                { status: 403 }
            );
        }

        const now = new Date();
        const $set: Record<string, any> = { updatedAt: now };
        if (status)                         $set.status           = status;
        if (isAdmin && paymentStatus)        $set.paymentStatus    = paymentStatus;
        if (inventoryUpdated !== undefined)  $set.inventoryUpdated = inventoryUpdated;

        const timelineEntry = {
            status:        status ?? order.status,
            note:          note || `Status updated to ${status ?? order.status}`,
            createdBy:     caller.userId,
            createdByName: isAdmin ? 'Admin' : 'Seller',
            createdAt:     now,
        };

        await collection.updateOne(
            { orderNumber },
            { $set, $push: { timeline: timelineEntry } } as any
        );

        // ── Fire action hooks on delivery ─────────────────────────────────
        // When an order transitions to "delivered", broadcast the event so any
        // active plugin can respond (seller commission credit, membership
        // activation, loyalty points, etc.) — zero direct imports needed.
        const transitioningToDelivered =
            status === 'delivered' && order.status !== 'delivered';

        if (transitioningToDelivered) {
            await doAction('order.delivered', {
                order,
                orderNumber,
                orderId:   String(order._id),
                userId:    order.userId ?? '',
                items:     order.items  ?? [],
                now,
            });
        }

        const updated = await collection.findOne({ orderNumber });
        return NextResponse.json({ order: { ...updated, _id: updated?._id?.toString() } });
    } catch (error) {
        console.error('Order PUT error:', error);
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }
}
