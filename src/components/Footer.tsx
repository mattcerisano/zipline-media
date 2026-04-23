'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Instagram, Linkedin, Video } from 'lucide-react'; // Using Video as Vimeo placeholder if needed, or text

export default function Footer() {
  return (

    <footer className="bg-black border-t border-white/10 pt-12 md:pt-20 pb-8 md:pb-10 px-4 md:px-8 lg:px-12">

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-10 md:gap-12">

        

        {/* Brand Column */}

        <div className="flex flex-col gap-2 md:gap-4">

          <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Zipline Media</h2>

          <p className="text-xs tracking-[0.2em] text-white/40 uppercase">New York, NY</p>

        </div>



        {/* Links Column */}

                <div className="flex flex-col gap-3 md:gap-4 text-xs font-bold tracking-[0.2em] uppercase">

                  <Link href="/#work" className="text-white hover:text-[var(--accent)] transition-colors">Work</Link>

                  <Link href="/#about" className="text-white hover:text-[var(--accent)] transition-colors">About</Link>

                  <Link href="/#contact" className="text-white hover:text-[var(--accent)] transition-colors">Contact</Link>

                </div>



        {/* Socials & Contact */}

        <div className="flex flex-col gap-4 md:gap-6">

          <a href="mailto:contact@zipline.media" className="text-sm font-bold tracking-[0.1em] text-white hover:text-[var(--accent)] transition-colors">

            CONTACT@ZIPLINE.MEDIA

          </a>

          

          <div className="flex gap-6">

            <a href="https://www.instagram.com/zipline.media" target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white transition-colors">

              <Instagram className="w-5 h-5" />

            </a>

            <a href="https://vimeo.com/zipline" target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white transition-colors">

              <svg 

                xmlns="http://www.w3.org/2000/svg" 

                width="20" 

                height="20" 

                viewBox="0 0 24 24" 

                fill="none" 

                stroke="currentColor" 

                strokeWidth="2" 

                strokeLinecap="round" 

                strokeLinejoin="round"

              >

                <path d="M2.5 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8-8-3.582-8-8zm13.5 0l-4-4v8l4-4z" /> 

                {/* Custom simple play icon for Vimeo, or standard Lucide Video */}

              </svg>

            </a>

            <a href="https://www.linkedin.com/company/zipline-productions" target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white transition-colors">

              <Linkedin className="w-5 h-5" />

            </a>

          </div>

        </div>

      </div>

    </footer>

  );

}




