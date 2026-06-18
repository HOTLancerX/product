import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export interface PaymentGateway {
    type: string;
    label: string;
    icon: string;
    instructions?: string;
    accountNumber?: string;
    accountName?: string;
    bankName?: string;
    enabled: boolean;
}

/**
 * GET /api/payment
 *
 * Returns enabled payment gateways for the checkout page.
 * Gateway configuration is stored in site settings under the
 * "payment_gateways" key (JSON array).
 *
 * Falls back to a default COD gateway so checkout always has at least one option.
 */
export async function GET(_req: NextRequest) {
    try {
        const raw = await getSetting('payment_gateways');

        let gateways: PaymentGateway[] = [];

        if (raw) {
            try {
                gateways = JSON.parse(raw as string) as PaymentGateway[];
            } catch {
                gateways = [];
            }
        }

        // Default fallback — cash on delivery
        if (gateways.length === 0) {
            gateways = [
                {
                    type:         'cash_on_delivery',
                    label:        'Cash on Delivery',
                    icon:         'mdi:cash',
                    instructions: 'Pay when your order is delivered.',
                    enabled:      true,
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
