import { NextRequest, NextResponse } from 'next/server';
import { getOrdersCollection, initializeOrdersCollection } from '@/plugin/product/models/Order';
import { EXPRESS_API, LICENSE_KEY } from '@/lib/express';

export const dynamic = 'force-dynamic';

/**
 * Resolve the caller by forwarding the auth_token cookie to Express /auth/me.
 * Returns { userId, userType } or null if unauthenticated.
 */
async function resolveUser(req: NextRequest): Promise<{ userId: string; userType: string } | null> {
    try {
        // Forward every cookie so Express can validate auth_token
        const cookieHeader = req.headers.get('cookie') ?? '';

        const res = await fetch(`${EXPRESS_API}/auth/me`, {
            headers: {
                'Content-Type': 'application/json',
                'x-license-key': LICENSE_KEY,
                'cookie': cookieHeader,
            },
        });

        if (!res.ok) return null;

        const data = await res.json();
        const user = data.user ?? data;
        if (!user?._id) return null;

        return { userId: String(user._id), userType: user.type ?? 'user' };
    } catch {
        return null;
    }
}

/**
 * GET /api/orders
 *
 * Returns orders for the currently authenticated user.
 * Admins can pass ?all=true to fetch every order.
 *
 * Query params:
 *   all           – admin only: fetch every order
 *   status        – filter by order status
 *   paymentStatus – filter by payment status
 *   page          – 1-based page number (default 1)
 *   limit         – page size (default 20, max 100)
 *   search        – search by orderNumber / name / email / phone
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

        if (!fetchAll) query.userId = userId;
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
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        });

    } catch (error) {
        console.error('Orders GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }
}
