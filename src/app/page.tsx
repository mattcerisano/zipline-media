'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import LogoTicker from '@/components/LogoTicker';
import { Check, Play, X } from 'lucide-react';

function Hero() {
  const [isIntroComplete, setIsIntroComplete] = useState(false);
  const [isPlayingReel, setIsPlayingReel] = useState(false);
  const text = "zzzzip";
  const letters = text.split("");

  useEffect(() => {
    if (!isIntroComplete) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [isIntroComplete]);

  return (
    <section id="home" className="relative h-dvh w-full overflow-hidden flex items-center justify-center bg-black">
      {/* --- INTRO ANIMATION LAYER --- */}
      <AnimatePresence>
        {!isIntroComplete && (
          <motion.div 
            className="absolute inset-0 z-50 bg-black flex items-center justify-center overflow-hidden"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="relative w-full max-w-[95vw] overflow-hidden">
              <motion.h1 
                className="text-[12vw] md:text-[8vw] font-black leading-none text-white whitespace-nowrap text-center"
                initial={{ x: 0 }}
              >
                {letters.map((char, index) => (
                  <motion.span
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      delay: index * 0.12, // More deliberate typing
                      duration: 0.1,
                    }}
                    onAnimationComplete={() => {
                      if (index === letters.length - 1) {
                        setTimeout(() => setIsIntroComplete(true), 600); // Longer pause before revealing site
                      }
                    }}
                  >
                    {char}
                  </motion.span>
                ))}
              </motion.h1>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MAIN HERO CONTENT (Revealed after intro) --- */}
      <div className="hidden md:block absolute inset-0 z-0">
        <video 
          autoPlay 
          muted 
          loop 
          playsInline 
          className="w-full h-full object-cover"
        >
          <source src="/LandingPage.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/70 z-10" />
      </div>

      <div className="relative z-20 text-center px-6 w-full max-w-[95vw] mx-auto">
        
        {/* Desktop: Text */}
        <div className="hidden md:flex flex-col items-center gap-2">
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={isIntroComplete ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 1.5, delay: 0.2 }}
            className="text-[8vw] sm:text-[7vw] md:text-[6vw] lg:text-7xl font-black tracking-tighter text-white leading-none whitespace-nowrap"
          >
            FULL SERVICE
          </motion.h1>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={isIntroComplete ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 1.5, delay: 0.4 }}
            className="text-[8vw] sm:text-[7vw] md:text-[6vw] lg:text-7xl font-black tracking-tighter text-white leading-none whitespace-nowrap"
          >
            VIDEO PRODUCTION
          </motion.h1>
        </div>

        {/* Mobile: Logo */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isIntroComplete ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="flex md:hidden justify-center items-center"
        >
          <Image 
            src="/Zipline Logo FULL Blue.png" 
            alt="Zipline Media" 
            width={300}
            height={100}
            priority
            className="w-[80vw] max-w-[300px] h-auto object-contain"
          />
        </motion.div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={isIntroComplete ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.6, duration: 1.2 }}
          className="text-sm md:text-xl font-bold tracking-[0.3em] uppercase opacity-80 text-white leading-relaxed mt-6"
        >
          PRE. PROD. POST.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={isIntroComplete ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 1, duration: 1.2 }}
          className="mt-10"
        >
          <a 
            href="/archive" 
            className="inline-block border border-white/20 px-8 py-4 text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase hover:bg-white hover:text-black transition-all duration-300"
          >
            See our work
          </a>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={isIntroComplete ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3"
      >
        <span className="md:hidden text-[10px] font-bold tracking-[0.3em] uppercase opacity-50">Scroll</span>
        <div className="w-[2px] md:w-px h-16 md:h-12 bg-white/20 relative overflow-hidden">
          <motion.div 
            animate={{ y: [0, 64] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="absolute top-0 left-0 w-full h-1/2 bg-white"
          />
        </div>
      </motion.div>

      {/* --- REEL MODAL --- */}
      <AnimatePresence>
        {isPlayingReel && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black p-4 md:p-12"
          >
            <button 
              onClick={() => setIsPlayingReel(false)}
              className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors z-[110]"
            >
              <X className="w-8 h-8" />
            </button>
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-6xl aspect-video bg-neutral-900 rounded-sm overflow-hidden shadow-2xl border border-white/10"
            >
              <video 
                autoPlay 
                controls 
                playsInline 
                className="w-full h-full object-contain"
              >
                <source src="/broadway-reel.mp4" type="video/mp4" />
              </video>
            </motion.div>
            
            <div className="absolute inset-0 -z-10" onClick={() => setIsPlayingReel(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Work() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const categories = [
    { id: 'performance', title: 'Performance', video: '/broadway-performance.mp4', link: '/archive#performance' },
    { id: 'brands', title: 'Brands', video: '/corporate.mp4', link: '/archive#brands' },
    { id: 'new-media', title: 'New Media', video: '/new-media.mp4', link: '/archive#new-media' },
  ];

  const [isTransitioning, setIsTransitioning] = useState(false);
  const router = useRouter();

  const handleWorkClick = (e: React.MouseEvent<HTMLAnchorElement>, link: string) => {
    e.preventDefault();
    setIsTransitioning(true);
    setTimeout(() => {
      router.push(link);
    }, 500); // Match duration of fade
  };

  return (
    <section id="work" className="bg-black py-8 md:py-16 px-6 scroll-mt-24 relative">
      {/* Page Transition Overlay */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] bg-black pointer-events-none"
          />
        )}
      </AnimatePresence>
      <div className="max-w-7xl mx-auto">
        
        {/* --- MOBILE LAYOUT (Simple Stack) --- */}
        <div className="flex flex-col gap-6 md:hidden">
          {categories.map((cat) => (
            <div key={cat.id} className="relative w-full h-[50vh] rounded-2xl overflow-hidden border border-white/10 bg-black group">
              <video
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              >
                <source src={cat.video} type="video/mp4" />
              </video>
              
              <a 
                href={cat.link} 
                onClick={(e) => handleWorkClick(e, cat.link)}
                className="absolute inset-0 z-20" 
                aria-label={`View ${cat.title} Projects`} 
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent p-8 flex flex-col justify-end items-start pointer-events-none">
                <div className="flex items-end gap-3 mb-2">
                  <h2 className="text-xl font-black uppercase tracking-tighter text-white leading-none">
                    {cat.title}
                  </h2>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* --- DESKTOP LAYOUT (Interactive Bento) --- */}
        <div className="hidden md:flex h-[80vh] flex-row gap-4">
          
          {/* LEFT COLUMN (Performance) */}
          <motion.div 
            onMouseEnter={() => setHoveredId('performance')}
            onMouseLeave={() => setHoveredId(null)}
            animate={{ 
              opacity: hoveredId && hoveredId !== 'performance' ? 0.3 : 1
            }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="relative overflow-hidden group rounded-2xl border border-white/10 bg-black h-full cursor-pointer flex-[1.5]"
          >
            <motion.div 
              className="absolute inset-0 w-full h-full"
            >
              <video
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              >
                <source src="/broadway-performance.mp4" type="video/mp4" />
              </video>
            </motion.div>
            
            <a 
              href="/archive#performance" 
              onClick={(e) => handleWorkClick(e, "/archive#performance")}
              className="absolute inset-0 z-20" 
              aria-label="View Performance Projects" 
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent p-10 flex flex-col justify-end items-start pointer-events-none">
               <div className="flex items-end gap-4">
                 <motion.h2 
                   className="font-black uppercase tracking-tighter text-white leading-none whitespace-nowrap"
                   animate={{ 
                     scale: hoveredId === 'performance' ? 1.05 : 1,
                     originX: 0 
                   }}
                   style={{ fontSize: 'clamp(1rem, 1.8vw, 1.5rem)' }}
                 >
                   Performance
                 </motion.h2>
               </div>
            </div>
          </motion.div>

          {/* RIGHT COLUMN WRAPPER */}
          <div 
            className="flex flex-col gap-4 h-full flex-1"
          >
            {/* TOP RIGHT (Brands) */}
            <motion.div 
              onMouseEnter={() => setHoveredId('brands')}
              onMouseLeave={() => setHoveredId(null)}
              animate={{ 
                opacity: hoveredId && hoveredId !== 'brands' ? 0.3 : 1
              }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="relative overflow-hidden group rounded-2xl border border-white/10 bg-black w-full cursor-pointer flex-1"
            >
               <motion.div 
                 className="absolute inset-0 w-full h-full"
               >
                 <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                >
                  <source src="/corporate.mp4" type="video/mp4" />
                </video>
              </motion.div>

              <a 
                href="/archive#brands" 
                onClick={(e) => handleWorkClick(e, "/archive#brands")}
                className="absolute inset-0 z-20" 
                aria-label="View Brands Projects" 
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent p-8 flex flex-col justify-end items-start pointer-events-none">
                 <div className="flex items-end gap-4">
                   <motion.h2 
                     className="font-black uppercase tracking-tighter text-white leading-none"
                     animate={{ 
                       scale: hoveredId === 'brands' ? 1.05 : 1,
                       originX: 0 
                     }}
                     style={{ fontSize: 'clamp(1rem, 1.8vw, 1.5rem)' }}
                   >
                     Brands
                   </motion.h2>
               </div>
            </div>
          </motion.div>

            {/* BOTTOM RIGHT (New Media) */}
            <motion.div 
              onMouseEnter={() => setHoveredId('new-media')}
              onMouseLeave={() => setHoveredId(null)}
              animate={{ 
                opacity: hoveredId && hoveredId !== 'new-media' ? 0.3 : 1
              }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="relative overflow-hidden group rounded-2xl border border-white/10 bg-black w-full cursor-pointer flex-1"
            >
               <motion.div 
                 className="absolute inset-0 w-full h-full"
               >
                 <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                >
                  <source src="/new-media.mp4" type="video/mp4" />
                </video>
              </motion.div>

              <a 
                href="/archive#new-media" 
                onClick={(e) => handleWorkClick(e, "/archive#new-media")}
                className="absolute inset-0 z-20" 
                aria-label="View New Media Projects" 
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent p-8 flex flex-col justify-end items-start pointer-events-none">
                 <div className="flex items-end gap-4">
                   <motion.h2 
                     className="font-black uppercase tracking-tighter text-white leading-none"
                     animate={{ 
                       scale: hoveredId === 'new-media' ? 1.05 : 1,
                       originX: 0 
                     }}
                     style={{ fontSize: 'clamp(1rem, 1.8vw, 1.5rem)' }}
                   >
                     New Media
                   </motion.h2>
               </div>
            </div>
          </motion.div>

          </div>
        </div>

      </div>

      <div className="mt-8 text-center">
        <a 
          href="/archive" 
          className="inline-block border border-white/20 px-8 py-5 md:px-12 md:py-6 text-xs font-bold tracking-[0.2em] uppercase hover:bg-white hover:text-black transition-all duration-300 w-full md:w-auto"
        >
          See more
        </a>
      </div>
    </section>
  );
}

function LazyVideo({ src, poster, title }: { src: string, poster?: string, title: string }) {
  const [inView, setInView] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    }, { 
      // Large margin to ensure videos are buffered before they enter the screen
      rootMargin: '1200px',
      threshold: 0.01 
    });
    
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 w-full h-full bg-black flex items-center justify-center">
      {/* Poster layer: always present as fallback, fades out when video is ready */}
      {poster && (
        <Image 
          src={poster} 
          alt={title}
          fill
          unoptimized={poster.includes('ytimg.com') || poster.includes('vimeocdn.com')}
          className={`object-cover transition-opacity duration-500 z-10 ${videoLoaded ? 'opacity-0' : 'opacity-100'}`}
        />
      )}
      
      {!poster && (
        <div className={`absolute inset-0 flex items-center justify-center bg-neutral-900 text-[10px] font-bold uppercase opacity-20 text-center px-4 leading-tight z-10 transition-opacity duration-500 ${videoLoaded ? 'opacity-0' : 'opacity-100'}`}>
          {title}
        </div>
      )}

      {/* Load video when in view. */}
      {inView && (
        <video 
          autoPlay
          muted 
          loop 
          playsInline
          preload="auto"
          onPlaying={() => setVideoLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-500 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
        >
          <source src={src} type="video/mp4" />
        </video>
      )}
    </div>
  );
}

function Social() {
  const clips = [
    {
      title: "Death Becomes Her | Slapping",
      thumbnail: "https://i.ytimg.com/vi/mV5xdHHtQD0/mqdefault.jpg", // Temporary fallback
      videoUrl: "#",
      localVideo: "/DBH_Slapping.mp4"
    },
    {
      title: "MAC | Getting Dressed",
      thumbnail: "https://i.ytimg.com/vi/mV5xdHHtQD0/mqdefault.jpg", 
      videoUrl: "#",
      localVideo: "/Mac_GettingDressed.mp4"
    },
    {
      title: "MAC | Lipstick Pop Off",
      thumbnail: "https://i.ytimg.com/vi/mV5xdHHtQD0/mqdefault.jpg", 
      videoUrl: "#",
      localVideo: "/Mac_Lipstick.mp4"
    },
    {
      title: "SIX | Broadway",
      thumbnail: "https://i.ytimg.com/vi/u_2Z_vExxeo/mqdefault.jpg",
      videoUrl: "https://www.instagram.com/sixbroadway/reel/DLIK-qpu4fK/",
      localVideo: "/Six_SocialThumbnail.mp4"
    },
    {
      title: "Death Becomes Her | Hero",
      thumbnail: "https://i.ytimg.com/vi/mV5xdHHtQD0/mqdefault.jpg",
      videoUrl: "https://www.instagram.com/reel/C22dScAOtLs/",
      localVideo: "/DBH_Hero_SocialThumbnail.mp4"
    },
    {
      title: "Moulin Rouge | Titus Burgess",
      thumbnail: "https://i.ytimg.com/vi/7funQCcxymc/mqdefault.jpg",
      videoUrl: "https://www.instagram.com/reel/CzwFK9hudGJ/",
      localVideo: "/MRTM_Titus_SocialThumbnail.mp4"
    },
    {
      title: "‘Good Fortune’ with Keanu Reeves, Seth Rogen and Aziz Ansari",
      thumbnail: "https://i.ytimg.com/vi/bCy3RdLHC0Q/mqdefault.jpg",
      videoUrl: "https://www.instagram.com/reel/DPwKObAEczB/",
      localVideo: "/Keke_SocialThumbnail_V2.mp4"
    },
    {
      title: "Golden Hour | The Queen of Versailles on Broadway",
      thumbnail: "https://i.ytimg.com/vi/w4xaJxeUIaw/mqdefault.jpg",
      videoUrl: "https://www.instagram.com/reel/DQ1wezMjxox/",
      localVideo: "/QoV_SocialThumbnail_2.mp4"
    },
    {
      title: "New Heights with Ben Stiller",
      thumbnail: "https://i.ytimg.com/vi/G0oyW5uuVoI/mqdefault.jpg",
      videoUrl: "https://www.instagram.com/reel/DHY8Ek9SH8L/",
      localVideo: "/NewHeights_SocialThumbnail.mp4"
    },
    {
      title: "Just in Time | Opening Night",
      thumbnail: "https://i.ytimg.com/vi/9QCHsiR8QrQ/mqdefault.jpg",
      videoUrl: "https://www.instagram.com/reel/DQHhmcBDh26/",
      localVideo: "/Just in Time_SocialThumbnail.mp4"
    },
    {
      title: "Lempicka | Broadway Montage",
      thumbnail: "https://i.ytimg.com/vi/fovrHNNiF-4/mqdefault.jpg",
      videoUrl: "https://www.instagram.com/reel/C5xFue1Na5r/",
      localVideo: "/Lempicka_SocialThumbnail.mp4"
    },
    {
      title: "Boop! The Musical | Recording Studio",
      thumbnail: "https://i.ytimg.com/vi/rhyiqvVNsUo/mqdefault.jpg",
      videoUrl: "https://www.instagram.com/reel/DDsKJAFPPRV/",
      localVideo: "/Boop_SocialThumbnail.mp4"
    },
    {
      title: "Marjorie Prime | Opening Night",
      thumbnail: "https://i.ytimg.com/vi/ZD4VpzBu2jo/mqdefault.jpg",
      videoUrl: "https://www.instagram.com/reel/DUbfNv0knpW/",
      localVideo: "/Marjorie Prime_SocialThumbnail.mp4"
    },
    {
      title: "The Lost Boys | Have to Have You",
      thumbnail: "https://i.ytimg.com/vi/bGr0zWPjpOI/mqdefault.jpg",
      videoUrl: "https://www.instagram.com/reel/DSApMrfgEVN/",
      localVideo: "/LostBoy_SocialThumbnail.mp4"
    },
    {
      title: "Bob The Drag Queen | Harold Zidler",
      thumbnail: "https://i.ytimg.com/vi/2tf1pGxy3Ks/mqdefault.jpg",
      videoUrl: "https://www.instagram.com/reel/DR2a5GfDj4-/",
      localVideo: "/Bob_SocialThumbnail.mp4"
    },
    {
      title: "Tony Awards | First Impressions",
      thumbnail: "https://i.ytimg.com/vi/XpyvXLCZMOo/mqdefault.jpg",
      videoUrl: "https://www.instagram.com/reel/DKqmL-vMmQo/",
      localVideo: "/TonyAwards_SocialThumbnail.mp4"
    }
  ];



  return (
    <section className="pt-12 pb-8 bg-black overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-12 text-center">
        <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase mb-4">Social First</h2>
        <p className="text-sm md:text-base opacity-60 max-w-xl mx-auto">
          If it can&apos;t fit into a 9:16, ya shoulda been wider. We consider the social post from the start of every project to stop the scroll.
        </p>
      </div>
      
      {/* Marquee of 9:16 Videos */}
      <div className="relative group/marquee">
        
        {/* Infinite Marquee (All screens) */}
        <div className="flex overflow-hidden relative">
          <div className="flex w-max animate-scroll whitespace-nowrap pointer-events-none">
            {/* Render 4 sets to ensure seamless loop with -25% animation */}
            {[...Array(4)].map((_, setIndex) => (
              <div key={`set-${setIndex}`} className="flex gap-3 md:gap-6 px-2 md:px-3">
                {clips.map((clip, i) => (
                  <div 
                    key={`${setIndex}-${i}`} 
                    className="shrink-0 w-[160px] md:w-[300px] aspect-[9/16] bg-black relative rounded-lg overflow-hidden border border-white/10 group cursor-default"
                  >
                     <LazyVideo src={clip.localVideo} poster={clip.thumbnail} title={clip.title} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ... Clients component remains unchanged ...

function Mission() {
  return (
    <section className="py-12 px-6 max-w-7xl mx-auto flex flex-col items-center gap-6 md:gap-10 scroll-mt-24">
      <div className="max-w-4xl mx-auto text-center space-y-12">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-5xl font-black tracking-tighter uppercase leading-tight"
        >
          We don&apos;t do &quot;Marketing Speak.&quot; <br/>
          <span className="text-[var(--accent)]">We just make it look cool.</span>
        </motion.h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm md:text-base opacity-70 leading-relaxed font-medium text-center">
          <p>
            We&apos;re the kind of team that can pivot on a dime and still make it look intentional. Big, glossy TV spots? Done. TikToks that don&apos;t feel like ads? Absolutely. Social campaigns, branded docs, narrative pieces&mdash;this is our playground.
          </p>
          <p>
            And sure, we&apos;ve picked up some awards and worked with names you&apos;d definitely recognize&mdash;but that&apos;s not the point. What matters is showing up, getting it done, and keeping the vibe good. Clients tend to like having us around, and we like keeping it that way.
          </p>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="py-12 px-6 max-w-7xl mx-auto flex flex-col items-center gap-6 md:gap-10 scroll-mt-24">
      
      {/* 2. Ticker */}
      <div className="w-full">
        <LogoTicker />
      </div>
    </section>
  );
}

function Contact() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    setStatus('submitting');

    try {
      const response = await fetch("https://formspree.io/f/mgokbqag", {
        method: "POST",
        body: data,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        setStatus('success');
        form.reset();
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  }

  return (
    <section id="contact" className="py-12 md:py-24 px-6 max-w-4xl mx-auto flex flex-col items-center justify-center scroll-mt-24 text-center">
      <div className="w-full space-y-16">
        <div className="space-y-8">
          <motion.div
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter uppercase leading-[1.3] md:leading-none">
              LET&apos;S<br className="md:hidden" />
              <span className="hidden md:inline">&nbsp;</span>
              CONNECT.
            </h2>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="flex flex-col items-center"
          >
            <p className="text-lg md:text-xl opacity-60 max-w-2xl mb-8 text-center">
              Have a project and don&apos;t know where to begin? Drop us a line and say hello!
            </p>
            
            <div className="flex flex-col md:flex-row gap-4 md:gap-12">
              <p className="text-xs tracking-[0.3em] font-bold uppercase">CONTACT@ZIPLINE.MEDIA</p>
              <p className="text-xs tracking-[0.3em] font-bold uppercase opacity-40">NEW YORK, NY</p>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full"
        >
          <form 
            onSubmit={handleSubmit}
            className="space-y-10 bg-neutral-900/30 p-8 md:p-12 border border-white/5 text-left max-w-3xl mx-auto"
          >
            {/* Formspree Subject Customization */}
            <input type="hidden" name="_subject" value="New Inquiry from Zipline Website" />
            
            <div className="space-y-2">
              <label className="text-xs tracking-[0.4em] uppercase opacity-40 font-bold">Name</label>
              <input 
                type="text" 
                name="name"
                required
                className="w-full bg-transparent border-b border-white/30 py-3 outline-none focus:border-white transition-colors uppercase text-base md:text-sm" 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs tracking-[0.4em] uppercase opacity-40 font-bold">Email</label>
              <input 
                type="email" 
                name="email"
                required
                className="w-full bg-transparent border-b border-white/30 py-3 outline-none focus:border-white transition-colors uppercase text-base md:text-sm" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs tracking-[0.4em] uppercase opacity-40 font-bold">Message</label>
              <textarea 
                name="message"
                rows={4} 
                required
                className="w-full bg-transparent border-b border-white/30 py-3 outline-none focus:border-white transition-colors resize-none uppercase text-base md:text-sm" 
              />
            </div>

            <button 
              type="submit" 
              disabled={status === 'submitting' || status === 'success'}
              className={`w-full font-black py-5 tracking-[0.3em] uppercase transition-all text-xs duration-300 flex items-center justify-center gap-2
                ${status === 'success' 
                  ? 'bg-green-500 text-black' 
                  : 'bg-white text-black hover:bg-[var(--accent)] hover:text-white'
                }
              `}
            >
              {status === 'submitting' && "Sending..."}
              {status === 'success' && (
                <>
                  <span>Sent</span>
                  <Check className="w-4 h-4" />
                </>
              )}
              {status === 'error' && "Error - Try Again"}
              {status === 'idle' && "Send Inquiry"}
            </button>
          </form>
        </motion.div>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <main className="bg-black">
      <Hero />
      <Work />
      <Mission />
      <Social />
      <About />
      <Contact />
    </main>
  );
}