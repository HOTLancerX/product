/**
 * ReturnRequest — a buyer-initiated return after delivery.
 *
 * Flow:
 *   user submits → status: "pending_seller"
 *   seller accepts  → status: "pending_admin"
 *   seller rejects  → status: "rejected_seller"   (terminal)
 *   admin  accepts  → status: "approved"           (triggers refund)
 *   admin  rejects  → status: "rejected_admin"     (terminal)
 *
 * Return window: 7 days after the order's deliveredAt timestamp.
 */

import { ObjectId, Collection } from "mongodb";
import { getCollection } from "@/lib/mongodb";

export interface ReturnRequest {
    _id?: ObjectId;
    orderNumber: string;
    orderId: string;        // order._id as string
    userId: string;         // buyer
    userEmail: string;

    reason: string;         // buyer's reason text
    returnImages?: string[]; // optional proof images

    status:
        | "pending_seller"   // waiting for seller
        | "pending_admin"    // seller approved, waiting for admin
        | "approved"         // admin approved → refund triggered
        | "rejected_seller"  // seller rejected
        | "rejected_admin";  // admin rejected

    sellerNote?: string;
    adminNote?: string;

    sellerRespondedAt?: Date;
    adminRespondedAt?: Date;

    deliveredAt: Date;      // snapshot of when the order was delivered
    refundProcessed: boolean; // true once wallet balances have been zeroed

    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION_NAME = "return_requests";

export async function getReturnRequestsCollection(): Promise<Collection<ReturnRequest>> {
    return getCollection<ReturnRequest>(COLLECTION_NAME);
}

let indexesCreated = false;
export async function initializeReturnRequestsCollection() {
    if (indexesCreated) return;
    try {
        const col = await getReturnRequestsCollection();
        let existing;
        try {
            existing = await col.indexes();
        } catch (err: any) {
            if (err.code === 26 || err.codeName === "NamespaceNotFound") {
                indexesCreated = true;
                return;
            }
            throw err;
        }
        const names = existing.map((i) => i.name);
        if (!names.includes("orderNumber_1")) {
            await col.createIndex({ orderNumber: 1 });
            await col.createIndex({ userId: 1 });
            await col.createIndex({ status: 1 });
            await col.createIndex({ createdAt: -1 });
        }
        indexesCreated = true;
    } catch (err) {
        console.error("Error creating return_requests indexes:", err);
    }
}
