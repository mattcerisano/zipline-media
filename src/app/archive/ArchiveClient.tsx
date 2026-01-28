'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import videos from '@/data/videos.json';

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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-12 pt-12 md:pt-20">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-16 flex flex-col gap-8">
          <Link href="/" className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] font-bold hover:text-[var(--accent)] transition-colors w-fit opacity-60 hover:opacity-100">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter break-words leading-[0.9] py-2"
            >
              Video Repository
            </motion.h1>
          </div>
        </header>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10 pb-20"
        >
          {videos.map((video, index) => (
            <motion.button 
              key={index}
              variants={itemVariants}
              onClick={() => setSelectedVideo(video.videoUrl)}
              className="group flex flex-col gap-3 text-left w-full"
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              {/* Thumbnail Container */}
              <div className="aspect-video w-full overflow-hidden bg-neutral-900 border border-white/5 relative rounded-sm shadow-lg group-hover:shadow-2xl group-hover:shadow-white/5 transition-all duration-500">
                <img 
                  src={video.thumbnail} 
                  alt={video.title}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500" />
                
                {/* Play Icon Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 group-active:scale-95 transition-transform">
                    <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white border-b-[5px] border-b-transparent ml-1"></div>
                  </div>
                </div>
              </div>
              
              {/* Title */}
              <h3 className="font-bold text-[10px] md:text-xs uppercase tracking-wider leading-snug group-hover:text-[var(--accent)] transition-colors opacity-60 group-hover:opacity-100 duration-300">
                {video.title}
              </h3>
            </motion.button>
          ))}
        </motion.div>
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
