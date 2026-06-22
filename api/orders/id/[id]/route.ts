import { NextRequest, NextResponse } from 'next/server';
import { getOrdersCollection, initializeOrdersCollection } from '@/plugin/product/models/Order';
import { resolveUser } from '@/lib/session';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

/** GET /api/orders/id/:id — fetch by MongoDB _id, admin only */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id || !mongoose.isValidObjectId(id)) {
            return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
        }

        const caller = await resolveUser(req);

        if (!caller) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin  = caller.userType === 'admin' || caller.userType === 'superadmin';
        const isSeller = caller.userType === 'seller';

        await initializeOrdersCollection();
        const collection = await getOrdersCollection();

        const order = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Resolve full session for email/phone owner matching
        const { getAuthSession } = await import('@/lib/session');
        const authUser = await getAuthSession(req);

        // Access rules:
        //  1. Admin        — always allowed
        //  2. Order owner  — userId matches, or email/phone matches shipping address
        //  3. Seller       — at least one item was uploaded by this seller
        //     Check uploadedBy first (new orders), fall back to PostInfo lookup (old orders)
        const isOrderOwner =
            (order.userId && order.userId === caller.userId) ||
            (authUser?.email && order.userEmail === authUser.email) ||
            (authUser?.phone && order.shippingAddress?.phone === authUser.phone);

        let isSellerInOrder = false;
        if (isSeller) {
            // Fast path: uploadedBy already stamped on items
            isSellerInOrder = order.items.some((item: any) => item.uploadedBy === caller.userId);

            // Slow path: old orders without uploadedBy — check PostInfo
            if (!isSellerInOrder && order.items.length > 0) {
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
        }

        if (!isAdmin && !isOrderOwner && !isSellerInOrder) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({ order: { ...order, _id: order._id?.toString() } });
    } catch (error) {
        console.error('Order by ID GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
    }
}
