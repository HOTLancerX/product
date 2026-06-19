"use client";
import OrdersTable from '../OrdersTable';
export default function ShippedOrdersPage() {
    return <OrdersTable defaultStatus="shipped" title="Shipped Orders" showStatusFilter={false} />;
}
