'use client';

/**
 * Slider.tsx — Product image slider for the public product page.
 *
 * Features:
 *  - Main slide synced with thumbnail strip via embla-carousel-react
 *  - Thumbnail strip (up to 5 visible, scrollable)
 *  - Slide counter badge (current / total)
 *  - Custom prev/next arrows that appear on hover
 *  - Selecting a thumbnail jumps the main slider
 *  - Accepts a gallery array; renders a placeholder when empty
 *
 * Used by Layout1 and Layout2.
 */

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
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

    const hasMultiple = gallery && gallery.length > 1;

    const [mainRef, mainApi] = useEmblaCarousel({
        loop: hasMultiple,
        duration: 25,
    });

    const [thumbRef, thumbApi] = useEmblaCarousel({
        containScroll: 'keepSnaps',
        dragFree: true,
    });

    const onSelect = useCallback(() => {
        if (!mainApi || !thumbApi) return;
        const index = mainApi.selectedScrollSnap();
        setCurrentSlide(index);
        thumbApi.scrollTo(index);
    }, [mainApi, thumbApi]);

    useEffect(() => {
        if (!mainApi) return;
        onSelect();
        mainApi.on('select', onSelect);
        mainApi.on('reInit', onSelect);
        return () => {
            mainApi.off('select', onSelect);
            mainApi.off('reInit', onSelect);
        };
    }, [mainApi, onSelect]);

    const handleThumbClick = useCallback((index: number) => {
        if (!mainApi) return;
        mainApi.scrollTo(index);
    }, [mainApi]);

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

    return (
        <div className="w-full space-y-3">
            {/* ── Main slide ── */}
            <div className={`relative w-full ${aspectClass} overflow-hidden rounded-2xl bg-gray-50 group`}>
                <div className="overflow-hidden w-full h-full" ref={mainRef}>
                    <div className="flex w-full h-full">
                        {gallery.map((img, idx) => (
                            <div key={idx} className="flex-[0_0_100%] min-w-0">
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
                    </div>
                </div>

                {hasMultiple && (
                    <>
                        <PrevArrow onClick={() => mainApi?.scrollPrev()} />
                        <NextArrow onClick={() => mainApi?.scrollNext()} />
                    </>
                )}

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
                <div className="overflow-hidden w-full" ref={thumbRef}>
                    <div className="flex -mx-1">
                        {gallery.map((img, idx) => {
                            const basisClass = gallery.length === 2
                                ? 'flex-[0_0_50%]'
                                : gallery.length === 3
                                ? 'flex-[0_0_33.333%]'
                                : gallery.length === 4
                                ? 'flex-[0_0_25%]'
                                : 'flex-[0_0_25%] md:flex-[0_0_20%]';
                            return (
                                <div key={idx} className={`px-1 min-w-0 ${basisClass}`}>
                                    <button
                                        type="button"
                                        aria-label={`View image ${idx + 1}`}
                                        onClick={() => handleThumbClick(idx)}
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
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
