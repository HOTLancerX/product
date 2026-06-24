/**
 * /api/returns
 *
 * GET  — list return requests (admin: all; seller: own; user: own)
 * PUT  — respond to a return request
 *
 * Seller response:
 *   body: { id, action: "accept" | "reject", note? }
 *   "accept" → status: "pending_admin"
 *   "reject" → status: "rejected_seller"
 *
 * Admin response:
 *   body: { id, action: "approve" | "reject", note? }
 *   "approve" → status: "approved"
 *     - cancels the order
 *     - reverses seller's pending/available balance for the order
 *     - sets payment status to "refunded"
 *     - sets refundProcessed: true
 *   "reject" → status: "rejected_admin"
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import connectDB from "@/lib/mongodb";
import {
    getReturnRequestsCollection,
    initializeReturnRequestsCollection,
} from "@/plugin/product/models/ReturnRequest";
import {
    getOrdersCollection,
    initializeOrdersCollection,
} from "@/plugin/product/models/Order";
import { getTransactionModel } from "@/plugin/seller/models/Transaction";
import { updateWallet } from "@/plugin/seller/models/Wallet";
import PostInfo from "@/models/post_info";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

// ── GET — list return requests ────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
    try {
        const caller = await resolveUser(req);
        if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectDB();
        await initializeReturnRequestsCollection();
        await initializeOrdersCollection();

        const returnCol  = await getReturnRequestsCollection();
        const ordersCol  = await getOrdersCollection();
        const isAdmin    = caller.userType === "admin" || caller.userType === "superadmin";
        const isSeller   = caller.userType === "seller";

        const { searchParams } = new URL(req.url);
        const statusFilter = searchParams.get("status") ?? "";
        const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
        const limit  = 20;
        const skip   = (page - 1) * limit;

        const query: Record<string, any> = {};
        if (statusFilter) query.status = statusFilter;

        if (isAdmin) {
            // Admin sees all
        } else if (isSeller) {
            // Seller sees return requests for orders that contain their products
            const infoMatches = await PostInfo.find({ name: "userId", value: caller.userId })
                .select("postId").lean() as any[];
            const sellerProductIds = infoMatches.map((p: any) => String(p.postId)).filter(Boolean);

            const sellerOrders = await ordersCol.find({
                $or: [
                    { "items.uploadedBy": caller.userId },
                    ...(sellerProductIds.length > 0
                        ? [{ "items.productId": { $in: sellerProductIds } }]
                        : []),
                ],
            }).project({ orderNumber: 1 }).toArray();

            const sellerOrderNumbers = sellerOrders.map((o) => o.orderNumber);
            if (sellerOrderNumbers.length === 0) {
                return NextResponse.json({ returnRequests: [], total: 0, pages: 0, page });
            }
            query.orderNumber = { $in: sellerOrderNumbers };
        } else {
            // Regular user sees only their own
            query.userId = caller.userId;
        }

        const [docs, total] = await Promise.all([
            returnCol.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            returnCol.countDocuments(query),
        ]);

        return NextResponse.json({
            returnRequests: docs.map((r) => ({
                ...r,
                _id:       r._id?.toString(),
                deliveredAt: r.deliveredAt instanceof Date ? r.deliveredAt.toISOString() : r.deliveredAt,
                sellerRespondedAt: r.sellerRespondedAt instanceof Date ? r.sellerRespondedAt.toISOString() : (r.sellerRespondedAt ?? null),
                adminRespondedAt:  r.adminRespondedAt  instanceof Date ? r.adminRespondedAt.toISOString()  : (r.adminRespondedAt  ?? null),
                createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
                updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
            })),
            total,
            pages: Math.ceil(total / limit),
            page,
        });
    } catch (err) {
        console.error("Returns GET error:", err);
        return NextResponse.json({ error: "Failed to fetch return requests" }, { status: 500 });
    }
}

// ── PUT — seller or admin responds ───────────────────────────────────────────

export async function PUT(req: NextRequest): Promise<Response> {
    try {
        const caller = await resolveUser(req);
        if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const isAdmin  = caller.userType === "admin" || caller.userType === "superadmin";
        const isSeller = caller.userType === "seller";

        if (!isAdmin && !isSeller) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json() as {
            id: string;
            action: string;
            note?: string;
        };

        if (!body.id || !body.action) {
            return NextResponse.json({ error: "id and action are required" }, { status: 400 });
        }

        if (!mongoose.isValidObjectId(body.id)) {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

        await connectDB();
        await initializeReturnRequestsCollection();
        await initializeOrdersCollection();

        const returnCol = await getReturnRequestsCollection();
        const ordersCol = await getOrdersCollection();
        const { ObjectId } = await import("mongodb");

        const returnReq = await returnCol.findOne({ _id: new ObjectId(body.id) });
        if (!returnReq) {
            return NextResponse.json({ error: "Return request not found" }, { status: 404 });
        }

        const now = new Date();

        // ── Seller response ───────────────────────────────────────────────────
        if (isSeller && !isAdmin) {
            if (returnReq.status !== "pending_seller") {
                return NextResponse.json(
                    { error: "This return request is not awaiting seller response" },
                    { status: 400 }
                );
            }

            // Verify seller owns at least one item in this order
            const order = await ordersCol.findOne({ orderNumber: returnReq.orderNumber });
            if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

            const isSellerInOrder = order.items.some((item: any) => item.uploadedBy === caller.userId);
            if (!isSellerInOrder) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }

            if (!["accept", "reject"].includes(body.action)) {
                return NextResponse.json(
                    { error: "Seller action must be 'accept' or 'reject'" },
                    { status: 400 }
                );
            }

            const newStatus = body.action === "accept" ? "pending_admin" : "rejected_seller";
            await returnCol.updateOne(
                { _id: new ObjectId(body.id) },
                {
                    $set: {
                        status:              newStatus,
                        sellerNote:          body.note?.trim() ?? "",
                        sellerRespondedAt:   now,
                        updatedAt:           now,
                    },
                }
            );

            // Timeline entry
            await ordersCol.updateOne(
                { orderNumber: returnReq.orderNumber },
                {
                    $set:  { updatedAt: now },
                    $push: {
                        timeline: {
                            status:        `return_${body.action === "accept" ? "accepted_by_seller" : "rejected_by_seller"}`,
                            note:          body.action === "accept"
                                ? `Seller accepted the return request. ${body.note ? "Note: " + body.note : ""}`.trim()
                                : `Seller rejected the return request. ${body.note ? "Reason: " + body.note : ""}`.trim(),
                            createdBy:     caller.userId,
                            createdByName: "Seller",
                            createdAt:     now,
                        },
                    } as any,
                }
            );

            return NextResponse.json({ success: true, status: newStatus });
        }

        // ── Admin response ────────────────────────────────────────────────────
        if (isAdmin) {
            if (returnReq.status !== "pending_admin") {
                return NextResponse.json(
                    { error: "This return request is not awaiting admin response" },
                    { status: 400 }
                );
            }

            if (!["approve", "reject"].includes(body.action)) {
                return NextResponse.json(
                    { error: "Admin action must be 'approve' or 'reject'" },
                    { status: 400 }
                );
            }

            if (body.action === "reject") {
                await returnCol.updateOne(
                    { _id: new ObjectId(body.id) },
                    {
                        $set: {
                            status:            "rejected_admin",
                            adminNote:         body.note?.trim() ?? "",
                            adminRespondedAt:  now,
                            updatedAt:         now,
                        },
                    }
                );

                const order = await ordersCol.findOne({ orderNumber: returnReq.orderNumber });
                if (order) {
                    await ordersCol.updateOne(
                        { orderNumber: returnReq.orderNumber },
                        {
                            $set:  { updatedAt: now },
                            $push: {
                                timeline: {
                                    status:        "return_rejected_by_admin",
                                    note:          `Admin rejected the return request. ${body.note ? "Reason: " + body.note : ""}`.trim(),
                                    createdBy:     caller.userId,
                                    createdByName: "Admin",
                                    createdAt:     now,
                                },
                            } as any,
                        }
                    );
                }

                return NextResponse.json({ success: true, status: "rejected_admin" });
            }

            // ── APPROVE — trigger refund ──────────────────────────────────────
            const order = await ordersCol.findOne({ orderNumber: returnReq.orderNumber });
            if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

            if (returnReq.refundProcessed) {
                return NextResponse.json({ error: "Refund already processed" }, { status: 400 });
            }

            // 1. Cancel the order & set payment to refunded
            await ordersCol.updateOne(
                { orderNumber: returnReq.orderNumber },
                {
                    $set: {
                        status:        "cancelled",
                        paymentStatus: "refunded",
                        updatedAt:     now,
                    },
                    $push: {
                        timeline: {
                            status:        "return_approved",
                            note:          `Return approved by admin. Order cancelled and refund initiated. ${body.note ? "Note: " + body.note : ""}`.trim(),
                            createdBy:     caller.userId,
                            createdByName: "Admin",
                            createdAt:     now,
                        },
                    } as any,
                }
            );

            // 2. Reverse seller wallet transactions for this order
            //    Find ALL seller credit transactions for this order
            const TxModel = getTransactionModel();
            const sellerTxs = await TxModel.find({
                orderNumber: returnReq.orderNumber,
                type:        "credit",
                status:      { $in: ["pending", "available"] },
            }).lean() as any[];

            for (const tx of sellerTxs) {
                if (tx.status === "pending") {
                    // Still in hold — just cancel it, reduce pendingBalance
                    await TxModel.updateOne(
                        { _id: tx._id },
                        { $set: { status: "cancelled", note: `Reversed: return approved for order ${returnReq.orderNumber}` } }
                    );
                    await updateWallet(tx.userId, { pendingBalance: -tx.amount });
                } else if (tx.status === "available") {
                    // Already released to balance — deduct from balance
                    // 90% rule: the seller already received their commission-reduced amount.
                    // Reverse the full credited amount from balance.
                    await TxModel.updateOne(
                        { _id: tx._id },
                        { $set: { status: "cancelled", note: `Reversed: return approved for order ${returnReq.orderNumber}` } }
                    );
                    await updateWallet(tx.userId, { balance: -tx.amount, totalEarned: -tx.amount });

                    // Create a debit transaction for the reversal record
                    await TxModel.create({
                        userId:         tx.userId,
                        orderId:        tx.orderId,
                        orderNumber:    returnReq.orderNumber,
                        type:           "debit",
                        status:         "paid",
                        gross:          tx.gross,
                        commissionRate: tx.commissionRate,
                        adminAmount:    tx.adminAmount,
                        amount:         tx.amount,
                        note:           `Return refund reversal for order ${returnReq.orderNumber}`,
                        createdAt:      now,
                        updatedAt:      now,
                    });
                }
            }

            // 3. Mark return request as approved + refund processed
            await returnCol.updateOne(
                { _id: new ObjectId(body.id) },
                {
                    $set: {
                        status:           "approved",
                        adminNote:        body.note?.trim() ?? "",
                        adminRespondedAt: now,
                        refundProcessed:  true,
                        updatedAt:        now,
                    },
                }
            );

            return NextResponse.json({ success: true, status: "approved" });
        }

        return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
    } catch (err) {
        console.error("Returns PUT error:", err);
        return NextResponse.json({ error: "Failed to process return request" }, { status: 500 });
    }
}
