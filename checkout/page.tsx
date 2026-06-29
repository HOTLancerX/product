'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Icon } from '@iconify/react';
import { getCart, CartItem, clearCart } from '@/plugin/product/lib/cart';
import { useToast } from '@/components/ui/Toast';
import Gallery from '@/components/Gallery';
import useSettings from '@/lib/useSettings';
import type { FormHooks } from '@/hook';
import { getHooks } from '@/hook';
import { reregisterHooks } from '@/hook/PluginList';

interface Location {
    id: string;
    _id?: string;
    title: string;
    parentId?: string;
    type?: string;
    status?: string;
}

export default function CheckoutPage() {
    const router = useRouter();
    const { success, error } = useToast();
    const { settings } = useSettings();
    const currencySymbol = settings?.product_currency_symbol || settings?.currency_symbol || '';

    const checkoutFields: Array<{ key: string; name: string; desktop: string; mobile: string; required: boolean; status: boolean }> = (() => {
        const raw = settings?.checkout_fields;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { /* fall through */ }
        }
        return [
            { key: "name",           name: "Full Name",           desktop: "w-1/2",  mobile: "w-full", required: true,  status: true },
            { key: "phone",          name: "Phone Number",         desktop: "w-1/2",  mobile: "w-full", required: true,  status: true },
            { key: "email",          name: "Email",                desktop: "w-full", mobile: "w-full", required: false, status: true },
            { key: "address",        name: "Address",              desktop: "w-full", mobile: "w-full", required: false, status: true },
            { key: "state",          name: "State / Province",     desktop: "w-1/2",  mobile: "w-full", required: false, status: true },
            { key: "city",           name: "City",                 desktop: "w-1/2",  mobile: "w-full", required: false, status: true },
            { key: "zipCode",        name: "Zip Code",             desktop: "w-1/2",  mobile: "w-full", required: false, status: true },
            { key: "shippingMethod", name: "Shipping Method",      desktop: "w-full", mobile: "w-full", required: true,  status: true },
            { key: "paymentMethod",  name: "Payment Method",       desktop: "w-full", mobile: "w-full", required: true,  status: true },
            { key: "transactionId",  name: "Transaction ID",       desktop: "w-1/2",  mobile: "w-full", required: false, status: true },
            { key: "paymentInfo",    name: "Payment Details",      desktop: "w-1/2",  mobile: "w-full", required: false, status: true },
            { key: "proofImage",     name: "Payment Screenshot",   desktop: "w-full", mobile: "w-full", required: false, status: true },
            { key: "notes",          name: "Order Notes",          desktop: "w-full", mobile: "w-full", required: false, status: true },
        ];
    })();

    const fieldCfg = (key: string) => checkoutFields.find(f => f.key === key) || { status: true, required: false, desktop: "w-1/2", mobile: "w-full" }
    const fieldVisible = (key: string) => fieldCfg(key).status !== false
    const fieldRequired = (key: string) => fieldCfg(key).required === true
    const fieldCls = (key: string) => {
        const f = fieldCfg(key)
        // desktop class stored as "w-1\/2" → normalise to "w-1/2" for lookup
        const d = (f.desktop || "w-1/2").replace(/\\/g, "")
        const m = (f.mobile || "w-full").replace(/\\/g, "")
        return `${m} md:${d} px-2`
    }
    const fmt = (amount: number) =>
        `${currencySymbol} ${Number(amount).toLocaleString('en-US', {
            minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2,
        })}`.trim();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [locations, setLocations] = useState<Location[]>([]);
    const [states, setStates] = useState<Location[]>([]);
    const [cities, setCities] = useState<Location[]>([]);
    const [paymentGateways, setPaymentGateways] = useState<any[]>([]);

    // ── Plugin hook fields for checkout sections ──────────────────────────
    const [hookTop, setHookTop] = useState<FormHooks>([]);
    const [hookSection1, setHookSection1] = useState<FormHooks>([]);
    const [hookSection2, setHookSection2] = useState<FormHooks>([]);
    const [hookSection3, setHookSection3] = useState<FormHooks>([]);
    const [hookBottom, setHookBottom] = useState<FormHooks>([]);

    useEffect(() => {
        fetch('/api/admin-init', { cache: 'no-store' })
            .then(r => r.json())
            .then((data: { plugins: { nx: string; status: string }[] }) => {
                const ids = (data.plugins ?? []).filter(p => p.status === 'active').map(p => p.nx);
                reregisterHooks(ids);
                setHookTop(getHooks('checkout.top'));
                setHookSection1(getHooks('checkout.section1'));
                setHookSection2(getHooks('checkout.section2'));
                setHookSection3(getHooks('checkout.section3'));
                setHookBottom(getHooks('checkout.bottom'));
            })
            .catch(() => {});
    }, []);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        state: '',
        city: '',
        zipCode: '',
        shippingMethod: 'inside' as 'inside' | 'outside',
        paymentMethod: '',
        notes: '',
        transactionId: '',
        paymentInfo: '',
        proofImage: '',
    });

    // ── Free delivery discount (set by free-offers plugin via custom event) ──
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | null>(null);
    const [discountValue, setDiscountValue] = useState(0);

    // ── Upsell discount (set by upsell-trigger plugin via custom event) ──
    const [upsellDiscount, setUpsellDiscount] = useState(0);

    // ── 24h trigger discount (set by 24h-trigger plugin via custom event) ──
    const [triggerType, setTriggerType] = useState<string | null>(null);
    const [triggerValue, setTriggerValue] = useState(0);

    useEffect(() => {
        // Load cart
        const currentCart = getCart();
        setCart(currentCart);

        // Select all items by default
        const allKeys = currentCart.map(item => `${item.productId}-${item.variantId || 'single'}`);
        setSelectedItems(new Set(allKeys));

        // Load user data
        fetchUserData();

        // Load locations
        fetchLocations();

        // Load payment gateways
        fetchPaymentGateways();

        // Listen for free delivery discount from free-offers plugin
        const handleDiscount = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            setDiscountType(detail?.discountType ?? null);
            setDiscountValue(typeof detail?.discountValue === 'number' ? detail.discountValue : 0);
        };
        window.addEventListener('freeDeliveryDiscount', handleDiscount);

        // Listen for upsell discount from upsell-trigger plugin
        const handleUpsellDiscount = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            setUpsellDiscount(typeof detail?.discount === 'number' ? detail.discount : 0);
        };
        window.addEventListener('upsellDiscount', handleUpsellDiscount);

        // Listen for 24h trigger discount
        const handleTriggerDiscount = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            setTriggerType(detail?.triggerType ?? null);
            setTriggerValue(typeof detail?.triggerValue === 'number' ? detail.triggerValue : 0);
        };
        window.addEventListener('triggerDiscount', handleTriggerDiscount);

        return () => {
            window.removeEventListener('freeDeliveryDiscount', handleDiscount);
            window.removeEventListener('upsellDiscount', handleUpsellDiscount);
            window.removeEventListener('triggerDiscount', handleTriggerDiscount);
        };
    }, []);

    useEffect(() => {
        // Update cities when state changes
        if (formData.state) {
            const stateCities = locations.filter(loc => loc.parentId === formData.state);
            setCities(stateCities);
        } else {
            setCities([]);
        }
    }, [formData.state, locations]);

    // ── Resolve user text-based state/city → location IDs ────────────────
    useEffect(() => {
        if (!user || states.length === 0) return;
        if (!formData.state || locations.some(loc => String(loc.id) === String(formData.state))) return;

        const matchedState = states.find(
            s => s.title.toLowerCase() === String(formData.state).toLowerCase()
        );
        if (matchedState) {
            setFormData(prev => ({ ...prev, state: matchedState.id, city: '' }));
        }
    }, [user, states, locations]);

    useEffect(() => {
        if (!user || cities.length === 0 || !formData.state) return;
        if (!formData.city || locations.some(loc => String(loc.id) === String(formData.city))) return;

        const matchedCity = cities.find(
            c => c.title.toLowerCase() === String(formData.city).toLowerCase()
        );
        if (matchedCity) {
            setFormData(prev => ({ ...prev, city: matchedCity.id }));
        }
    }, [user, cities]);

    // ── Checkout History: auto-load draft by IP ──────────────────────────────
    const checkoutHistoryEnabled = settings?.checkout_history_enabled !== 'false';
    const [draftLoaded, setDraftLoaded] = useState(false);

    useEffect(() => {
        if (!checkoutHistoryEnabled || draftLoaded) return;
        fetch('/api/checkout-history', { cache: 'no-store' })
            .then(r => r.json())
            .then((data) => {
                if (data.draft) {
                    setFormData(prev => ({
                        ...prev,
                        name:          data.draft.name          || prev.name,
                        phone:         data.draft.phone         || prev.phone,
                        email:         data.draft.email         || prev.email,
                        address:       data.draft.address       || prev.address,
                        state:         data.draft.state         || prev.state,
                        city:          data.draft.city          || prev.city,
                        zipCode:       data.draft.zipCode       || prev.zipCode,
                        shippingMethod:(data.draft.shippingMethod as 'inside' | 'outside') || prev.shippingMethod,
                        paymentMethod: data.draft.paymentMethod || prev.paymentMethod,
                        notes:         data.draft.notes         || prev.notes,
                    }));
                }
            })
            .catch(() => {})
            .finally(() => setDraftLoaded(true));
    }, [checkoutHistoryEnabled, draftLoaded]);

    // ── Checkout History: auto-save draft on change (debounced) ──────────────
    useEffect(() => {
        if (!checkoutHistoryEnabled || !draftLoaded) return;
        const { name, phone, email } = formData;
        if (!name && !phone && !email) return;

        const timer = setTimeout(() => {
            fetch('/api/checkout-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            }).catch(() => {});
        }, 1000);

        return () => clearTimeout(timer);
    }, [formData, checkoutHistoryEnabled, draftLoaded]);

    const fetchUserData = async () => {
        try {
            const res = await fetch('/api/auth/session');
            if (res.ok) {
                const data = await res.json();
                // NextAuth /api/auth/session returns { user: {...} } when logged in, or {} when not
                if (data?.user) {
                    setUser(data.user);
                    // Pre-fill form with user data including address information
                    setFormData(prev => ({
                        ...prev,
                        name: data.user.name || '',
                        email: data.user.email || '',
                        phone: data.user.phone || '',
                        address: data.user.address || '',
                        state: data.user.state || '',
                        city: data.user.city || '',
                        zipCode: data.user.zipCode || '',
                    }));
                }
            }
        } catch (err) {
            console.error('Failed to fetch user data:', err);
        }
    };

    const fetchLocations = async () => {
        try {
            const res = await fetch('/api/location/category?type=location&status=published');
            if (res.ok) {
                const data = await res.json();
                const locs = (data.categories || []).map((loc: any) => ({
                    ...loc,
                    id: loc.id || loc._id // Ensure id field exists
                }));
                setLocations(locs);

                // Filter states (no parentId) - these are parent locations
                const stateList = locs.filter((loc: Location) => !loc.parentId);
                setStates(stateList);
            }
        } catch (err) {
            console.error('Failed to fetch locations:', err);
        }
    };

    const fetchPaymentGateways = async () => {
        try {
            const res = await fetch('/api/payment');
            if (res.ok) {
                const data = await res.json();
                setPaymentGateways(data.gateways || []);
                // Set first gateway as default
                if (data.gateways && data.gateways.length > 0) {
                    setFormData(prev => ({ ...prev, paymentMethod: data.gateways[0].type }));
                }
            }
        } catch (err) {
            console.error('Failed to fetch payment gateways:', err);
        }
    };

    const updateQuantity = (itemKey: string, delta: number) => {
        const newCart = cart.map(cartItem => {
            const key = `${cartItem.productId}-${cartItem.variantId || 'single'}`;
            if (key !== itemKey) return cartItem;
            const next = cartItem.quantity + delta;
            if (next < 1) return cartItem;
            return { ...cartItem, quantity: Math.min(next, cartItem.maxQuantity) };
        });
        setCart(newCart);
        localStorage.setItem('shopping_cart', JSON.stringify(newCart));
        window.dispatchEvent(new Event('cartUpdated'));
    };

    const updateItemNote = (itemKey: string, note: string) => {
        const newCart = cart.map(cartItem => {
            const key = `${cartItem.productId}-${cartItem.variantId || 'single'}`;
            if (key !== itemKey) return cartItem;
            return { ...cartItem, orderNote: note };
        });
        setCart(newCart);
        localStorage.setItem('shopping_cart', JSON.stringify(newCart));
    };

    const toggleItemSelection = (itemKey: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(itemKey)) {
            newSelected.delete(itemKey);
        } else {
            newSelected.add(itemKey);
        }
        setSelectedItems(newSelected);
    };

    const getSelectedItems = () => {
        return cart.filter(item => {
            const itemKey = `${item.productId}-${item.variantId || 'single'}`;
            return selectedItems.has(itemKey);
        });
    };

    const calculateSubtotal = () => {
        return getSelectedItems().reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    const calculateBaseShipping = () => {
        const selectedCartItems = getSelectedItems();
        if (selectedCartItems.length === 0) return 0;

        const freeShippingMin = parseFloat(settings?.product_free_shipping_min as string) || 0;
        const subtotal = calculateSubtotal();
        if (freeShippingMin > 0 && subtotal >= freeShippingMin) return 0;

        const globalInsideRate  = parseFloat(settings?.shipping_inside_rate  as string) || 0;
        const globalOutsideRate = parseFloat(settings?.shipping_outside_rate as string) || 0;

        return selectedCartItems.reduce((sum, item) => {
            let shippingCost: number;
            if (formData.shippingMethod === 'inside') {
                shippingCost = item.shippingInside ?? globalInsideRate;
            } else {
                shippingCost = item.shippingOutside ?? globalOutsideRate;
            }
            return sum + (shippingCost * item.quantity);
        }, 0);
    };

    const calculateShipping = () => {
        const baseShipping = calculateBaseShipping();
        if (baseShipping === 0) return 0;

        // 24h trigger: free delivery
        if (triggerType === 'free_delivery') return 0;

        if (discountType === 'fixed') {
            return Math.max(0, baseShipping - discountValue);
        }
        if (discountType === 'percentage') {
            return Math.max(0, baseShipping - (baseShipping * discountValue / 100));
        }
        return baseShipping;
    };

    const calculateTriggerDiscount = () => {
        const sub = calculateSubtotal();
        if (triggerType === 'fixed_discount') return triggerValue;
        if (triggerType === 'percentage_discount') return Math.round((sub * triggerValue / 100) * 100) / 100;
        return 0;
    };

    const calculateTotal = () => {
        return Math.max(0, calculateSubtotal() + calculateShipping() - upsellDiscount - calculateTriggerDiscount());
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const selectedCartItems = getSelectedItems();
        if (selectedCartItems.length === 0) {
            error('Please select at least one item to checkout');
            return;
        }

        if (!formData.name || !formData.phone) {
            error('Please fill in all required fields (Name and Phone)');
            return;
        }

        if (!formData.paymentMethod) {
            error('Please select a payment method');
            return;
        }

        setLoading(true);

        try {
            const orderData = {
                items: selectedCartItems.map(item => ({
                    productId: item.productId,
                    productSlug: item.productSlug,
                    productTitle: item.productTitle,
                    productImage: item.productImage,
                    variantId: item.variantId,
                    variantOptions: item.variantOptions,
                    sku: item.sku,
                    price: item.price,
                    quantity: item.quantity,
                    subtotal: item.price * item.quantity,
                    orderNote: item.orderNote || '',
                })),
                shippingAddress: {
                    name: formData.name,
                    phone: formData.phone,
                    email: formData.email,
                    address: formData.address,
                    state: formData.state,
                    city: formData.city,
                    zipCode: formData.zipCode,
                },
                shippingMethod: formData.shippingMethod,
                shippingCost: calculateShipping(),
                subtotal: calculateSubtotal(),
                upsellDiscount: upsellDiscount,
                triggerDiscount: calculateTriggerDiscount(),
                triggerType: triggerType || undefined,
                total: calculateTotal(),
                paymentMethod: formData.paymentMethod,
                transactionId: formData.transactionId,
                paymentInfo: formData.paymentInfo,
                proofImage: formData.proofImage,
                notes: formData.notes,
            };

            // Online payment redirect flow (e.g. Stripe)
            const selectedGw = paymentGateways.find(g => g.type === formData.paymentMethod);
            if (selectedGw?.isOnline) {
                const apiMap: Record<string, string> = { stripe: '/api/stripe/checkout', paypal: '/api/paypal/checkout' };
                const apiEndpoint = apiMap[formData.paymentMethod];
                if (apiEndpoint) {
                    const onlineRes = await fetch(apiEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(orderData),
                    });
                    const onlineData = await onlineRes.json();
                    if (onlineRes.ok && onlineData.url) {
                        window.location.href = onlineData.url;
                        return;
                    }
                    error(onlineData.error || 'Failed to initiate payment');
                    setLoading(false);
                    return;
                }
            }

            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData),
            });

            const data = await res.json();

            if (res.ok) {
                success('Order placed successfully!');

                // Clear checkout history draft after successful order
                if (checkoutHistoryEnabled) {
                    fetch('/api/checkout-history', { method: 'DELETE' }).catch(() => {});
                }

                // Activate 24h trigger for this user/guest
                try {
                    const activateBody: Record<string, string> = {
                        orderNumber: data.orderNumber,
                    };
                    if (user?.id) {
                        activateBody.identifier = user.id;
                        activateBody.identifierType = 'user';
                    }
                    // For guests: no identifier — server extracts IP from headers
                    fetch('/api/24h-trigger/activate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(activateBody),
                    }).catch(() => {});
                } catch { /* ignore */ }

                // Remove ordered items from cart
                const remainingCart = cart.filter(item => {
                    const itemKey = `${item.productId}-${item.variantId || 'single'}`;
                    return !selectedItems.has(itemKey);
                });

                if (remainingCart.length === 0) {
                    clearCart();
                } else {
                    localStorage.setItem('shopping_cart', JSON.stringify(remainingCart));
                    window.dispatchEvent(new Event('cartUpdated'));
                }

                // Redirect to order confirmation
                router.push(`/order-confirmation/${data.orderNumber}`);
            } else {
                error(data.error || 'Failed to place order');
            }
        } catch (err) {
            error('An error occurred while placing your order');
        } finally {
            setLoading(false);
        }
    };

    if (cart.length === 0) {
        return (
            <div className="container py-16">
                <div className="max-w-2xl mx-auto text-center">
                    <Icon icon="mdi:cart-outline" width="80" height="80" className="mx-auto mb-4 text-gray-400" />
                    <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
                    <p className="text-gray-600 mb-8">Add some products to your cart to checkout</p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Continue Shopping
                    </button>
                </div>

                {hookBottom.length > 0 && (
                    <div className="mt-8 space-y-6">
                        {hookBottom.map((field) => {
                            const Component = field.component;
                            if (!Component) return null;
                            return <Component key={`${field.key}-${field.position}`} />;
                        })}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="container py-8">
            {/* ── Plugin hook: checkout.top ── */}
            {hookTop.map((field) => {
                const Component = field.component;
                if (!Component) return null;
                return <Component key={`${field.key}-${field.position}`} />;
            })}

            <h1 className="text-3xl font-bold mb-8">Checkout</h1>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:grid-rows-[min-content_1fr] min">
                    {/* Left Column - Order Items & Shipping Info */}
                    <div className="md:col-span-2 space-y-6">
                        {/* Order Items */}
                        <div className="bg-white rounded-lg shadow p-2 md:p-6">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Icon icon="mdi:package-variant" width="24" height="24" />
                                Order Items
                            </h2>

                            <div className="space-y-4">
                                {cart.map((item) => {
                                    const itemKey = `${item.productId}-${item.variantId || 'single'}`;
                                    const isSelected = selectedItems.has(itemKey);

                                    return (
                                        <div
                                            key={itemKey}
                                            className={`rounded-xl border transition-all ${isSelected ? 'border-blue-400 bg-blue-50/60' : 'border-gray-200 bg-white'}`}
                                        >
                                            {/* Top row: checkbox + image + title + delete */}
                                            <div className="flex gap-3 p-3">

                                                {/* Image */}
                                                {item.productImage && (
                                                    <div className="relative w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                                                        <Image
                                                            src={item.productImage}
                                                            alt={item.productTitle}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                )}

                                                {/* Title + variants */}
                                                <div className="flex-1 flex flex-col items-start justify-center min-w-0">
                                                    <h3 className="font-semibold text-sm md:text-base leading-snug line-clamp-2">{item.productTitle}</h3>
                                                    {item.variantOptions && Object.keys(item.variantOptions).length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {Object.entries(item.variantOptions).map(([key, value]) => (
                                                                <span key={key} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                                    {key}: <span className="font-medium text-gray-800">{value}</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Checkbox */}
                                                <div className='flex flex-col items-center justify-center gap-4'>
                                                    <div className="flex items-start shrink-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleItemSelection(itemKey)}
                                                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                    </div>
                                                    {/* Delete */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newCart = cart.filter(cartItem => {
                                                                const cartItemKey = `${cartItem.productId}-${cartItem.variantId || 'single'}`;
                                                                return cartItemKey !== itemKey;
                                                            });
                                                            setCart(newCart);
                                                            localStorage.setItem('shopping_cart', JSON.stringify(newCart));
                                                            window.dispatchEvent(new Event('cartUpdated'));
                                                            const newSelected = new Set(selectedItems);
                                                            newSelected.delete(itemKey);
                                                            setSelectedItems(newSelected);
                                                        }}
                                                        className="shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Remove item"
                                                    >
                                                        <Icon icon="mdi:delete-outline" width="25" height="25" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Bottom row: qty stepper + price */}
                                            <div className={`flex items-center justify-between px-3 pb-3 pt-1 border-t ${isSelected ? 'border-blue-200' : 'border-gray-100'}`}>
                                                {/* Qty stepper */}
                                                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateQuantity(itemKey, -1)}
                                                        disabled={item.quantity <= 1}
                                                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 transition-colors"
                                                    >
                                                        <Icon icon="mdi:minus" width="14" height="14" />
                                                    </button>
                                                    <span className="w-9 text-center text-sm font-semibold border-x border-gray-200">
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateQuantity(itemKey, 1)}
                                                        disabled={item.quantity >= item.maxQuantity}
                                                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 transition-colors"
                                                    >
                                                        <Icon icon="mdi:plus" width="14" height="14" />
                                                    </button>
                                                </div>

                                                {/* Price */}
                                                <div className="text-right">
                                                    <div className="font-bold text-main text-sm md:text-base">
                                                        {fmt(item.price * item.quantity)}
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        {fmt(item.price)} each
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Order Note */}
                                            {item.orderNote && (
                                                <div className={`px-3 pb-3 border-t ${isSelected ? 'border-blue-200' : 'border-gray-100'}`}>
                                                    <label className="block text-xs font-medium text-gray-500 mt-2 mb-1">Order Note</label>
                                                    <textarea
                                                        rows={3}
                                                        value={item.orderNote || ''}
                                                        onChange={(e) => updateItemNote(itemKey, e.target.value)}
                                                        placeholder="Add a note for this item (optional)"
                                                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ── Plugin hook: checkout.section1 ── */}
                    {hookSection1.length > 0 && (
                        <div className="md:col-span-2 space-y-6">
                            {hookSection1.map((field) => {
                                const Component = field.component;
                                if (!Component) return null;
                                return <Component key={`${field.key}-${field.position}`} />;
                            })}
                        </div>
                    )}

                    {/* Right Column - Order Summary */}
                    <div className="md:col-span-1 md:row-span-2 relative">
                        <div className="bg-white rounded-lg shadow p-2 md:p-6 md:sticky top-30">
                            <h2 className="text-xl font-semibold mb-4">Order Summary</h2>

                            <div className="space-y-3 mb-4 pb-4 border-b">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Selected Items:</span>
                                    <span className="font-medium">{getSelectedItems().length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Subtotal:</span>
                                    <span className="font-medium">{fmt(calculateSubtotal())}</span>
                                </div>
                                {fieldVisible("shippingMethod") && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Shipping ({formData.shippingMethod}):</span>
                                    {discountType && discountValue > 0 ? (
                                        <div className="text-right">
                                            <span className="font-medium line-through text-gray-400">{fmt(calculateBaseShipping())}</span>
                                            <span className="font-medium text-emerald-600 ml-2">{fmt(calculateShipping())}</span>
                                            <p className="text-[11px] text-emerald-500 mt-0.5">
                                                {discountType === 'fixed'
                                                    ? `−${fmt(discountValue)} discount`
                                                    : `−${discountValue}% discount`
                                                }
                                            </p>
                                        </div>
                                    ) : (
                                        <span className="font-medium">{fmt(calculateShipping())}</span>
                                    )}
                                </div>
                                )}
                                {upsellDiscount > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-orange-600 font-medium">Upsell Discount</span>
                                    <span className="font-semibold text-orange-600">−{fmt(upsellDiscount)}</span>
                                </div>
                                )}
                                {triggerType && calculateTriggerDiscount() > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-amber-600 font-medium">24h Trigger Discount</span>
                                    <span className="font-semibold text-amber-600">−{fmt(calculateTriggerDiscount())}</span>
                                </div>
                                )}
                                {triggerType === 'free_delivery' && calculateBaseShipping() > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-amber-600 font-medium">24h Trigger</span>
                                    <span className="font-semibold text-amber-600">Free Delivery</span>
                                </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={loading || getSelectedItems().length === 0}
                                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? 'Processing...' : 'Place Order'}
                            </button>

                            <p className="text-xs text-gray-500 text-center mt-4">
                                By placing your order, you agree to our terms and conditions
                            </p>
                        </div>
                    </div>

                    {/* ── Plugin hook: checkout.section3 ── */}
                    {hookSection3.length > 0 && (
                        <div className="md:col-span-3 space-y-6">
                            {hookSection3.map((field) => {
                                const Component = field.component;
                                if (!Component) return null;
                                return <Component key={`${field.key}-${field.position}`} />;
                            })}
                        </div>
                    )}

                    {/* Left Column - Order Items & Shipping Info */}
                    <div className="md:col-span-2 md:order-1 space-y-6">
                        {/* Shipping Information */}
                        <div className="bg-white rounded-lg shadow p-2 md:p-6">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Icon icon="mdi:truck-delivery" width="24" height="24" />
                                Shipping Information
                            </h2>

                            {user && (
                                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                                    <Icon icon="mdi:information" width="16" height="16" className="inline mr-2" />
                                    Logged in as {user.name}. You can modify the information below.
                                </div>
                            )}

                            <div className="flex flex-wrap -mx-2 gap-y-4">
                                {/* Full Name */}
                                {fieldVisible("name") && (
                                    <div className={fieldCls("name")}>
                                        <label className="block text-sm font-medium mb-2">
                                            Full Name {fieldRequired("name") && <span className="text-red-500">*</span>}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                            required={fieldRequired("name")}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                )}

                                {/* Phone */}
                                {fieldVisible("phone") && (
                                    <div className={fieldCls("phone")}>
                                        <label className="block text-sm font-medium mb-2">
                                            Phone Number {fieldRequired("phone") && <span className="text-red-500">*</span>}
                                        </label>
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                            required={fieldRequired("phone")}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                )}

                                {/* Email */}
                                {fieldVisible("email") && (
                                    <div className={fieldCls("email")}>
                                        <label className="block text-sm font-medium mb-2">
                                            Email {fieldRequired("email") && <span className="text-red-500">*</span>}
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                            required={fieldRequired("email")}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                )}

                                {/* Address */}
                                {fieldVisible("address") && (
                                    <div className={fieldCls("address")}>
                                        <label className="block text-sm font-medium mb-2">
                                            Address {fieldRequired("address") && <span className="text-red-500">*</span>}
                                        </label>
                                        <textarea
                                            value={formData.address}
                                            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                            required={fieldRequired("address")}
                                            rows={3}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                )}

                                {/* State */}
                                {fieldVisible("state") && (
                                    <div className={fieldCls("state")}>
                                        <label className="block text-sm font-medium mb-2">
                                            State/Province {fieldRequired("state") && <span className="text-red-500">*</span>}
                                        </label>
                                        <select
                                            value={formData.state}
                                            onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value, city: '' }))}
                                            required={fieldRequired("state")}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Select State</option>
                                            {states.map(state => (
                                                <option key={state.id} value={state.id}>{state.title}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* City */}
                                {fieldVisible("city") && (
                                    <div className={fieldCls("city")}>
                                        <label className="block text-sm font-medium mb-2">
                                            City {fieldRequired("city") && <span className="text-red-500">*</span>}
                                        </label>
                                        <select
                                            value={formData.city}
                                            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                                            disabled={!formData.state}
                                            required={fieldRequired("city")}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                        >
                                            <option value="">Select City</option>
                                            {cities.map(city => (
                                                <option key={city.id} value={city.id}>{city.title}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Zip Code */}
                                {fieldVisible("zipCode") && (
                                    <div className={fieldCls("zipCode")}>
                                        <label className="block text-sm font-medium mb-2">
                                            Zip Code {fieldRequired("zipCode") && <span className="text-red-500">*</span>}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.zipCode}
                                            onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                                            required={fieldRequired("zipCode")}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                )}

                                {/* Shipping Method */}
                                {fieldVisible("shippingMethod") && (
                                    <div className={fieldCls("shippingMethod")}>
                                        <label className="block text-sm font-medium mb-3">
                                            Shipping Method {fieldRequired("shippingMethod") && <span className="text-red-500">*</span>}
                                        </label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <label
                                                className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.shippingMethod === 'inside'
                                                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                                    : 'border-gray-300 hover:border-gray-400'
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="shippingMethod"
                                                    value="inside"
                                                    checked={formData.shippingMethod === 'inside'}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, shippingMethod: e.target.value as 'inside' | 'outside' }))}
                                                    className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                                                />
                                                <div className="ml-3 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <Icon icon="ic:baseline-delivery-dining" width="24" height="24" className="text-blue-600" />
                                                        <span className={`font-semibold ${formData.shippingMethod === 'inside' ? 'text-blue-700' : 'text-gray-900'}`}>
                                                            Inside Shipping
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        Standard delivery within the region
                                                    </p>
                                                </div>
                                                {formData.shippingMethod === 'inside' && (
                                                    <Icon icon="mdi:check-circle" width="24" height="24" className="text-blue-600 absolute top-3 right-3" />
                                                )}
                                            </label>

                                            <label
                                                className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.shippingMethod === 'outside'
                                                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                                    : 'border-gray-300 hover:border-gray-400'
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="shippingMethod"
                                                    value="outside"
                                                    checked={formData.shippingMethod === 'outside'}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, shippingMethod: e.target.value as 'inside' | 'outside' }))}
                                                    className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                                                />
                                                <div className="ml-3 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <Icon icon="hugeicons:truck-delivery" width="24" height="24" className="text-blue-600" />
                                                        <span className={`font-semibold ${formData.shippingMethod === 'outside' ? 'text-blue-700' : 'text-gray-900'}`}>
                                                            Outside Shipping
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        Delivery outside the region
                                                    </p>
                                                </div>
                                                {formData.shippingMethod === 'outside' && (
                                                    <Icon icon="mdi:check-circle" width="24" height="24" className="text-blue-600 absolute top-3 right-3" />
                                                )}
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* Payment Method */}
                                {fieldVisible("paymentMethod") && (
                                    <div className={fieldCls("paymentMethod")}>
                                        <label className="block text-sm font-medium mb-2">
                                            Payment Method {fieldRequired("paymentMethod") && <span className="text-red-500">*</span>}
                                        </label>
                                        {paymentGateways.length === 0 ? (
                                            <div className="text-sm text-gray-500">Loading payment methods...</div>
                                        ) : (
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                {paymentGateways.map((gateway) => (
                                                    <div
                                                        key={gateway.type}
                                                        onClick={() => setFormData(prev => ({ ...prev, paymentMethod: gateway.type }))}
                                                        className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${formData.paymentMethod === gateway.type
                                                            ? 'border-blue-500 bg-blue-50'
                                                            : 'border-gray-200 hover:border-gray-300'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-center h-12 mb-2">
                                                            <Icon
                                                                icon={gateway.icon || 'mdi:credit-card-outline'}
                                                                width="32"
                                                                height="32"
                                                                className="text-gray-600"
                                                            />
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-sm font-semibold">{gateway.label || gateway.title}</div>
                                                            {gateway.description && (
                                                                <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                                    {gateway.description}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Show payment details for selected method */}
                                        {formData.paymentMethod && (() => {
                                            const sel = paymentGateways.find(g => g.type === formData.paymentMethod);
                                            if (!sel) return null;
                                            const hasInstructions = sel.instructions && sel.instructions.trim();
                                            const hasConfig = sel.config && Object.keys(sel.config).length > 0;
                                            if (!hasInstructions && !hasConfig) return null;
                                            return (
                                                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm space-y-2">
                                                    {hasInstructions && (
                                                        <div>
                                                            <p className="font-semibold mb-1">Payment Instructions:</p>
                                                            <p className="text-gray-700 whitespace-pre-line">{sel.instructions}</p>
                                                        </div>
                                                    )}
                                                    {hasConfig && (
                                                        <div className="space-y-1">
                                                            {Object.entries(sel.config as Record<string, string>).map(([key, value]) => {
                                                                if (!value) return null;
                                                                const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                                                return (
                                                                    <p key={key}>
                                                                        {label}: <strong>{value}</strong>
                                                                    </p>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* Payment Proof Fields */}
                                        {formData.paymentMethod && (() => {
                                            const sel = paymentGateways.find(g => g.type === formData.paymentMethod);
                                            return sel?.requiresProof;
                                        })() && (
                                            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-4">
                                                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                                    <Icon icon="mdi:file-document" width="20" height="20" />
                                                    Payment Proof (Optional)
                                                </h3>

                                                {fieldVisible("transactionId") && (
                                                    <div>
                                                        <label className="block text-sm font-medium mb-2">
                                                            Transaction ID {fieldRequired("transactionId") && <span className="text-red-500">*</span>}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={formData.transactionId}
                                                            onChange={(e) => setFormData(prev => ({ ...prev, transactionId: e.target.value }))}
                                                            required={fieldRequired("transactionId")}
                                                            placeholder="Enter your transaction ID"
                                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                )}

                                                {fieldVisible("paymentInfo") && (
                                                    <div>
                                                        <label className="block text-sm font-medium mb-2">
                                                            Payment Details {fieldRequired("paymentInfo") && <span className="text-red-500">*</span>}
                                                        </label>
                                                        <textarea
                                                            value={formData.paymentInfo}
                                                            onChange={(e) => setFormData(prev => ({ ...prev, paymentInfo: e.target.value }))}
                                                            required={fieldRequired("paymentInfo")}
                                                            placeholder="Enter any additional payment information..."
                                                            rows={3}
                                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                )}

                                                {fieldVisible("proofImage") && (
                                                    <div>
                                                        <label className="block text-sm font-medium mb-2">
                                                            Payment Screenshot {fieldRequired("proofImage") && <span className="text-red-500">*</span>}
                                                        </label>
                                                        <Gallery
                                                            value={formData.proofImage}
                                                            onChange={(value) => setFormData(prev => ({ ...prev, proofImage: typeof value === 'string' ? value : '' }))}
                                                            multiple={false}
                                                        />
                                                        <p className="text-xs text-gray-500 mt-2">
                                                            Upload a screenshot of your payment confirmation
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Order Notes */}
                                {fieldVisible("notes") && (
                                    <div className={fieldCls("notes")}>
                                        <label className="block text-sm font-medium mb-2">
                                            Order Notes {fieldRequired("notes") ? <span className="text-red-500">*</span> : "(Optional)"}
                                        </label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                            required={fieldRequired("notes")}
                                            rows={3}
                                            placeholder="Any special instructions for your order..."
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Plugin hook: checkout.section2 ── */}
                    {hookSection2.length > 0 && (
                        <div className="md:col-span-3 space-y-6">
                            {hookSection2.map((field) => {
                                const Component = field.component;
                                if (!Component) return null;
                                return <Component key={`${field.key}-${field.position}`} />;
                            })}
                        </div>
                    )}
                </div>
            </form>

            {/* ── Plugin hook: checkout.bottom ── */}
            {hookBottom.length > 0 && (
                <div className="mt-8 space-y-6">
                    {hookBottom.map((field) => {
                        const Component = field.component;
                        if (!Component) return null;
                        return <Component key={`${field.key}-${field.position}`} />;
                    })}
                </div>
            )}
        </div>
    );
}
