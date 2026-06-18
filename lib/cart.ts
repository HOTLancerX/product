// Client-side cart management using localStorage

export interface CartItem {
    productId: string;
    productSlug: string;
    productTitle: string;
    productImage?: string;
    variantId?: string;
    variantOptions?: Record<string, string>;
    sku?: string;
    price: number;
    quantity: number;
    maxQuantity: number;
    shippingInside?: number;
    shippingOutside?: number;
    orderNote?: string;
}

const CART_KEY = 'shopping_cart';

export function getCart(): CartItem[] {
    if (typeof window === 'undefined') return [];

    try {
        const cart = localStorage.getItem(CART_KEY);
        return cart ? JSON.parse(cart) : [];
    } catch {
        return [];
    }
}

export function saveCart(cart: CartItem[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function addToCart(item: CartItem): void {
    const cart = getCart();

    // Check if item already exists (same product and variant)
    const existingIndex = cart.findIndex(
        (i) => i.productId === item.productId &&
            i.variantId === item.variantId
    );

    if (existingIndex > -1) {
        // Update quantity
        const newQuantity = cart[existingIndex].quantity + item.quantity;
        cart[existingIndex].quantity = Math.min(newQuantity, item.maxQuantity);
    } else {
        // Add new item
        cart.push(item);
    }

    saveCart(cart);

    // Dispatch custom event for cart update
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cartUpdated'));
    }
}

export function updateCartItemQuantity(productId: string, variantId: string | undefined, quantity: number): void {
    const cart = getCart();
    const index = cart.findIndex(
        (i) => i.productId === productId && i.variantId === variantId
    );

    if (index > -1) {
        if (quantity <= 0) {
            cart.splice(index, 1);
        } else {
            cart[index].quantity = Math.min(quantity, cart[index].maxQuantity);
        }
        saveCart(cart);

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('cartUpdated'));
        }
    }
}

export function removeFromCart(productId: string, variantId: string | undefined): void {
    const cart = getCart();
    const filtered = cart.filter(
        (i) => !(i.productId === productId && i.variantId === variantId)
    );
    saveCart(filtered);

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cartUpdated'));
    }
}

export function clearCart(): void {
    saveCart([]);

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cartUpdated'));
    }
}

export function getCartCount(): number {
    const cart = getCart();
    return cart.reduce((sum, item) => sum + item.quantity, 0);
}

export function getCartTotal(): number {
    const cart = getCart();
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}
