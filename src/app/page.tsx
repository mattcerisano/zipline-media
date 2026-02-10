'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import Link from 'next/link';
import LogoTicker from '@/components/LogoTicker';
import { Check, Play } from 'lucide-react';

function Hero() {
  const [isIntroComplete, setIsIntroComplete] = useState(false);
  const text = "zzzzip";
  const letters = text.split("");

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
                      delay: index * 0.01, // Near-instant typing
                      duration: 0,
                    }}
                    onAnimationComplete={() => {
                      if (index === letters.length - 1) {
                        setTimeout(() => setIsIntroComplete(true), 100); // Minimal pause
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
          <div className="overflow-hidden py-2">
            <motion.h1 
              initial={{ y: "100%" }}
              animate={isIntroComplete ? { y: 0 } : { y: "100%" }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className="text-[8vw] sm:text-[7vw] md:text-[6vw] lg:text-7xl font-black tracking-tighter text-white leading-none whitespace-nowrap"
            >
              FULL SERVICE
            </motion.h1>
          </div>
          <div className="overflow-hidden py-2">
            <motion.h1 
              initial={{ y: "100%" }}
              animate={isIntroComplete ? { y: 0 } : { y: "100%" }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
              className="text-[8vw] sm:text-[7vw] md:text-[6vw] lg:text-7xl font-black tracking-tighter text-white leading-none whitespace-nowrap"
            >
              VIDEO PRODUCTION
            </motion.h1>
          </div>
        </div>

        {/* Mobile: Logo */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isIntroComplete ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="flex md:hidden justify-center items-center"
        >
          <img 
            src="/Zipline Logo FULL Blue.png" 
            alt="Zipline Media" 
            className="w-[80vw] max-w-[300px] h-auto object-contain"
          />
        </motion.div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={isIntroComplete ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="text-sm md:text-xl font-bold tracking-[0.3em] uppercase opacity-80 text-white leading-relaxed mt-6"
        >
          PRE. PROD. POST.
        </motion.p>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={isIntroComplete ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
      >
        <div className="w-px h-12 bg-white/20 relative overflow-hidden">
          <motion.div 
            animate={{ y: [0, 48] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="absolute top-0 left-0 w-full h-1/2 bg-white"
          />
        </div>
      </motion.div>
    </section>
  );
}

function Work() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Helper to determine flex-grow values based on hover state (Desktop Only)
  const getFlexGrow = (id: string, isRightColumn = false) => {
    if (!hoveredId) return isRightColumn ? 1 : 1.5; 
    
    if (isRightColumn) {
       if (hoveredId === id) return 3; 
       if (['business', 'new-media'].includes(hoveredId)) return 1; 
       return 1; 
    }

    if (id === 'performance') {
       return hoveredId === 'performance' ? 2 : 1;
    }
    if (id === 'right-wrapper') {
       return ['business', 'new-media'].includes(hoveredId) ? 2 : 1;
    }
    return 1;
  };

  const categories = [
    { id: 'performance', title: 'Performance', video: '/broadway-performance.mp4', link: '/archive#opening-nights' },
    { id: 'business', title: 'Brands', video: '/corporate.mp4', link: '/archive#tvc' },
    { id: 'new-media', title: 'New Media', video: '/new-media.mp4', link: '/archive#new-media' },
  ];

  return (
    <section id="work" className="bg-black py-10 md:py-20 px-6 scroll-mt-24">
      <div className="max-w-7xl mx-auto">
        
        {/* --- MOBILE LAYOUT (Simple Stack) --- */}
        <div className="flex flex-col gap-6 md:hidden">
          {categories.map((cat) => (
            <div key={cat.id} className="relative w-full h-[50vh] rounded-2xl overflow-hidden border border-white/10 bg-neutral-900 group">
              <video
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 w-full h-full object-cover opacity-60"
              >
                <source src={cat.video} type="video/mp4" />
              </video>
              
              <Link href={cat.link} className="absolute inset-0 z-20" aria-label={`View ${cat.title} Projects`} />

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent p-8 flex flex-col justify-end items-start pointer-events-none">
                <div className="flex items-end gap-3 mb-2">
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-white leading-none">
                    {cat.title}
                  </h2>
                  <div className="bg-white text-black p-1.5 rounded-full mb-1">
                    <Play className="w-3 h-3 fill-current" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* --- DESKTOP LAYOUT (Interactive Bento) --- */}
        <div className="hidden md:flex h-[80vh] flex-row gap-4">
          
          {/* LEFT COLUMN (Performance) */}
          <motion.div 
            layout
            onMouseEnter={() => setHoveredId('performance')}
            onMouseLeave={() => setHoveredId(null)}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="relative overflow-hidden group rounded-2xl border border-white/10 bg-neutral-900 h-full cursor-pointer"
            style={{ flex: getFlexGrow('performance') }}
          >
            <motion.div 
              className="absolute inset-0 w-full h-full"
              animate={{ 
                opacity: (hoveredId && hoveredId !== 'performance') ? 0.4 : 1,
              }}
              transition={{ duration: 0.5 }}
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
            
            <Link href="/archive#opening-nights" className="absolute inset-0 z-20" aria-label="View Performance Projects" />

            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent p-10 flex flex-col justify-end items-start pointer-events-none">
               <motion.div layout className="flex items-end gap-4">
                 <motion.h2 
                   layout
                   className="font-black uppercase tracking-tighter text-white leading-none whitespace-nowrap"
                   animate={{ 
                     scale: hoveredId === 'performance' ? 1.05 : 1,
                     originX: 0 
                   }}
                   style={{ fontSize: 'clamp(1rem, 1.8vw, 1.5rem)' }}
                 >
                   Performance
                 </motion.h2>
                 <motion.div
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ 
                     opacity: hoveredId === 'performance' ? 1 : 0,
                     x: hoveredId === 'performance' ? 0 : -10 
                   }}
                   className="mb-2 md:mb-4"
                 >
                   <div className="bg-white text-black p-2 rounded-full">
                     <Play className="w-4 h-4 fill-current" />
                   </div>
                 </motion.div>
               </motion.div>
            </div>
          </motion.div>

          {/* RIGHT COLUMN WRAPPER */}
          <motion.div 
            layout
            className="flex flex-col gap-4 h-full"
            style={{ flex: getFlexGrow('right-wrapper') }}
          >
            {/* TOP RIGHT (Business) */}
            <motion.div 
              layout
              onMouseEnter={() => setHoveredId('business')}
              onMouseLeave={() => setHoveredId(null)}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="relative overflow-hidden group rounded-2xl border border-white/10 bg-neutral-900 w-full cursor-pointer"
              style={{ flex: getFlexGrow('business', true) }}
            >
               <motion.div 
                 className="absolute inset-0 w-full h-full"
                 animate={{ 
                   opacity: (hoveredId && hoveredId !== 'business') ? 0.4 : 1,
                 }}
                 transition={{ duration: 0.5 }}
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

              <Link href="/archive#tvc" className="absolute inset-0 z-20" aria-label="View Business Projects" />

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent p-8 flex flex-col justify-end items-start pointer-events-none">
                 <motion.div layout className="flex items-end gap-4">
                   <motion.h2 
                     layout
                     className="font-black uppercase tracking-tighter text-white leading-none"
                     animate={{ 
                       scale: hoveredId === 'business' ? 1.05 : 1,
                       originX: 0 
                     }}
                     style={{ fontSize: 'clamp(1rem, 1.8vw, 1.5rem)' }}
                   >
                     Business
                   </motion.h2>
                   <motion.div
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ 
                       opacity: hoveredId === 'business' ? 1 : 0,
                       x: hoveredId === 'business' ? 0 : -10 
                     }}
                     className="mb-1 md:mb-2"
                   >
                     <div className="bg-white text-black p-1.5 rounded-full">
                       <Play className="w-3 h-3 fill-current" />
                     </div>
                   </motion.div>
                 </motion.div>
              </div>
            </motion.div>

            {/* BOTTOM RIGHT (New Media) */}
            <motion.div 
              layout
              onMouseEnter={() => setHoveredId('new-media')}
              onMouseLeave={() => setHoveredId(null)}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="relative overflow-hidden group rounded-2xl border border-white/10 bg-neutral-900 w-full cursor-pointer"
              style={{ flex: getFlexGrow('new-media', true) }}
            >
               <motion.div 
                 className="absolute inset-0 w-full h-full"
                 animate={{ 
                   opacity: (hoveredId && hoveredId !== 'new-media') ? 0.4 : 1,
                 }}
                 transition={{ duration: 0.5 }}
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

              <Link href="/archive#new-media" className="absolute inset-0 z-20" aria-label="View New Media Projects" />

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent p-8 flex flex-col justify-end items-start pointer-events-none">
                 <motion.div layout className="flex items-end gap-4">
                   <motion.h2 
                     layout
                     className="font-black uppercase tracking-tighter text-white leading-none"
                     animate={{ 
                       scale: hoveredId === 'new-media' ? 1.05 : 1,
                       originX: 0 
                     }}
                     style={{ fontSize: 'clamp(1rem, 1.8vw, 1.5rem)' }}
                   >
                     New Media
                   </motion.h2>
                   <motion.div
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ 
                       opacity: hoveredId === 'new-media' ? 1 : 0,
                       x: hoveredId === 'new-media' ? 0 : -10 
                     }}
                     className="mb-1 md:mb-2"
                   >
                     <div className="bg-white text-black p-1.5 rounded-full">
                       <Play className="w-3 h-3 fill-current" />
                     </div>
                   </motion.div>
                 </motion.div>
              </div>
            </motion.div>

          </motion.div>
        </div>

      </div>

      <div className="mt-12 text-center">
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

function Social() {
  const clips = [
    {
      title: "The Most BROADWAY Broadway Opening Night | SMASH The Musical",
      thumbnail: "https://i.ytimg.com/vi/9QCHsiR8QrQ/mqdefault.jpg",
      videoUrl: "https://www.youtube.com/embed/9QCHsiR8QrQ",
      category: "Opening Nights",
      localVideo: "/social-clip-1.mov"
    },
    {
      title: "Sarah Snook | 2024 Tony Awards First Impressions",
      thumbnail: "https://i.ytimg.com/vi/1RW3OCUMp4s/hqdefault.jpg",
      videoUrl: "https://www.youtube.com/embed/1RW3OCUMp4s",
      category: "New Media",
      localVideo: "/social-clip-2.mov"
    },
    {
      title: "Moulin Rouge! The Musical | Automation & Carpentry",
      thumbnail: "https://i.ytimg.com/vi/tkQzaEmYQdo/hqdefault.jpg",
      videoUrl: "https://www.youtube.com/embed/tkQzaEmYQdo",
      category: "Broadway B-Roll",
      localVideo: "/social-clip-3.mov"
    },
    {
      title: "Robyn Hurder is Ivy Lynn | SMASH The Musical",
      thumbnail: "https://i.ytimg.com/vi/SzzqFdtpoAk/mqdefault.jpg",
      videoUrl: "https://www.youtube.com/embed/SzzqFdtpoAk",
      category: "Reveals",
      localVideo: "/social-clip-4.mov"
    },
    {
      title: "T-Mobile | Winners Circle Sizzle",
      thumbnail: "https://i.vimeocdn.com/video/1356334895-48a78ad477f304d334f5dba31b37bc8eac597308ae55584a9cb6b17ee4aaac5c-d_1920x1080?&r=pad&region=us",
      videoUrl: "https://player.vimeo.com/video/542369134",
      category: "TVC",
      localVideo: "/social-clip-5.mov"
    },
    {
      title: "\"Where I Wanna Be\" from Boop! The Musical",
      thumbnail: "https://i.ytimg.com/vi/rhyiqvVNsUo/mqdefault.jpg",
      videoUrl: "https://www.youtube.com/embed/rhyiqvVNsUo",
      category: "Cast Recordings",
      localVideo: "/social-clip-6.mov"
    }
  ];

  return (
    <section className="pt-16 pb-10 bg-black overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-12">
        <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase mb-4">Built for the Feed</h2>
        <p className="text-sm md:text-base opacity-60 max-w-xl">
          We don&apos;t just resize horizontal video. We shoot specifically for vertical 9:16 to stop the scroll.
        </p>
      </div>
      
      {/* Marquee of 9:16 Videos */}
      <div className="flex gap-6 overflow-x-auto pb-8 px-6 no-scrollbar snap-x touch-pan-x">
        {clips.map((clip, i) => (
          <a 
            key={i} 
            href={clip.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="snap-center shrink-0 w-[200px] md:w-[300px] aspect-[9/16] bg-neutral-900 relative rounded-lg overflow-hidden border border-white/10 group cursor-pointer"
          >
             {clip.localVideo ? (
               <video 
                 autoPlay 
                 muted 
                 loop 
                 playsInline 
                 className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-700"
               >
                 <source src={clip.localVideo} type="video/quicktime" />
                 <source src={clip.localVideo} type="video/mp4" />
               </video>
             ) : (
               <div 
                 className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105 opacity-60 group-hover:opacity-100"
                 style={{ backgroundImage: `url(${clip.thumbnail})` }}
               />
             )}
             
             {/* Play button overlay */}
             <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                   <Play className="w-5 h-5 text-white fill-white" />
                </div>
             </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ... Clients component remains unchanged ...

function About() {
  return (
    <section id="about" className="py-16 px-6 max-w-7xl mx-auto flex flex-col items-center gap-8 md:gap-12">
      
      {/* 1. Header */}
      <div className="text-center space-y-4">
        <p className="text-sm md:text-lg font-medium tracking-[0.2em] uppercase opacity-50">
          High drama for Broadway. No drama for you.
        </p>
      </div>

      {/* 2. Ticker */}
      <div className="w-full">
        <LogoTicker />
      </div>

      {/* 3. Mission Text */}
      <div className="flex flex-col items-start w-full">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-6xl font-black tracking-tighter uppercase leading-tight mb-8 md:mb-12 max-w-4xl"
        >
          We don&apos;t do &quot;Marketing Speak.&quot; <br/>
          <span className="text-[var(--accent)]">We just make it look cool.</span>
        </motion.h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 text-sm md:text-lg opacity-70 leading-relaxed font-medium">
          <p>
            Our process begins with a conversation to understand your objectives, brand story, and desired visual style.
          </p>
          <p>
            We are smart, adaptable, and innovative - whether you want stunning TV commercials, engaging TikToks, high-quality social media ads, or dynamic narrative videos, we got you covered.
          </p>
        </div>
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
    <section id="contact" className="py-16 md:py-20 px-6 max-w-7xl mx-auto flex flex-col justify-center scroll-mt-24">
      <div className="flex flex-col lg:flex-row gap-20 items-start">
        <div className="w-full lg:w-1/2 text-left overflow-hidden py-4">
          <motion.div
             initial={{ y: "100%" }}
             whileInView={{ y: 0 }}
             viewport={{ once: true }}
             transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-5xl md:text-8xl font-black tracking-tighter mb-8 uppercase leading-[0.9]">
              LET&apos;S ROLL.
            </h2>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            <p className="text-xl opacity-60 max-w-md mb-12">
              Have a project in mind? We&apos;d love to hear about your vision and how we can help bring it to life.
            </p>
            
            <div className="space-y-4">
              <p className="text-xs tracking-[0.3em] font-bold uppercase">CONTACT@ZIPLINE.MEDIA</p>
              <p className="text-xs tracking-[0.3em] font-bold uppercase opacity-40">NEW YORK, NY</p>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="w-full lg:w-1/2"
        >
          <form 
            onSubmit={handleSubmit}
            className="space-y-10 bg-neutral-900/30 p-8 md:p-12 border border-white/5 text-left"
          >
            <div className="space-y-2">
              <label className="text-xs tracking-[0.4em] uppercase opacity-40 font-bold">Name</label>
              <input 
                type="text" 
                name="name"
                required
                className="w-full bg-transparent border-b border-white/30 py-3 outline-none focus:border-white transition-colors uppercase text-sm" 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs tracking-[0.4em] uppercase opacity-40 font-bold">Email</label>
              <input 
                type="email" 
                name="email"
                required
                className="w-full bg-transparent border-b border-white/30 py-3 outline-none focus:border-white transition-colors uppercase text-sm" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs tracking-[0.4em] uppercase opacity-40 font-bold">Project Type</label>
              <select 
                name="projectType"
                className="w-full bg-transparent border-b border-white/30 py-3 outline-none focus:border-white transition-colors appearance-none uppercase text-sm rounded-none"
              >
                <option className="bg-black">Performance / Narrative</option>
                <option className="bg-black">Brand / Corporate</option>
                <option className="bg-black">Creative / Social</option>
                <option className="bg-black">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs tracking-[0.4em] uppercase opacity-40 font-bold">Message</label>
              <textarea 
                name="message"
                rows={4} 
                required
                className="w-full bg-transparent border-b border-white/30 py-3 outline-none focus:border-white transition-colors resize-none uppercase text-sm" 
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
      <Social />
      <About />
      <Contact />
    </main>
  );
}
