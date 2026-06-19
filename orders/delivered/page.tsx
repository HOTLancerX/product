"use client";
import OrdersTable from '../OrdersTable';
export default function DeliveredOrdersPage() {
    return <OrdersTable defaultStatus="delivered" title="Delivered Orders" showStatusFilter={false} />;
}
