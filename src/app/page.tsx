'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import LogoTicker from '@/components/LogoTicker';

function Hero() {
  const [isIntroComplete, setIsIntroComplete] = useState(false);
  const text = "zzzzip";
  const letters = text.split("");

  return (
    <section id="home" className="relative h-screen w-full overflow-hidden flex items-center justify-center bg-black">
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
      <div className="absolute inset-0 z-0">
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
        <div className="flex flex-col items-center gap-2">
          <div className="overflow-hidden">
            <motion.h1 
              initial={{ y: "100%" }}
              animate={isIntroComplete ? { y: 0 } : { y: "100%" }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className="text-[8vw] sm:text-[7vw] md:text-[6vw] lg:text-7xl font-black tracking-tighter text-white leading-none whitespace-nowrap"
            >
              FULL SERVICE
            </motion.h1>
          </div>
          <div className="overflow-hidden">
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
  const categories = [
    { 
      id: 'brand', 
      title: 'BRAND & CORPORATE', 
      subtitle: 'Fortune 500 Identity',
      image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2000&auto=format&fit=crop',
    },
    { 
      id: 'performance', 
      title: 'PERFORMANCE', 
      subtitle: 'Broadway & Narrative',
      image: 'https://images.unsplash.com/photo-1514302240736-b1fee5989461?q=80&w=2000&auto=format&fit=crop',
      video: '/broadway-reel.mp4',
    },
    { 
      id: 'podcasts', 
      title: 'PODCASTS', 
      subtitle: 'Digital Content',
      image: 'https://images.unsplash.com/photo-1478737270239-2f02b77ac6d5?q=80&w=2000&auto=format&fit=crop',
    },
  ];

  return (
    <section id="work" className="bg-black">
      {categories.map((cat) => (
        <div key={cat.id} className="relative w-full h-[60vh] md:h-screen overflow-hidden group border-b border-white/5">
          {cat.video && (
            <video
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-700"
            >
              <source src={cat.video} type="video/mp4" />
            </video>
          )}
          
          {!cat.video && (
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-[2s] group-hover:scale-105 opacity-60 group-hover:opacity-100"
              style={{ backgroundImage: `url(${cat.image})` }}
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-6 md:p-24 flex flex-col justify-end items-start">
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-3xl md:text-8xl font-black uppercase tracking-tighter text-white mb-2 leading-none">{cat.title}</h2>
              <p className="text-xs md:text-xl tracking-[0.2em] uppercase text-white/60 font-bold">{cat.subtitle}</p>
            </motion.div>
          </div>
        </div>
      ))}

      <div className="py-16 md:py-20 text-center border-b border-white/5 px-6">
        <a 
          href="/archive" 
          className="inline-block border border-white/20 px-8 py-5 md:px-12 md:py-6 text-xs font-bold tracking-[0.2em] uppercase hover:bg-white hover:text-black transition-all duration-300 w-full md:w-auto"
        >
          Explore Full Video Repository
        </a>
      </div>
    </section>
  );
}

function Social() {
  return (
    <section className="py-24 bg-black overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-12">
        <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase mb-4">Built for the Feed</h2>
        <p className="text-sm md:text-base opacity-60 max-w-xl">
          We don&apos;t just resize horizontal video. We shoot specifically for vertical 9:16 to stop the scroll.
        </p>
      </div>
      
      {/* Marquee of 9:16 Videos */}
      <div className="flex gap-6 overflow-x-auto pb-8 px-6 no-scrollbar snap-x">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="snap-center shrink-0 w-[200px] md:w-[300px] aspect-[9/16] bg-neutral-900 relative rounded-lg overflow-hidden border border-white/10 group">
             <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">Social Clip {i}</span>
             </div>
             {/* Placeholder for actual vertical video files */}
             <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-colors" />
          </div>
        ))}
      </div>
    </section>
  );
}

// ... Clients component remains unchanged ...

function About() {
  return (
    <section id="about" className="py-32 px-6 max-w-7xl mx-auto flex flex-col items-start">
      <motion.h2 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-3xl md:text-6xl font-black tracking-tighter uppercase leading-tight mb-12 max-w-4xl"
      >
        We don&apos;t do &quot;Marketing Speak.&quot; <br/>
        <span className="text-[var(--accent)]">We just make it look cool.</span>
      </motion.h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-sm md:text-lg opacity-70 leading-relaxed font-medium">
        <p>
          Your audience is smart. They know when they&apos;re being sold to. 
          That&apos;s why we focus on the visual language first.
        </p>
        <p>
          Whether it&apos;s a Broadway stage or a TikTok feed, we respect the medium and the moment. 
          No fluff. No drama. Just high-impact video that works.
        </p>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="py-24 px-6 max-w-7xl mx-auto flex flex-col justify-center">
      <div className="flex flex-col lg:flex-row gap-20 items-start">
        <div className="w-full lg:w-1/2 text-left overflow-hidden">
          <motion.div
             initial={{ y: "100%" }}
             whileInView={{ y: 0 }}
             viewport={{ once: true }}
             transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 uppercase leading-[0.9]">
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
          {/* ... Form content ... */}
          <form 
            action="https://formspree.io/f/mgokbqag" 
            method="POST" 
            className="space-y-10 bg-neutral-900/30 p-8 md:p-12 border border-white/5 text-left"
          >
            <div className="space-y-2">
              <label className="text-xs tracking-[0.4em] uppercase opacity-40 font-bold">Name</label>
              <input 
                type="text" 
                name="name"
                required
                className="w-full bg-transparent border-b border-white/20 py-3 outline-none focus:border-white transition-colors uppercase text-sm" 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs tracking-[0.4em] uppercase opacity-40 font-bold">Email</label>
              <input 
                type="email" 
                name="email"
                required
                className="w-full bg-transparent border-b border-white/20 py-3 outline-none focus:border-white transition-colors uppercase text-sm" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs tracking-[0.4em] uppercase opacity-40 font-bold">Project Type</label>
              <select 
                name="projectType"
                className="w-full bg-transparent border-b border-white/20 py-3 outline-none focus:border-white transition-colors appearance-none uppercase text-sm rounded-none"
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
                className="w-full bg-transparent border-b border-white/20 py-3 outline-none focus:border-white transition-colors resize-none uppercase text-sm" 
              />
            </div>

            <button type="submit" className="w-full bg-white text-black font-black py-5 tracking-[0.3em] uppercase hover:bg-[var(--accent)] hover:text-white transition-all text-xs duration-300">
              Send Inquiry
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
      <LogoTicker />
      <About />
      <Contact />
    </main>
  );
}
