'use client';

/**
 * Slider.tsx — Product image slider for the public product page.
 *
 * Features:
 *  - Main slide (fade transition) synced with thumbnail strip via react-slick
 *  - Thumbnail strip (up to 5 visible, scrollable)
 *  - Slide counter badge (current / total)
 *  - Custom prev/next arrows that appear on hover
 *  - Selecting a thumbnail jumps the main slider
 *  - Accepts a gallery array; renders a placeholder when empty
 *
 * Used by Layout1 and Layout2.
 */

import { useRef, useState } from 'react';
import Image from 'next/image';
import SlickSlider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { Icon } from '@iconify/react';

interface SliderProps {
    /** Ordered image URL list */
    gallery: string[];
    /** Alt text prefix — usually the product title */
    alt?: string;
    /** Aspect-ratio class for the main slide, e.g. "aspect-square" */
    aspectClass?: string;
}

// ── Arrow sub-components ──────────────────────────────────────────────────────

function NextArrow({ onClick }: { onClick?: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label="Next image"
            className="
                absolute right-3 top-1/2 -translate-y-1/2 z-10
                bg-white/90 hover:bg-white text-gray-800
                rounded-full p-1.5 shadow-md transition-all
                opacity-0 group-hover:opacity-100
                focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500
            "
        >
            <Icon icon="mdi:chevron-right" width="22" height="22" />
        </button>
    );
}

function PrevArrow({ onClick }: { onClick?: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label="Previous image"
            className="
                absolute left-3 top-1/2 -translate-y-1/2 z-10
                bg-white/90 hover:bg-white text-gray-800
                rounded-full p-1.5 shadow-md transition-all
                opacity-0 group-hover:opacity-100
                focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500
            "
        >
            <Icon icon="mdi:chevron-left" width="22" height="22" />
        </button>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Slider({
    gallery,
    alt = 'Product',
    aspectClass = 'aspect-square',
}: SliderProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const mainRef  = useRef<SlickSlider>(null);
    const thumbRef = useRef<SlickSlider>(null);

    // Keep slider instances for asNavFor sync
    const [mainSlider, setMainSlider]   = useState<SlickSlider | null>(null);
    const [thumbSlider, setThumbSlider] = useState<SlickSlider | null>(null);

    // ── Empty state ───────────────────────────────────────────────────────────
    if (!gallery || gallery.length === 0) {
        return (
            <div className={`w-full ${aspectClass} bg-gray-100 rounded-2xl flex items-center justify-center`}>
                <div className="flex flex-col items-center gap-2 text-gray-300">
                    <Icon icon="mdi:image-off" width="64" height="64" />
                    <span className="text-sm">No image available</span>
                </div>
            </div>
        );
    }

    const hasMultiple = gallery.length > 1;
    const thumbCount  = Math.min(5, gallery.length);

    const mainSettings = {
        dots: false,
        infinite: hasMultiple,
        speed: 400,
        slidesToShow: 1,
        slidesToScroll: 1,
        fade: true,
        arrows: hasMultiple,
        nextArrow: <NextArrow />,
        prevArrow: <PrevArrow />,
        beforeChange: (_: number, next: number) => setCurrentSlide(next),
        asNavFor: thumbSlider ?? undefined,
    };

    const thumbSettings = {
        dots: false,
        infinite: false,
        speed: 300,
        slidesToShow: thumbCount,
        slidesToScroll: 1,
        focusOnSelect: true,
        arrows: false,
        asNavFor: mainSlider ?? undefined,
        responsive: [
            {
                breakpoint: 768,
                settings: { slidesToShow: Math.min(4, gallery.length) },
            },
        ],
    };

    return (
        <div className="w-full space-y-3">
            {/* ── Main slide ── */}
            <div className={`relative w-full ${aspectClass} overflow-hidden rounded-2xl bg-gray-50 group`}>
                <SlickSlider
                    ref={(s) => { mainRef.current = s; setMainSlider(s); }}
                    {...mainSettings}
                >
                    {gallery.map((img, idx) => (
                        <div key={idx}>
                            <div className={`relative w-full ${aspectClass}`}>
                                <Image
                                    src={img}
                                    alt={`${alt} — image ${idx + 1}`}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 50vw"
                                    className="object-contain"
                                    priority={idx === 0}
                                />
                            </div>
                        </div>
                    ))}
                </SlickSlider>

                {/* Slide counter */}
                {hasMultiple && (
                    <div
                        aria-live="polite"
                        className="
                            absolute bottom-3 right-3
                            bg-black/50 text-white
                            px-2.5 py-0.5 rounded-full text-xs font-medium
                            pointer-events-none z-10
                        "
                    >
                        {currentSlide + 1} / {gallery.length}
                    </div>
                )}
            </div>

            {/* ── Thumbnail strip ── */}
            {hasMultiple && (
                <SlickSlider
                    ref={(s) => { thumbRef.current = s; setThumbSlider(s); }}
                    {...thumbSettings}
                >
                    {gallery.map((img, idx) => (
                        <div key={idx} className="px-1">
                            <button
                                type="button"
                                aria-label={`View image ${idx + 1}`}
                                onClick={() => {
                                    mainRef.current?.slickGoTo(idx);
                                    setCurrentSlide(idx);
                                }}
                                className={`
                                    relative w-full aspect-square rounded-lg overflow-hidden border-2 transition-all
                                    ${currentSlide === idx
                                        ? 'border-blue-500 ring-2 ring-blue-200 shadow-md'
                                        : 'border-gray-200 hover:border-gray-400'
                                    }
                                `}
                            >
                                <Image
                                    src={img}
                                    alt={`Thumbnail ${idx + 1}`}
                                    fill
                                    sizes="80px"
                                    className="object-cover"
                                />
                            </button>
                        </div>
                    ))}
                </SlickSlider>
            )}
        </div>
    );
}
