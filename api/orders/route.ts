import { NextRequest, NextResponse } from 'next/server';
import { getOrdersCollection, initializeOrdersCollection } from '@/plugin/product/models/Order';
import { resolveUser, getAuthSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orders
 *
 * Returns orders belonging to the authenticated user.
 *
 * Matching strategy — finds orders where ANY of the following is true:
 *   1. order.userId          === user._id          (orders placed while logged in)
 *   2. shippingAddress.email === user.email         (guest orders matched by email)
 *   3. shippingAddress.phone === user.phone         (guest orders matched by phone)
 *
 * This means orders placed as a guest will appear once the user creates
 * an account with the same email or phone number.
 *
 * Admins can pass ?all=true to fetch every order in the system.
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

        const statusFilter  = searchParams.get('status')        ?? '';
        const paymentFilter = searchParams.get('paymentStatus') ?? '';
        const search        = searchParams.get('search')        ?? '';
        const page          = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
        const limit         = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
        const skip          = (page - 1) * limit;

        await initializeOrdersCollection();
        const collection = await getOrdersCollection();

        const query: Record<string, any> = {};

        if (!fetchAll) {
            // Get the full user profile to access email + phone for guest order matching
            const user = await getAuthSession(req);

            // Build the identity matchers — include every non-empty identifier
            const identityMatchers: Record<string, any>[] = [
                { userId },
            ];

            if (user?.email?.trim()) {
                identityMatchers.push({ 'shippingAddress.email': user.email.trim() });
                identityMatchers.push({ userEmail: user.email.trim() });
            }

            if (user?.phone?.trim()) {
                identityMatchers.push({ 'shippingAddress.phone': user.phone.trim() });
            }

            query.$or = identityMatchers;
        }

        if (statusFilter)  query.status        = statusFilter;
        if (paymentFilter) query.paymentStatus = paymentFilter;

        // Text search — wraps the identity $or in an $and so both must apply
        if (search) {
            const searchOr = [
                { orderNumber:             { $regex: search, $options: 'i' } },
                { 'shippingAddress.name':  { $regex: search, $options: 'i' } },
                { 'shippingAddress.email': { $regex: search, $options: 'i' } },
                { 'shippingAddress.phone': { $regex: search, $options: 'i' } },
            ];

            if (query.$or) {
                // Combine: (identity match) AND (search match)
                query.$and = [
                    { $or: query.$or },
                    { $or: searchOr },
                ];
                delete query.$or;
            } else {
                query.$or = searchOr;
            }
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
