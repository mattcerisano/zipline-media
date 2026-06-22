'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navLinks = [
  { name: 'HOME', href: '/#home' },
  { name: 'WORK', href: '/archive' },
  { name: 'ABOUT', href: '/#about' },
  { name: 'CONTACT', href: '/#contact' },
];

export default function Navbar() {
  const pathname = usePathname();

  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    if (pathname !== '/') return;

    const sections = ['home', 'work', 'about', 'contact'];
    const observers = sections.map(id => {
      const el = document.getElementById(id);
      if (!el) return null;
      
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          setActiveSection(id);
        }
      }, {
        rootMargin: '-50% 0px -50% 0px' // triggers when section is in the middle of viewport
      });
      observer.observe(el);
      return { observer, el };
    });

    return () => {
      observers.forEach(obs => {
        if (obs) obs.observer.disconnect();
      });
    };
  }, [pathname]);

  if (pathname?.startsWith('/command-center')) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === '/archive') {
      return pathname === '/archive';
    }
    if (pathname === '/') {
      return href === `/#${activeSection}`;
    }
    return false;
  };

  const handleNav = (e: React.MouseEvent, href: string) => {
    // 1. If we are on the homepage and clicking a hash link (e.g. /#work)
    if (pathname === '/' && href.startsWith('/#')) {
      e.preventDefault();
      setIsOpen(false);
      const targetId = href.replace('/#', '');
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        // Update URL without reload
        window.history.pushState(null, '', href);
        setActiveSection(targetId);
      }
      return;
    }

    // 2. If we are on the archive page, do the exit transition
    if (pathname === '/archive') {
      e.preventDefault();
      setIsExiting(true);
      setTimeout(() => {
        router.push(href);
        setTimeout(() => setIsExiting(false), 500); 
      }, 500);
    } else {
      // 3. Normal navigation (e.g. from /gear to /#home)
      setIsOpen(false);
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-[100] bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 md:py-6 flex justify-between items-center">
          <div className="flex items-center">
            <Link 
              href="/#home" 
              onClick={(e) => { setIsOpen(false); handleNav(e, '/#home'); }} 
              className="block hover:opacity-80 transition-opacity"
            >
              <Image 
                src="/Zipline Logo FULL Blue.png" 
                alt="ZIPLINE" 
                width={200}
                height={54}
                className="w-32 md:w-52 h-auto"
                priority
              />
            </Link>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex gap-10">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => handleNav(e, link.href)}
                className={`relative text-[12px] font-bold tracking-[0.2em] transition-colors uppercase py-1 ${
                  isActive(link.href) ? 'text-white' : 'text-white/40 hover:text-white'
                }`}
              >
                {link.name}
                {isActive(link.href) && (
                  <motion.div 
                    layoutId="activeNavIndicator"
                    className="absolute -bottom-[18px] left-0 right-0 h-[2px] bg-accent shadow-[0_0_8px_rgba(0,119,255,0.8)]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
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
                    className={`text-2xl font-black uppercase tracking-widest transition-colors ${
                      isActive(link.href) ? 'text-accent' : 'text-white/60 hover:text-white'
                    }`}
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