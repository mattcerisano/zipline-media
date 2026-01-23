'use client';

import { motion } from 'framer-motion';
import { Clapperboard, Lightbulb, Wand2 } from 'lucide-react';
import LogoTicker from '@/components/LogoTicker';

// --- REUSABLE ANIMATION VARIANTS ---
const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.2
    }
  }
};

function Hero() {
  return (
    <section id="home" className="relative h-screen w-full overflow-hidden flex items-center justify-center">
      {/* Background Video */}
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
        {/* Dark Overlay for readability - Gradient for better text pop */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/70 z-10" />
      </div>

      <div className="relative z-20 text-center px-4 overflow-hidden">
        <div className="overflow-hidden mb-4">
          <motion.h1 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="text-6xl md:text-8xl font-black tracking-tighter text-white"
          >
            CURIOSITY UNLEASHED
          </motion.h1>
        </div>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-lg md:text-xl font-medium tracking-[0.2em] uppercase opacity-80 text-white"
        >
          Creative Partners in Video Production
        </motion.p>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20"
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
      image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2000&auto=format&fit=crop',
      label: 'Fortune 500 & Commercial Identity'
    },
    { 
      id: 'performance', 
      title: 'PERFORMANCE & NARRATIVE', 
      image: 'https://images.unsplash.com/photo-1514302240736-b1fee5989461?q=80&w=2000&auto=format&fit=crop',
      video: '/broadway-reel.mp4',
      label: 'Broadway & Creative Storytelling'
    },
    { 
      id: 'podcasts', 
      title: 'PODCASTS & SOCIAL', 
      image: 'https://images.unsplash.com/photo-1478737270239-2f02b77ac6d5?q=80&w=2000&auto=format&fit=crop',
      label: 'Digital Content & Innovative Audio'
    },
  ];

  return (
    <section id="work" className="bg-black py-24 px-6 max-w-7xl mx-auto flex flex-col justify-center gap-16">
      <div className="text-center md:text-left border-b border-white/10 pb-8">
        <h2 className="text-[10px] font-bold tracking-[0.5em] text-white/40 uppercase">Selected Work</h2>
      </div>

      <motion.div 
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: "-100px" }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {categories.map((cat) => (
          <motion.div
            variants={fadeIn}
            key={cat.id}
            className="group relative aspect-[3/4] md:aspect-[9/16] bg-neutral-900 overflow-hidden cursor-pointer"
          >
            {cat.video && (
              <video
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 w-full h-full object-cover transition-all duration-700 z-10"
              >
                <source src={cat.video} type="video/mp4" />
              </video>
            )}

            <img 
              src={cat.image} 
              alt={cat.title}
              className={`object-cover w-full h-full group-hover:scale-105 transition-all duration-700 z-0 ${cat.video ? 'opacity-0' : 'opacity-100'}`}
            />
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 z-20">
              <p className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 delay-100">{cat.label}</p>
              <h3 className="text-2xl font-black tracking-tighter uppercase leading-none translate-y-2 group-hover:translate-y-0 transition-transform duration-500">{cat.title}</h3>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="mt-12 text-center">
        <a href="/archive" className="inline-block border border-white/20 px-8 py-4 text-sm font-bold tracking-[0.2em] uppercase hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-white transition-all duration-300">
          Open Video Repository
        </a>
      </div>
    </section>
  );
}

// ... Clients component remains unchanged (already has ticker) ...

function About() {
  return (
    <section id="about" className="py-24 px-6 max-w-7xl mx-auto flex flex-col justify-center">
      <div className="mb-32 w-full text-center overflow-hidden">
        <motion.div 
          initial={{ y: "100%" }}
          whileInView={{ y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter mb-12 uppercase">
            PEOPLE FIRST. CREATIVE ALWAYS.
          </h2>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="flex flex-col md:flex-row gap-12 items-center justify-center"
        >
          <p className="text-xl md:text-2xl font-medium leading-relaxed opacity-90 max-w-xl">
            We are smart, adaptable, and innovative. Our process begins with a conversation to understand your brand story and visual style.
          </p>
          <div className="space-y-6 text-neutral-400 leading-loose uppercase text-sm tracking-widest max-w-md text-left md:text-left">
            <p>
              Whether you need stunning TV commercials, engaging TikToks, or high-quality social ads, we meet you where you are.
            </p>
            <p className="text-white/60">
              We shoot with the destination in mind—composing specifically for 9:16, 16:9, or 1:1 to ensure your story stops the scroll on every platform.
            </p>
          </div>
        </motion.div>
      </div>

      <motion.div 
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true }}
        className="grid grid-cols-1 md:grid-cols-3 gap-12 border-t border-white/10 pt-20"
      >
        <motion.div variants={fadeIn}>
          <Lightbulb className="w-8 h-8 text-white mb-6 opacity-80" />
          <h3 className="text-[10px] font-bold tracking-[0.4em] uppercase mb-6 opacity-40">01 THE BLUEPRINT</h3>
          <p className="text-sm leading-relaxed opacity-70">We map the story and strategy before we roll a single frame. Clarity is our starting point.</p>
        </motion.div>
        <motion.div variants={fadeIn}>
          <Clapperboard className="w-8 h-8 text-white mb-6 opacity-80" />
          <h3 className="text-[10px] font-bold tracking-[0.4em] uppercase mb-6 opacity-40">02 THE ACTION</h3>
          <p className="text-sm leading-relaxed opacity-70">High-end gear. High-energy crew. Efficient, adaptable, and focused on the perfect take.</p>
        </motion.div>
        <motion.div variants={fadeIn}>
          <Wand2 className="w-8 h-8 text-white mb-6 opacity-80" />
          <h3 className="text-[10px] font-bold tracking-[0.4em] uppercase mb-6 opacity-40">03 THE ALCHEMY</h3>
          <p className="text-sm leading-relaxed opacity-70">Editing, color, and sound design that makes the concept sing. We add the spice to taste.</p>
        </motion.div>
      </motion.div>
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
              <p className="text-sm tracking-[0.3em] font-bold uppercase">CONTACT@ZIPLINE.MEDIA</p>
              <p className="text-sm tracking-[0.3em] font-bold uppercase opacity-40">NEW YORK, NY</p>
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
          <form className="space-y-10 bg-neutral-900/30 p-8 md:p-12 border border-white/5 text-left">
            <div className="space-y-2">
              <label className="text-[10px] tracking-[0.4em] uppercase opacity-40 font-bold">Name</label>
              <input type="text" className="w-full bg-transparent border-b border-white/20 py-3 outline-none focus:border-white transition-colors uppercase text-sm" />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] tracking-[0.4em] uppercase opacity-40 font-bold">Email</label>
              <input type="email" className="w-full bg-transparent border-b border-white/20 py-3 outline-none focus:border-white transition-colors uppercase text-sm" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] tracking-[0.4em] uppercase opacity-40 font-bold">Project Type</label>
              <select className="w-full bg-transparent border-b border-white/20 py-3 outline-none focus:border-white transition-colors appearance-none uppercase text-sm rounded-none">
                <option className="bg-black">Performance / Narrative</option>
                <option className="bg-black">Brand / Corporate</option>
                <option className="bg-black">Creative / Social</option>
                <option className="bg-black">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] tracking-[0.4em] uppercase opacity-40 font-bold">Message</label>
              <textarea rows={4} className="w-full bg-transparent border-b border-white/20 py-3 outline-none focus:border-white transition-colors resize-none uppercase text-sm" />
            </div>

            <button className="w-full bg-white text-black font-black py-5 tracking-[0.3em] uppercase hover:bg-[var(--accent)] hover:text-white transition-all text-xs duration-300">
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
      <LogoTicker />
      <About />
      <Contact />
    </main>
  );
}
