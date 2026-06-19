"use client";
import OrdersTable from '../OrdersTable';
export default function ProcessingOrdersPage() {
    return <OrdersTable defaultStatus="processing" title="Processing Orders" showStatusFilter={false} />;
}
