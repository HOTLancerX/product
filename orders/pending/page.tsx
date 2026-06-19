"use client";
import OrdersTable from '../OrdersTable';
export default function PendingOrdersPage() {
    return <OrdersTable defaultStatus="pending" title="Pending Orders" showStatusFilter={false} />;
}
