"use client";
import OrdersTable from './OrdersTable';
export default function AdminOrdersPage() {
    return <OrdersTable title="All Orders" showStatusFilter={true} />;
}
