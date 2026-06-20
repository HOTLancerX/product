import { NextRequest, NextResponse } from 'next/server';
import { getOrdersCollection, initializeOrdersCollection } from '@/plugin/product/models/Order';
import { resolveUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orders
 *
 * Returns orders for the currently authenticated user.
 * Admins can pass ?all=true to fetch every order.
 */
export async function GET(req: NextRequest) {
    try {
        const caller = await resolveUser(req);

        if (!caller) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { userId, userType } = caller;
        const { searchParams } = new URL(req.url);

        const isAdmin  = userType === 'admin' || userType === 'superadmin';
        const fetchAll = isAdmin && searchParams.get('all') === 'true';

        const status        = searchParams.get('status')        ?? '';
        const paymentStatus = searchParams.get('paymentStatus') ?? '';
        const search        = searchParams.get('search')        ?? '';
        const page          = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
        const limit         = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
        const skip          = (page - 1) * limit;

        await initializeOrdersCollection();
        const collection = await getOrdersCollection();

        const query: Record<string, any> = {};
        if (!fetchAll)     query.userId        = userId;
        if (status)        query.status        = status;
        if (paymentStatus) query.paymentStatus = paymentStatus;
        if (search) {
            query.$or = [
                { orderNumber:              { $regex: search, $options: 'i' } },
                { 'shippingAddress.name':   { $regex: search, $options: 'i' } },
                { 'shippingAddress.email':  { $regex: search, $options: 'i' } },
                { 'shippingAddress.phone':  { $regex: search, $options: 'i' } },
            ];
        }

        const [orders, total] = await Promise.all([
            collection.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            collection.countDocuments(query),
        ]);

        return NextResponse.json({
            orders: orders.map((o) => ({ ...o, _id: o._id?.toString() })),
            total, page, limit,
            pages: Math.ceil(total / limit),
        });

    } catch (error) {
        console.error('Orders GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }
}
