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
      <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex flex-col">
          <Link href="/#home" className="relative h-10 w-48">
            <img 
              src="/Zipline Logo FULL Blue.png" 
              alt="ZIPLINE" 
              className="h-full object-contain"
            />
          </Link>
          <span className="text-[8px] tracking-[0.4em] uppercase text-white/40 mt-1 ml-1">
            Creative Video Production
          </span>
        </div>
        
        <div className="flex gap-8">
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