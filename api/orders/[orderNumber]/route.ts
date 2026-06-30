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

        // ── Commission credit + membership activation on delivery ──
        // Only trigger once — when transitioning INTO "delivered" from a non-delivered status.
        const transitioningToDelivered =
            status === 'delivered' && order.status !== 'delivered';

        if (transitioningToDelivered) {
            await createSellerCommissionCredits(order, orderNumber, now);
            await activateMembershipOnDelivery(order).catch((err) =>
                console.error('membership activation error:', err)
            );
        }

        const updated = await collection.findOne({ orderNumber });
        return NextResponse.json({ order: { ...updated, _id: updated?._id?.toString() } });
    } catch (error) {
        console.error('Order PUT error:', error);
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }
}

// ── Commission credit helper ──────────────────────────────────────────────────

/**
 * For each item in the order that has an uploadedBy seller:
 *  1. Look up the product category's seller_commission rate.
 *  2. Calculate net seller amount = subtotal × (1 - rate/100).
 *  3. Create a SellerTransaction (type: credit, status: pending).
 *  4. Increment the seller's pendingBalance and totalEarned.
 *
 * Idempotent: skips items that already have a pending/available credit for this order.
 */
async function createSellerCommissionCredits(
    order: any,
    orderNumber: string,
    now: Date
): Promise<void> {
    try {
        // Lazy imports — keep this route tree free of Mongoose at module level
        const { default: connectDB }                = await import('@/lib/mongodb');
        const { getTransactionModel }               = await import('@/plugin/seller/models/Transaction');
        const { updateWallet }                      = await import('@/plugin/seller/models/Wallet');
        const { default: PostInfo }                 = await import('@/models/post_info');

        await connectDB();

        const TxModel = getTransactionModel();
        const availableAfter = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Group items by seller (uploadedBy)
        const bySellerMap = new Map<string, typeof order.items>();
        for (const item of order.items) {
            if (!item.uploadedBy) continue;
            const arr = bySellerMap.get(item.uploadedBy) ?? [];
            arr.push(item);
            bySellerMap.set(item.uploadedBy, arr);
        }

        for (const [sellerId, items] of bySellerMap) {
            // Check if a credit for this seller+order already exists (idempotency)
            const existing = await TxModel.findOne({
                userId:      sellerId,
                orderNumber,
                type:        'credit',
                status:      { $in: ['pending', 'available'] },
            }).lean();
            if (existing) continue;

            // Calculate total subtotal and commission for this seller's items
            let gross = 0;
            let commissionRate = 0;

            for (const item of items) {
                gross += item.subtotal ?? 0;

                // Fetch commission rate from product's category (first item wins for simplicity)
                if (commissionRate === 0 && item.productId) {
                    try {
                        // Look up the product's category id from PostInfo
                        const catInfo = await PostInfo.findOne({
                            postId: item.productId,
                            name:   'category',
                        }).lean() as any;

                        if (catInfo?.value) {
                            // Look up the seller_commission for this category
                            const { getCollection } = await import('@/lib/mongodb');
                            const catInfoCol = await getCollection('cat_infos');
                            const commInfo = await catInfoCol.findOne({
                                catId: catInfo.value,
                                name:  'seller_commission',
                            });
                            const rate = parseFloat((commInfo as any)?.value ?? '0');
                            if (!isNaN(rate) && rate > 0) commissionRate = rate;
                        }
                    } catch {
                        // commission stays 0 if lookup fails
                    }
                }
            }

            const adminAmount  = parseFloat(((gross * commissionRate) / 100).toFixed(2));
            const sellerAmount = parseFloat((gross - adminAmount).toFixed(2));

            // Create the pending credit transaction
            await TxModel.create({
                userId:         sellerId,
                orderId:        String(order._id),
                orderNumber,
                type:           'credit',
                status:         'pending',
                gross,
                commissionRate,
                adminAmount,
                amount:         sellerAmount,
                availableAfter,
                note:           `Earnings from order ${orderNumber}. Available after ${availableAfter.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}.`,
            });

            // Add to pendingBalance and totalEarned
            await updateWallet(sellerId, {
                pendingBalance: sellerAmount,
                totalEarned:    sellerAmount,
            });
        }
    } catch (err) {
        // Log but do not fail the status update
        console.error('createSellerCommissionCredits error:', err);
    }
}
// ── Membership activation on delivery ─────────────────────────────────────────

/**
 * When an order is delivered, check if any item matches a membership package's
 * linked productId. If so, activate/renew the buyer's seller membership.
 */
async function activateMembershipOnDelivery(order: any): Promise<void> {
    try {
        const { getActivePackages } = await import('@/plugin/seller-membership/models/MembershipPackage');
        const { activateMembership } = await import('@/plugin/seller-membership/models/SellerMembership');

        const packages = await getActivePackages();
        if (!packages.length) return;

        const buyerUserId = order.userId;
        if (!buyerUserId) return;

        for (const item of (order.items ?? [])) {
            const matchedPkg = packages.find((p: any) => p.productId === item.productId);
            if (!matchedPkg) continue;

            const quantity = item.quantity ?? 1;
            await activateMembership(
                buyerUserId,
                matchedPkg._id,
                order.orderNumber || '',
                quantity,
                matchedPkg.type as 'one-time' | 'monthly' | 'yearly'
            );

            console.log(
                `[seller-membership] Activated ${matchedPkg.name} for user ${buyerUserId} (qty: ${quantity}, order: ${order.orderNumber})`
            );
        }
    } catch (err) {
        console.error('[seller-membership] activateMembershipOnDelivery error:', err);
    }
}
