/**
 * /api/orders/:orderNumber/return
 *
 * POST — buyer submits a return request.
 *   Body: { reason: string, returnImages?: string[] }
 *   Rules:
 *     - Order must be in "delivered" status.
 *     - Delivery must have happened within the last 7 days.
 *     - One open return request per order at a time.
 *     - Must be the buyer (order.userId or email match) or admin.
 *
 * GET — fetch the return request for this order.
 *   Buyer sees their own; seller sees if they have an item; admin sees all.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveUser, getAuthSession } from "@/lib/session";
import connectDB from "@/lib/mongodb";
import {
    getReturnRequestsCollection,
    initializeReturnRequestsCollection,
} from "@/plugin/product/models/ReturnRequest";
import {
    getOrdersCollection,
    initializeOrdersCollection,
} from "@/plugin/product/models/Order";

export const dynamic = "force-dynamic";

const RETURN_WINDOW_DAYS = 7;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDeliveredAt(order: any): Date | null {
    if (!order.timeline || !Array.isArray(order.timeline)) return null;
    // Walk timeline in reverse — pick the most recent "delivered" entry
    const entries = [...order.timeline].reverse();
    for (const entry of entries) {
        if (entry.status === "delivered") {
            return entry.createdAt instanceof Date
                ? entry.createdAt
                : new Date(entry.createdAt);
        }
    }
    return null;
}

function withinReturnWindow(deliveredAt: Date): boolean {
    const cutoff = new Date(deliveredAt.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    return new Date() <= cutoff;
}

// ── POST — buyer submits return request ───────────────────────────────────────

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ orderNumber: string }> }
): Promise<Response> {
    try {
        const { orderNumber } = await params;
        if (!orderNumber) {
            return NextResponse.json({ error: "Order number required" }, { status: 400 });
        }

        const caller = await resolveUser(req);
        if (!caller) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const callerFull = await getAuthSession(req);
        const callerEmail = callerFull?.email ?? "";

        const body = await req.json() as { reason?: string; returnImages?: string[] };
        if (!body.reason?.trim()) {
            return NextResponse.json({ error: "Return reason is required" }, { status: 400 });
        }

        await connectDB();
        await initializeOrdersCollection();
        await initializeReturnRequestsCollection();

        const ordersCol  = await getOrdersCollection();
        const returnCol  = await getReturnRequestsCollection();
        const isAdmin    = caller.userType === "admin" || caller.userType === "superadmin";

        const order = await ordersCol.findOne({ orderNumber });
        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        // Authorization: buyer or admin
        if (!isAdmin && order.userId !== caller.userId && order.userEmail !== callerEmail) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Must be delivered
        if (order.status !== "delivered") {
            return NextResponse.json(
                { error: "Return requests can only be made for delivered orders" },
                { status: 400 }
            );
        }

        // Must be within return window
        const deliveredAt = getDeliveredAt(order);
        if (!deliveredAt) {
            return NextResponse.json(
                { error: "Delivery date could not be determined" },
                { status: 400 }
            );
        }

        if (!withinReturnWindow(deliveredAt)) {
            return NextResponse.json(
                { error: `Return window has expired. Returns must be requested within ${RETURN_WINDOW_DAYS} days of delivery.` },
                { status: 400 }
            );
        }

        // One open return per order
        const existing = await returnCol.findOne({
            orderNumber,
            status: { $in: ["pending_seller", "pending_admin"] },
        });
        if (existing) {
            return NextResponse.json(
                { error: "A return request is already open for this order" },
                { status: 409 }
            );
        }

        const now = new Date();
        const doc = {
            orderNumber,
            orderId:         String(order._id),
            userId:          caller.userId,
            userEmail:       callerEmail || order.userEmail,
            reason:          body.reason.trim(),
            returnImages:    Array.isArray(body.returnImages) ? body.returnImages : [],
            status:          "pending_seller" as const,
            sellerNote:      "",
            adminNote:       "",
            deliveredAt,
            refundProcessed: false,
            createdAt:       now,
            updatedAt:       now,
        };

        const result = await returnCol.insertOne(doc);

        // Add a timeline entry to the order
        await ordersCol.updateOne(
            { orderNumber },
            {
                $set:  { updatedAt: now },
                $push: {
                    timeline: {
                        status:        "return_requested",
                        note:          `Return request submitted. Reason: ${body.reason.trim()}`,
                        createdBy:     caller.userId,
                        createdByName: "Buyer",
                        createdAt:     now,
                    },
                } as any,
            }
        );

        return NextResponse.json({
            success: true,
            returnRequestId: result.insertedId.toString(),
        });
    } catch (err) {
        console.error("Return POST error:", err);
        return NextResponse.json({ error: "Failed to submit return request" }, { status: 500 });
    }
}

// ── GET — fetch return request(s) for this order ──────────────────────────────

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ orderNumber: string }> }
): Promise<Response> {
    try {
        const { orderNumber } = await params;
        if (!orderNumber) {
            return NextResponse.json({ error: "Order number required" }, { status: 400 });
        }

        const caller = await resolveUser(req);
        if (!caller) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();
        await initializeReturnRequestsCollection();
        await initializeOrdersCollection();

        const returnCol = await getReturnRequestsCollection();
        const ordersCol = await getOrdersCollection();
        const isAdmin   = caller.userType === "admin" || caller.userType === "superadmin";

        const order = await ordersCol.findOne({ orderNumber });
        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        // Sellers can view return requests if they have items in the order
        const isSeller  = caller.userType === "seller";
        const isSellerInOrder = isSeller && order.items.some(
            (item: any) => item.uploadedBy === caller.userId
        );

        const callerFull2 = await getAuthSession(req);
        const callerEmail2 = callerFull2?.email ?? "";

        if (!isAdmin && !isSellerInOrder && order.userId !== caller.userId && order.userEmail !== callerEmail2) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Return window info
        const deliveredAt = getDeliveredAt(order);
        const withinWindow = deliveredAt ? withinReturnWindow(deliveredAt) : false;
        const returnDeadline = deliveredAt
            ? new Date(deliveredAt.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
            : null;

        const requests = await returnCol
            .find({ orderNumber })
            .sort({ createdAt: -1 })
            .toArray();

        return NextResponse.json({
            returnRequests: requests.map((r) => ({
                ...r,
                _id:       r._id?.toString(),
                deliveredAt: r.deliveredAt instanceof Date ? r.deliveredAt.toISOString() : r.deliveredAt,
                sellerRespondedAt: r.sellerRespondedAt instanceof Date ? r.sellerRespondedAt.toISOString() : (r.sellerRespondedAt ?? null),
                adminRespondedAt:  r.adminRespondedAt  instanceof Date ? r.adminRespondedAt.toISOString()  : (r.adminRespondedAt  ?? null),
                createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
                updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
            })),
            withinReturnWindow: withinWindow,
            returnDeadline,
            deliveredAt: deliveredAt?.toISOString() ?? null,
        });
    } catch (err) {
        console.error("Return GET error:", err);
        return NextResponse.json({ error: "Failed to fetch return request" }, { status: 500 });
    }
}
