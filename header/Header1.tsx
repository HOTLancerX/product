import Link from 'next/link';
import MenuClients from '@/components/MenuClients';
import MobileDrawer from '@/components/page/header/MobileDrawer';
import CartButton from './CartButton';
import type { MenuItem } from '@/models/Menu';
import AuthAc from '@/components/AuthAc';

interface Header4Props {
    settings?: Record<string, any>;
    topItems?:       MenuItem[];
    mainItems?:      MenuItem[];
    rightItems?:     MenuItem[];
    mobileItems?:    MenuItem[];
    builderContent?: Record<string, any[]>;
}

export default function Header4({
    settings = {},
    topItems       = [],
    mainItems      = [],
    rightItems     = [],
    mobileItems    = [],
    builderContent = {},
}: Header4Props) {
    const isSticky      = settings.header_sticky      !== 'false';
    const isTransparent = settings.header_transparent === 'true';

    return (
        <header className={`z-50 border-b border-gray-200 shadow-sm ${isSticky ? 'sticky top-0' : 'relative'} ${isTransparent ? 'bg-transparent' : 'bg-white'}`}>
            {topItems.length > 0 && (
                <div className="bg-gray-900 text-gray-300 text-xs px-6 py-1.5">
                    <div className="max-w-6xl mx-auto flex items-center justify-end">
                        <MenuClients menuItems={topItems} settings={settings} builderContent={builderContent} className="flex items-center" />
                    </div>
                </div>
            )}

            <div className="container h-16 flex items-center justify-between w-full gap-6">
                {/* Logo */}
                <Link href="/" className="text-xl font-extrabold text-gray-900 tracking-tight shrink-0">
                    {settings.siteName || 'MySite'}
                </Link>

                {/* Mobile: cart + hamburger */}
                <div className="flex items-center gap-1 md:hidden ml-auto">
                    <CartButton fontSize={22} color="#374151" />
                    <MobileDrawer items={mobileItems} settings={settings} iconColor="#374151" />
                </div>

                {/* Main nav */}
                {mainItems.length > 0 ? (
                    <div className="hidden md:flex justify-end flex-1">
                        <MenuClients menuItems={mainItems} settings={settings} builderContent={builderContent} className="flex items-center" />
                    </div>
                ) : (
                    <div className="hidden md:flex flex-1" />
                )}

                {/* Right slot + Cart (desktop) */}
                <div className="hidden md:flex items-center gap-2 shrink-0">
                    {rightItems.length > 0 && (
                        <MenuClients menuItems={rightItems} settings={settings} builderContent={builderContent} className="flex items-center" />
                    )}
                    <AuthAc />
                    <CartButton fontSize={22} color="#374151" />
                </div>
            </div>
        </header>
    );
}
