import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export interface PaymentGateway {
    type: string;
    label: string;
    title?: string;
    icon: string;
    instructions?: string;
    enabled: boolean;
    source?: string;
    config?: Record<string, string>;
    requiresProof?: boolean;
    isOnline?: boolean;
}

/**
 * GET /api/payment
 *
 * Returns enabled payment gateways for the checkout page.
 * Merges gateways from:
 *   1. payment_gateways — main store gateways (product plugin settings)
 *   2. mobile_payment_gateways — mobile payment gateways (mobile-payment plugin)
 *   3. stripe — auto-included if stripe_secret_key is configured
 *
 * Falls back to a default COD gateway so checkout always has at least one option.
 */
export async function GET(_req: NextRequest) {
    try {
        // 1. Main store gateways
        const raw = await getSetting('payment_gateways');
        let gateways: PaymentGateway[] = [];

        if (raw) {
            try {
                const parsed: any[] = JSON.parse(raw as string);
                gateways = parsed.map((g) => ({
                    type:          g.type,
                    label:         g.label || g.type,
                    title:         g.label || g.type,
                    icon:          g.icon || 'mdi:credit-card-outline',
                    instructions:  g.instructions || '',
                    enabled:       g.enabled !== false,
                    source:        'product',
                    requiresProof: g.type !== 'cash_on_delivery',
                    config: buildConfig(g),
                }));
            } catch {
                gateways = [];
            }
        }

        // 2. Mobile payment gateways (from mobile-payment plugin)
        const mobileRaw = await getSetting('mobile_payment_gateways');
        if (mobileRaw) {
            try {
                const mobileGateways: any[] = JSON.parse(mobileRaw as string);
                for (const mg of mobileGateways) {
                    gateways.push({
                        type:          `mobile_${mg.type}`,
                        label:         mg.label || mg.type,
                        title:         mg.label || mg.type,
                        icon:          mg.icon || 'mdi:cellphone',
                        instructions:  mg.instructions || '',
                        enabled:       mg.enabled !== false,
                        source:        'mobile-payment',
                        requiresProof: mg.requiresProof !== false,
                        config: {
                            number:   mg.phone || '',
                            provider: mg.provider || mg.label || '',
                        },
                    });
                }
            } catch {
                // ignore parse errors
            }
        }

        // 3. Stripe — auto-include if configured
        const stripeKey = await getSetting('stripe_publishable_key');
        const stripeSecret = await getSetting('stripe_secret_key');
        if (stripeKey && stripeSecret) {
            const stripeEnabled = await getSetting('stripe_enabled');
            const isEnabled = stripeEnabled === null || stripeEnabled === undefined || stripeEnabled === 'true' || stripeEnabled === true;
            gateways.push({
                type:          'stripe',
                label:         'Credit / Debit Card',
                title:         'Credit / Debit Card',
                icon:          'mdi:credit-card-outline',
                instructions:  'You will be redirected to a secure checkout page to complete your payment.',
                enabled:       isEnabled,
                source:        'stripe',
                isOnline:      true,
                requiresProof: false,
            });
        }

        // Default fallback — cash on delivery
        if (gateways.length === 0) {
            gateways = [
                {
                    type:          'cash_on_delivery',
                    label:         'Cash on Delivery',
                    title:         'Cash on Delivery',
                    icon:          'mdi:cash',
                    instructions:  'Pay with cash when your order is delivered.',
                    enabled:       true,
                    requiresProof: false,
                    config:        {},
                },
            ];
        }

        const active = gateways.filter((g) => g.enabled !== false);

        return NextResponse.json({ gateways: active });
    } catch (error) {
        console.error('Payment gateways GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch payment gateways' }, { status: 500 });
    }
}

function buildConfig(gw: any): Record<string, string> {
    const config: Record<string, string> = {};
    if (gw.accountNumber) config.account_number = gw.accountNumber;
    if (gw.accountName)   config.account_name   = gw.accountName;
    if (gw.bankName)      config.bank_name      = gw.bankName;
    return config;
}
