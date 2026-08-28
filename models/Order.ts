import { ObjectId, Collection } from 'mongodb';
import { getCollection } from '@/lib/mongodb';

export interface OrderTimeline {
    status: string;
    note: string;
    createdBy: string; // User ID
    createdByName: string;
    createdAt: Date;
}

export interface OrderItem {
    productId: string;
    productSlug: string;
    productTitle: string;
    productImage?: string;
    variantId?: string;
    variantOptions?: Record<string, string>;
    sku?: string;
    price: number;
    quantity: number;
    subtotal: number;
    uploadedBy?: string; // User ID who uploaded the product
}

export interface ShippingAddress {
    name: string;
    phone: string;
    email: string;
    address: string;
    state: string;
    city: string;
    zipCode?: string;
}

export interface OrderMetadata {
    ipAddress?: string;
    userAgent?: string;
    device?: string;
    browser?: string;
    os?: string;
    location?: string;
}

export interface Order {
    _id?: ObjectId;
    orderNumber: string; // Unique order number
    userId?: string; // Optional for guest checkout
    userEmail: string;

    items: OrderItem[];

    shippingAddress: ShippingAddress;
    shippingMethod: 'inside' | 'outside';
    shippingCost: number;

    subtotal: number;
    total: number;

    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
    paymentMethod?: string;
    paymentGatewayType?: string;
    paymentProof?: {
        transactionId?: string;
        paymentInfo?: string;
        proofImage?: string;
    };

    timeline: OrderTimeline[];
    metadata?: OrderMetadata & Record<string, any>;

    courier?: {
        provider?: 'pathao' | 'steadfast' | 'ecourier' | 'paperfly' | 'redx' | string;
        consignmentId?: string;
        trackingCode?: string;
        invoice?: string;
        status?: string;
        statusDetail?: string;
        deliveryFee?: number;
        lastSyncAt?: Date | string;
        logs?: Array<{ date: Date | string; status: string; note: string }>;
        [key: string]: any;
    };

    notes?: string;

    inventoryUpdated: boolean; // Track if inventory was deducted

    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION_NAME = 'orders';

export async function getOrdersCollection(): Promise<Collection<Order>> {
    return getCollection<Order>(COLLECTION_NAME);
}

let indexesCreated = false;
export async function initializeOrdersCollection() {
    if (indexesCreated) return;

    try {
        const collection = await getOrdersCollection();

        // Check if collection exists by trying to get indexes
        let existingIndexes;
        try {
            existingIndexes = await collection.indexes();
        } catch (error: any) {
            // Collection doesn't exist yet (NamespaceNotFound error)
            if (error.code === 26 || error.codeName === 'NamespaceNotFound') {
                // Collection will be created automatically on first insert
                // Just mark indexes as "created" to avoid repeated attempts
                indexesCreated = true;
                return;
            }
            throw error;
        }

        const indexNames = existingIndexes.map(idx => idx.name);

        // Only create indexes if they don't exist
        if (!indexNames.includes('orderNumber_1')) {
            await collection.createIndex({ orderNumber: 1 }, { unique: true });
            await collection.createIndex({ userId: 1 });
            await collection.createIndex({ userEmail: 1 });
            await collection.createIndex({ status: 1 });
            await collection.createIndex({ createdAt: -1 });
        }

        indexesCreated = true;
    } catch (error) {
        console.error('Error creating orders indexes:', error);
    }
}

// Generate unique order number
export function generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
}
