'use client';

import dynamic from 'next/dynamic';

// ssr: false is only valid inside a Client Component.
// This wrapper exists solely to let the server-component header include Cart.
const Cart = dynamic(() => import('@/plugin/product/cart/Cart'), { ssr: false });

export default function CartButton({ fontSize = 22, color = '#374151' }: { fontSize?: number; color?: string }) {
    return <Cart fontSize={fontSize} color={color} />;
}
