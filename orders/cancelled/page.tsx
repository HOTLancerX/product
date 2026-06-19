"use client";
import OrdersTable from '../OrdersTable';
export default function CancelledOrdersPage() {
    return <OrdersTable defaultStatus="cancelled" title="Cancelled Orders" showStatusFilter={false} />;
}
