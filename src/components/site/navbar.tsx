'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from '@/components/ui/navigation-menu';

export function Navbar() {
  return (
    <header className='sticky top-0 z-50 border-b bg-background/80 backdrop-blur'>
      <div className='mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4'>
        <Link href='/' className='font-semibold'>
          Cloudinary MCP Chat
        </Link>

        <nav className='hidden md:block'>
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <Link href='/docs' className='px-3 py-2 text-sm'>
                  Docs
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link href='/about' className='px-3 py-2 text-sm'>
                  About
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </nav>

        <div className='flex items-center gap-2'>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
