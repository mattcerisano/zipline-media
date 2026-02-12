'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navLinks = [
  { name: 'HOME', href: '/#home' },
  { name: 'WORK', href: '/#work' },
  { name: 'ABOUT', href: '/#about' },
  { name: 'CONTACT', href: '/#contact' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  if (pathname?.startsWith('/crew')) return null;

  const handleNav = (e: React.MouseEvent, href: string) => {
    // Only apply fade transition if we are on the archive page
    if (pathname === '/archive') {
      e.preventDefault();
      setIsExiting(true);
      // Wait for fade in, then navigate
      setTimeout(() => {
        router.push(href);
        // Reset exit state after navigation ensures it clears if we come back or for simple logic
        // Though unmount usually handles it.
        setTimeout(() => setIsExiting(false), 500); 
      }, 500);
    } else {
      setIsOpen(false);
    }
  };

  return (
    <>
      <nav className="hidden md:block fixed top-0 left-0 w-full z-50 bg-black/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex justify-between items-center">
          <div className="flex flex-col relative z-50">
            <Link 
              href="/#home" 
              onClick={(e) => { setIsOpen(false); handleNav(e, '/#home'); }} 
              className="relative h-10 w-32 md:h-14 md:w-52"
            >
              <img 
                src="/Zipline Logo FULL Blue.png" 
                alt="ZIPLINE" 
                className="h-full object-contain"
              />
            </Link>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => handleNav(e, link.href)}
                className="relative text-[10px] font-bold tracking-[0.2em] hover:text-[var(--accent)] transition-colors uppercase"
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Mobile Hamburger */}
          <button 
            className="md:hidden text-white z-50 p-2"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle Menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-black flex flex-col items-center justify-center md:hidden"
          >
            <div className="flex flex-col gap-8 text-center">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link
                    href={link.href}
                    onClick={(e) => { setIsOpen(false); handleNav(e, link.href); }}
                    className="text-2xl font-black uppercase tracking-widest hover:text-[var(--accent)] transition-colors"
                  >
                    {link.name}
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Exit Overlay for Archive Page */}
      <AnimatePresence>
        {isExiting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] bg-black pointer-events-none"
          />
        )}
      </AnimatePresence>
    </>
  );
}