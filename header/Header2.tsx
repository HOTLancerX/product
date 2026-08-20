'use client';

/**
 * plugin/product/header/Header2.tsx
 *
 * E-Commerce & Gaming Topup Store Header Layout matching SEAGM style:
 * 1. Top Bar:
 *    - Left: Top navigation links (News, Rewards, Support, etc.)
 *    - Right: App download link with phone icon + Country / Language / Currency indicator
 * 2. Main Bar:
 *    - Left: Logo with configurable height
 *    - Middle: Main navigation menu items with dropdown carets
 *    - Right: Live Search input box + Sign In / Account modal + Cart button
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import MenuClients from '@/components/MenuClients';
import MobileDrawer from '@/components/page/header/MobileDrawer';
import CartButton from './CartButton';
import type { MenuItem } from '@/models/Menu';
import AuthAc from '@/components/AuthAc';

interface Header2Props {
  settings?: Record<string, any>;
  topItems?: MenuItem[];
  mainItems?: MenuItem[];
  rightItems?: MenuItem[];
  mobileItems?: MenuItem[];
  builderContent?: Record<string, any[]>;
}

export default function Header2({
  settings = {},
  topItems = [],
  mainItems = [],
  rightItems = [],
  mobileItems = [],
  builderContent = {},
}: Header2Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const isSticky = settings.header_sticky !== 'false';
  const isTransparent = settings.header_transparent === 'true';

  const appTitle = settings.header_app_banner_title || 'SEAGM APP';
  const appUrl = settings.header_app_banner_url || '#';
  const showAppBanner = settings.header_app_banner_enabled !== false;

  const currencySymbol = settings.product_currency_symbol || '$';
  const currencyCode = settings.product_currency || 'USD';
  const searchPlaceholder = settings.header_search_placeholder || 'Search';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <header
      className={`z-50 w-full transition-colors border-b border-gray-200/80 shadow-2xs ${
        isSticky ? 'sticky top-0' : 'relative'
      } ${isTransparent ? 'bg-transparent' : 'bg-white'}`}
    >
      {/* ── 1. TOP UTILITY BAR (Desktop) ── */}
      <div className="bg-white border-b border-gray-100 hidden md:block text-xs text-gray-500 py-1.5 px-4 sm:px-6">
        <div className="container flex items-center justify-between gap-4">
          
          {/* Left: Top Links */}
          <div className="flex items-center gap-5">
            {topItems.length > 0 ? (
              <MenuClients
                menuItems={topItems}
                settings={settings}
                builderContent={builderContent}
                className="flex items-center gap-5 font-normal text-gray-500 hover:text-gray-900 transition-colors"
              />
            ) : (
              <div className="flex items-center gap-5 text-gray-500">
                <Link href="/news" className="hover:text-gray-900 transition-colors">News</Link>
                <Link href="/rewards" className="hover:text-gray-900 transition-colors">STAR Rewards</Link>
                <Link href="/support" className="hover:text-gray-900 transition-colors">Support</Link>
              </div>
            )}
          </div>

          {/* Right: App Download + Language & Currency */}
          <div className="flex items-center gap-4 shrink-0">
            {/* App Link */}
            {showAppBanner && (
              <Link
                href={appUrl}
                className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                <Icon icon="solar:smartphone-2-bold" width={15} className="text-gray-700" />
                <span>{appTitle}</span>
              </Link>
            )}

            <div className="h-3 w-px bg-gray-200" />

            {/* Language & Currency Pill */}
            <div className="flex items-center gap-2 cursor-pointer text-gray-700 hover:text-gray-900 font-medium">
              <span className="w-5 h-3.5 rounded-xs overflow-hidden inline-flex items-center shadow-2xs border border-gray-200">
                <Icon icon="flag:bd-4x3" width={20} />
              </span>
              <span>EN-BD / {currencyCode}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. MAIN HEADER BAR ── */}
      <div className="container py-3 flex items-center justify-between gap-4 sm:gap-6">
        
        {/* Left: Logo */}
        <Link href="/" className="shrink-0 flex items-center gap-2 no-underline">
          {settings.logo ? (
            <img
              src={settings.logo}
              alt={settings.siteName || 'NxCMS'}
              className="w-auto object-contain max-h-11"
              style={{
                height: settings.header_logo_height
                  ? `${settings.header_logo_height}px`
                  : settings.headerLogoHeight
                  ? `${settings.headerLogoHeight}px`
                  : undefined,
              }}
            />
          ) : (
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter text-gray-900 leading-none">
                {settings.siteName || 'SEAGM'}
              </span>
              <span className="text-[9px] font-bold text-amber-600 tracking-wider uppercase mt-0.5">
                Since 2007
              </span>
            </div>
          )}
        </Link>

        {/* Center: Main Navigation Menu (Desktop) */}
        <div className="hidden lg:flex items-center gap-1 flex-1 justify-start ml-2">
          {mainItems.length > 0 ? (
            <MenuClients
              menuItems={mainItems}
              settings={settings}
              builderContent={builderContent}
              className="flex items-center gap-1 text-xs font-bold text-gray-800 uppercase tracking-wide"
            />
          ) : (
            <nav className="flex items-center gap-6 text-xs font-bold text-gray-800 uppercase tracking-wide">
              <Link href="/category/game" className="hover:text-main transition-colors flex items-center gap-1">
                <span>GAME</span>
                <Icon icon="solar:alt-arrow-down-linear" width={11} className="text-gray-400" />
              </Link>
              <Link href="/category/card" className="hover:text-main transition-colors flex items-center gap-1">
                <span>CARD</span>
                <Icon icon="solar:alt-arrow-down-linear" width={11} className="text-gray-400" />
              </Link>
              <Link href="/category/direct-top-up" className="hover:text-main transition-colors flex items-center gap-1">
                <span>DIRECT TOP-UP</span>
                <Icon icon="solar:alt-arrow-down-linear" width={11} className="text-gray-400" />
              </Link>
              <Link href="/category/cd-key" className="hover:text-main transition-colors flex items-center gap-1">
                <span>CD-KEY</span>
                <Icon icon="solar:alt-arrow-down-linear" width={11} className="text-gray-400" />
              </Link>
              <Link href="/category/mobile-recharge" className="hover:text-main transition-colors">
                <span>MOBILE RECHARGE</span>
              </Link>
            </nav>
          )}
        </div>

        {/* Right Area: Search Box + Auth Button + Cart (Desktop) */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative w-48 xl:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-3.5 pr-8 py-1.5 text-xs text-gray-800 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 transition-colors shadow-2xs placeholder:text-gray-400"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-0.5"
            >
              <Icon icon="solar:magnifer-linear" width={16} />
            </button>
          </form>

          {/* Right Extra Menu Items */}
          {rightItems.length > 0 && (
            <MenuClients
              menuItems={rightItems}
              settings={settings}
              builderContent={builderContent}
              className="flex items-center gap-2"
            />
          )}

          {/* Sign In Button / User Account Modal */}
          <div className="flex items-center">
            <AuthAc />
          </div>

          {/* Cart Button */}
          <div className="flex items-center pl-1">
            <CartButton fontSize={21} color="#374151" />
          </div>
        </div>

        {/* Mobile Action Buttons (Search + Cart + Drawer) */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="p-1.5 text-gray-600 hover:text-gray-900 rounded-lg active:bg-gray-100"
            aria-label="Toggle Mobile Search"
          >
            <Icon icon="solar:magnifer-linear" width={22} />
          </button>
          <CartButton fontSize={22} color="#374151" />
          <MobileDrawer items={mobileItems} settings={settings} iconColor="#374151" />
        </div>

      </div>

      {/* Mobile Collapsible Search Bar */}
      {mobileSearchOpen && (
        <div className="p-3 bg-gray-50 border-t border-gray-100 md:hidden animate-fade-in">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-3.5 pr-9 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-main shadow-2xs"
              autoFocus
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-main"
            >
              <Icon icon="solar:magnifer-linear" width={18} />
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
