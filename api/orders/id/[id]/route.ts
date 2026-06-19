import { NextRequest, NextResponse } from 'next/server';
import { getOrdersCollection, initializeOrdersCollection } from '@/plugin/product/models/Order';
import { EXPRESS_API, LICENSE_KEY } from '@/lib/express';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

async function resolveUser(req: NextRequest): Promise<{ userId: string; userType: string } | null> {
    try {
        const res = await fetch(`${EXPRESS_API}/auth/me`, {
            headers: {
                'Content-Type': 'application/json',
                'x-license-key': LICENSE_KEY,
                'cookie': req.headers.get('cookie') ?? '',
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
 * GET /api/orders/id/:id
 *
 * Fetch a single order by its MongoDB _id.
 * Admin only — this endpoint is used by the admin detail page.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id || !ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
        }

        const caller = await resolveUser(req);
        const isAdmin = caller?.userType === 'admin' || caller?.userType === 'superadmin';

        if (!isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await initializeOrdersCollection();
        const collection = await getOrdersCollection();

        const order = await collection.findOne({ _id: new ObjectId(id) });
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        return NextResponse.json({ order: { ...order, _id: order._id?.toString() } });
    } catch (error) {
        console.error('Order by ID GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
    }
}
