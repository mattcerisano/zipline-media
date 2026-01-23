'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navLinks = [
  { name: 'HOME', href: '/#home' },
  { name: 'WORK', href: '/#work' },
  { name: 'ABOUT', href: '/#about' },
  { name: 'CONTACT', href: '/#contact' },
];

export default function Navbar() {
  const pathname = usePathname();

  if (pathname?.startsWith('/crew')) return null;

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-black/90 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex justify-between items-center">
        <div className="flex flex-col">
          <Link href="/#home" className="relative h-14 w-52 md:h-20 md:w-80">
            <img 
              src="/Zipline Logo FULL Blue.png" 
              alt="ZIPLINE" 
              className="h-full object-contain"
            />
          </Link>
        </div>
        
        <div className="flex gap-4 md:gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative text-[10px] font-bold tracking-[0.2em] hover:text-[var(--accent)] transition-colors"
            >
              {link.name}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}