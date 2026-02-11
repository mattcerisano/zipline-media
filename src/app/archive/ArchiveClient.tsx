'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, X, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import videos from '@/data/videos.json';

// --- Sub-component for individual Category Sections ---
function CategorySection({ 
  category, 
  videos, 
  onPlay 
}: { 
  category: string; 
  videos: any[]; 
  onPlay: (url: string) => void; 
}) {
  // State to track which video is currently featured in the "Hero" slot for this category
  const [activeVideo, setActiveVideo] = useState(videos[0]);

  // Ensure activeVideo updates if videos prop changes (though unlikely for static json)
  useEffect(() => {
    setActiveVideo(videos[0]);
  }, [videos]);

  const categoryId = category.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

  return (
    <section id={categoryId} className="scroll-mt-32">
      <motion.h2 
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-2xl md:text-4xl font-bold uppercase tracking-widest mb-8 border-b border-white/10 pb-6 text-white/90"
      >
        {category}
      </motion.h2>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8">
        {/* --- HERO VIDEO (Left / Top) --- */}
        {/* Takes up larger portion (e.g. 7/12 or 8/12) */}
        <div className="xl:col-span-7 2xl:col-span-8">
          <motion.button
            layoutId={`hero-${category}-${activeVideo.title}`} 
            onClick={() => onPlay(activeVideo.videoUrl)}
            className="group relative w-full aspect-video bg-neutral-900 rounded-sm overflow-hidden border border-white/10 shadow-2xl text-left block"
          >
            <img 
              src={activeVideo.thumbnail} 
              alt={activeVideo.title}
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60" />
            
            {/* Play Button (Hero) */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
               <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 scale-90 group-hover:scale-100 transition-transform">
                  <Play className="w-8 h-8 text-white fill-white ml-1" />
               </div>
            </div>

            <div className="absolute bottom-0 left-0 p-6 md:p-8 w-full">
               <h3 className="text-lg md:text-2xl font-black uppercase tracking-tight text-white leading-[1.2]">
                 {activeVideo.title}
               </h3>
            </div>
          </motion.button>
        </div>

        {/* --- THUMBNAIL GRID (Right) --- */}
        {/* Scrollable container or Grid */}
        <div className="xl:col-span-5 2xl:col-span-4">
           <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2 no-scrollbar">
              {videos.map((video, index) => {
                const isActive = video === activeVideo;
                return (
                  <button 
                    key={`${category}-thumb-${index}`}
                    onClick={() => setActiveVideo(video)}
                    className={`group relative aspect-video bg-neutral-900 border transition-all duration-300 rounded-sm overflow-hidden text-left
                      ${isActive 
                        ? 'border-[var(--accent)] opacity-100 ring-1 ring-[var(--accent)]' 
                        : 'border-white/10 opacity-50 hover:opacity-100 hover:border-white/30'
                      }
                    `}
                  >
                    <img 
                      src={video.thumbnail} 
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                    {isActive && (
                      <div className="absolute inset-0 bg-[var(--accent)]/20 flex items-center justify-center">
                         <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/90 to-transparent">
                       <p className="text-[9px] font-bold text-white uppercase tracking-wider line-clamp-1">
                         {video.title}
                       </p>
                    </div>
                  </button>
                );
              })}
           </div>
        </div>
      </div>
    </section>
  );
}

export default function ArchiveClient() {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (selectedVideo) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [selectedVideo]);

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-12 pt-32 md:pt-40">
      <div className="max-w-[1800px] mx-auto">
        <header className="mb-16 flex flex-col gap-8">
          <Link href="/" className="flex items-center gap-2 text-sm uppercase tracking-[0.3em] font-bold hover:text-[var(--accent)] transition-colors w-fit opacity-70 hover:opacity-100">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter whitespace-nowrap leading-[0.9] py-2"
            >
              Video Repository
            </motion.h1>
          </div>
        </header>

        <div className="flex flex-col gap-20 pb-20">
          
          {/* This Minute Section (Keep as Grid or convert? Keeping as Grid for variety as it's 'Just Added') */}
          <section>
            <motion.h2 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-2xl md:text-4xl font-bold uppercase tracking-widest mb-10 border-b border-white/10 pb-6 text-[var(--accent)]"
            >
              Recent Work
            </motion.h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-6 gap-y-10">
              {[...videos]
                .sort((a: any, b: any) => {
                  const SOCIAL_CLIPS_ORDER = [
                    "‘Good Fortune’ & Funny Set Confessions with Keanu Reeves, Seth Rogen and Aziz Ansari",
                    "Golden Hour | The Queen of Versailles on Broadway",
                    "Record-Breaking Signings, March Madness Mayhem & A Severance Waffle Party with Ben Stiller | Ep 130",
                    "The Most BROADWAY Broadway Opening Night | SMASH The Musical",
                    "For Her/My Green Light - The Great Gatsby on Broadway",
                    "Opening Night with Real Women Have Curves | The Musical"
                  ];

                  const indexA = SOCIAL_CLIPS_ORDER.indexOf(a.title);
                  const indexB = SOCIAL_CLIPS_ORDER.indexOf(b.title);

                  // If both are in the specific list, sort by the list order
                  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                  // If only A is in the list, it comes first
                  if (indexA !== -1) return -1;
                  // If only B is in the list, it comes first
                  if (indexB !== -1) return 1;

                  // Fallback: If tagged as social_clips but not in the specific list (safety), prioritize them
                  if (a.collection === 'social_clips' && b.collection !== 'social_clips') return -1;
                  if (a.collection !== 'social_clips' && b.collection === 'social_clips') return 1;

                  // Default: Sort by date descending
                  const dateA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
                  const dateB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
                  return dateB - dateA;
                })
                .slice(0, 6)
                .map((video: any, index: number) => (
                <button 
                  key={`just-added-${index}`}
                  onClick={() => setSelectedVideo(video.videoUrl)}
                  className="group flex flex-col gap-3 text-left w-full hover:-translate-y-1 transition-transform duration-300"
                >
                  <div className="aspect-video w-full overflow-hidden bg-neutral-900 border border-white/5 relative rounded-sm shadow-lg group-hover:shadow-2xl group-hover:shadow-white/5 transition-all duration-500">
                    <img 
                      src={video.thumbnail} 
                      alt={video.title}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 ease-out"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500" />
                    
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                        <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <h3 className="font-bold text-[10px] md:text-xs uppercase tracking-wider leading-snug group-hover:text-[var(--accent)] transition-colors opacity-60 group-hover:opacity-100 duration-300">
                    {video.title}
                  </h3>
                </button>
              ))}
            </div>
          </section>

          {/* Categories with New Layout */}
          {['Opening Nights', 'Reveals', 'Music', 'New Media', 'Broadway B-Roll', 'TVC'].map((category) => {
            const categoryVideos = videos
              .filter((v: any) => v.category === category)
              .sort((a: any, b: any) => {
                 // Priority 1: Social Clips (High Profile)
                 if (a.collection === 'social_clips' && b.collection !== 'social_clips') return -1;
                 if (a.collection !== 'social_clips' && b.collection === 'social_clips') return 1;
                 
                 // Priority 2: Date (Newest First)
                 const dateA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
                 const dateB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
                 return dateB - dateA;
              });

            if (categoryVideos.length === 0) return null;
            
            return (
              <CategorySection 
                key={category} 
                category={category} 
                videos={categoryVideos} 
                onPlay={(url) => setSelectedVideo(url)} 
              />
            );
          })}
        </div>
      </div>

      {/* Video Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 md:p-8"
          >
            <button 
              onClick={() => setSelectedVideo(null)}
              className="absolute top-4 right-4 md:top-8 md:right-8 p-2 text-white/50 hover:text-white transition-colors hover:rotate-90 duration-300 z-[110]"
            >
              <X className="w-8 h-8 md:w-10 md:h-10" />
            </button>
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-6xl aspect-video bg-black shadow-2xl relative border border-white/10 rounded-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()} 
            >
              <iframe 
                src={selectedVideo.includes('autoplay') ? selectedVideo : `${selectedVideo}${selectedVideo.includes('?') ? '&' : '?'}autoplay=1`}
                className="w-full h-full" 
                allow="autoplay; fullscreen; picture-in-picture" 
                allowFullScreen
              />
            </motion.div>
            
            {/* Close overlay on outside click */}
            <div className="absolute inset-0 -z-10" onClick={() => setSelectedVideo(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}